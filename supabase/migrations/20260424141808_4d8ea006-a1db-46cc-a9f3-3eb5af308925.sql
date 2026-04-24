
-- 1) Plans: trocar frequency_per_week por duration_months
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1;
ALTER TABLE public.plans ALTER COLUMN frequency_per_week DROP NOT NULL;

-- Limpar planos antigos (eram 3 demo)
DELETE FROM public.plans;

-- Inserir os planos reais
INSERT INTO public.plans (name, description, price, duration_months, frequency_per_week, active) VALUES
  ('Mensal', 'Plano mensal - valor antigo', 10, 1, NULL, true),
  ('Mensal+', 'Plano mensal - valor atual', 15, 1, NULL, true),
  ('Trimestral', 'Plano trimestral - valor antigo', 30, 3, NULL, true),
  ('Trimestral+', 'Plano trimestral - valor atual', 40, 3, NULL, true),
  ('Semestral', 'Plano semestral - valor antigo', 60, 6, NULL, true),
  ('Semestral+', 'Plano semestral - valor atual', 75, 6, NULL, true),
  ('Anual', 'Plano anual - valor antigo', 120, 12, NULL, true),
  ('Anual+', 'Plano anual - valor atual', 145, 12, NULL, true);

-- 2) Profiles: status manual + last_due_date para acelerar cálculo
DO $$ BEGIN
  CREATE TYPE public.manual_status AS ENUM ('isento', 'saiu', 'doente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manual_status public.manual_status;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text;

-- 3) Group settings: substituir grace_days por charge_days e inactive_days
ALTER TABLE public.group_settings ADD COLUMN IF NOT EXISTS charge_days integer NOT NULL DEFAULT 40;
ALTER TABLE public.group_settings ADD COLUMN IF NOT EXISTS inactive_days integer NOT NULL DEFAULT 120;

-- Atualizar singleton e nome
UPDATE public.group_settings SET group_name = 'Itaipu Beach Tennis', charge_days = 40, inactive_days = 120 WHERE id = 1;
INSERT INTO public.group_settings (id, group_name, charge_days, inactive_days, grace_days)
SELECT 1, 'Itaipu Beach Tennis', 40, 120, 7
WHERE NOT EXISTS (SELECT 1 FROM public.group_settings WHERE id = 1);

-- 4) Payments: adicionar due_date para sabermos até quando o pagamento cobre
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS due_date date;
