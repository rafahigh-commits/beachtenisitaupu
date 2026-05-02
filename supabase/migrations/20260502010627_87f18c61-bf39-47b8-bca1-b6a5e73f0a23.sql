-- Categorias de despesas (personalizáveis pelo admin)
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam categorias"
ON public.expense_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados veem categorias"
ON public.expense_categories FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER trg_expense_categories_updated
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Despesas (saídas)
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_month date NOT NULL,
  notes text,
  receipt_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_reference_month ON public.expenses(reference_month);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam despesas"
ON public.expenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_expenses_updated
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Receitas extras (não vindas de mensalidades)
CREATE TABLE public.extra_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_month date NOT NULL,
  source text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_incomes_reference_month ON public.extra_incomes(reference_month);

ALTER TABLE public.extra_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam receitas extras"
ON public.extra_incomes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_extra_incomes_updated
BEFORE UPDATE ON public.extra_incomes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função: resumo financeiro mensal (público para autenticados)
CREATE OR REPLACE FUNCTION public.financial_summary_month(_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start date := date_trunc('month', _month)::date;
  _payments numeric;
  _extras numeric;
  _expenses numeric;
  _by_category jsonb;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO _payments
  FROM public.payments
  WHERE date_trunc('month', reference_month)::date = _start;

  SELECT COALESCE(SUM(amount), 0) INTO _extras
  FROM public.extra_incomes
  WHERE date_trunc('month', reference_month)::date = _start;

  SELECT COALESCE(SUM(amount), 0) INTO _expenses
  FROM public.expenses
  WHERE date_trunc('month', reference_month)::date = _start;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category_id', c.id,
    'category_name', COALESCE(c.name, 'Sem categoria'),
    'color', c.color,
    'total', t.total
  ) ORDER BY t.total DESC), '[]'::jsonb)
  INTO _by_category
  FROM (
    SELECT category_id, SUM(amount) AS total
    FROM public.expenses
    WHERE date_trunc('month', reference_month)::date = _start
    GROUP BY category_id
  ) t
  LEFT JOIN public.expense_categories c ON c.id = t.category_id;

  RETURN jsonb_build_object(
    'month', _start,
    'payments_total', _payments,
    'extras_total', _extras,
    'income_total', _payments + _extras,
    'expenses_total', _expenses,
    'balance', _payments + _extras - _expenses,
    'expenses_by_category', _by_category
  );
END;
$$;

-- Função: visão anual (12 meses)
CREATE OR REPLACE FUNCTION public.financial_summary_year(_year integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'month', m.month_start,
    'income_total', COALESCE(p.total, 0) + COALESCE(e.total, 0),
    'payments_total', COALESCE(p.total, 0),
    'extras_total', COALESCE(e.total, 0),
    'expenses_total', COALESCE(x.total, 0),
    'balance', COALESCE(p.total, 0) + COALESCE(e.total, 0) - COALESCE(x.total, 0)
  ) ORDER BY m.month_start)
  INTO _result
  FROM (
    SELECT (make_date(_year, gs, 1))::date AS month_start
    FROM generate_series(1, 12) gs
  ) m
  LEFT JOIN (
    SELECT date_trunc('month', reference_month)::date AS m, SUM(amount) AS total
    FROM public.payments
    WHERE EXTRACT(YEAR FROM reference_month) = _year
    GROUP BY 1
  ) p ON p.m = m.month_start
  LEFT JOIN (
    SELECT date_trunc('month', reference_month)::date AS m, SUM(amount) AS total
    FROM public.extra_incomes
    WHERE EXTRACT(YEAR FROM reference_month) = _year
    GROUP BY 1
  ) e ON e.m = m.month_start
  LEFT JOIN (
    SELECT date_trunc('month', reference_month)::date AS m, SUM(amount) AS total
    FROM public.expenses
    WHERE EXTRACT(YEAR FROM reference_month) = _year
    GROUP BY 1
  ) x ON x.m = m.month_start;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;

-- Categorias iniciais sugeridas
INSERT INTO public.expense_categories (name, color) VALUES
  ('Aluguel da quadra', '#3b82f6'),
  ('Materiais', '#10b981'),
  ('Eventos', '#f59e0b'),
  ('Professores', '#8b5cf6'),
  ('Manutenção', '#ef4444'),
  ('Outros', '#6b7280');
