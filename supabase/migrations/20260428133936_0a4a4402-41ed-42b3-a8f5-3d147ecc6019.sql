-- 1) Coluna para armazenar o caminho do comprovante
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;

-- 2) Bucket privado para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Políticas de acesso ao bucket
CREATE POLICY "Admins gerenciam comprovantes (select)"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam comprovantes (insert)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam comprovantes (update)"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam comprovantes (delete)"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Atleta vê próprio comprovante"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.user_id = auth.uid()
  )
);