-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

-- Create payment_submissions table for athlete-submitted payments awaiting admin approval
CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  reference_month date NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  method text DEFAULT 'PIX',
  notes text,
  receipt_url text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick pending lookup
CREATE INDEX idx_payment_submissions_status ON public.payment_submissions(status);
CREATE INDEX idx_payment_submissions_athlete ON public.payment_submissions(athlete_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_payment_submissions
BEFORE UPDATE ON public.payment_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins gerenciam submissões"
ON public.payment_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Athletes can view their own submissions
CREATE POLICY "Atleta vê próprias submissões"
ON public.payment_submissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = payment_submissions.athlete_id
      AND a.user_id = auth.uid()
  )
);

-- Athletes can create submissions for themselves (only pending)
CREATE POLICY "Atleta cria própria submissão"
ON public.payment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = payment_submissions.athlete_id
      AND a.user_id = auth.uid()
  )
);

-- Allow athletes to upload receipts to their own folder in payment-receipts bucket
CREATE POLICY "Atletas enviam comprovante próprio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[1]
  )
);

-- Allow athletes to read their own receipts
CREATE POLICY "Atletas leem comprovante próprio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.user_id = auth.uid()
        AND a.id::text = (storage.foldername(name))[1]
    )
  )
);

-- RPC: approve submission (admin only) - creates payment and links it
CREATE OR REPLACE FUNCTION public.approve_payment_submission(_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub public.payment_submissions%ROWTYPE;
  _new_payment_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO _sub FROM public.payment_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submissão não encontrada';
  END IF;
  IF _sub.status <> 'pending' THEN
    RAISE EXCEPTION 'Submissão já foi processada';
  END IF;

  INSERT INTO public.payments (
    athlete_id, amount, reference_month, paid_at, due_date, method, notes, receipt_url, created_by
  ) VALUES (
    _sub.athlete_id, _sub.amount, _sub.reference_month, _sub.paid_at, _sub.due_date,
    _sub.method, _sub.notes, _sub.receipt_url, auth.uid()
  ) RETURNING id INTO _new_payment_id;

  UPDATE public.payment_submissions
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      payment_id = _new_payment_id
  WHERE id = _submission_id;

  RETURN _new_payment_id;
END;
$$;

-- RPC: reject submission (admin only)
CREATE OR REPLACE FUNCTION public.reject_payment_submission(_submission_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.payment_submissions
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = _reason
  WHERE id = _submission_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submissão não encontrada ou já processada';
  END IF;
END;
$$;