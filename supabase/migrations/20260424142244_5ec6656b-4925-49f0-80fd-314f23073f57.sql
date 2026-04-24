
-- Drop policy antiga primeiro
DROP POLICY IF EXISTS "Usuário vê próprios pagamentos ou admin vê todos" ON public.payments;

-- Limpar pagamentos antigos
DELETE FROM public.payments;
ALTER TABLE public.payments DROP COLUMN IF EXISTS user_id;

-- Tabela athletes
CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  birth_date date,
  joined_at date,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  manual_status public.manual_status,
  notes text,
  legacy_id integer,
  user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_athletes_user_id ON public.athletes(user_id);
CREATE INDEX idx_athletes_legacy_id ON public.athletes(legacy_id);

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam atletas" ON public.athletes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Atleta vê próprio cadastro" ON public.athletes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER athletes_updated_at
  BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payments agora aponta para athlete_id
ALTER TABLE public.payments ADD COLUMN athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE;
ALTER TABLE public.payments ALTER COLUMN athlete_id SET NOT NULL;
CREATE INDEX idx_payments_athlete_id ON public.payments(athlete_id);

CREATE POLICY "Atleta vê próprios pagamentos" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = payments.athlete_id AND a.user_id = auth.uid()
    )
  );
