
CREATE TABLE public.purchase_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  receipt_no text,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_payments TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;

ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage purchase payments"
  ON public.purchase_payments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX purchase_payments_purchase_id_idx ON public.purchase_payments(purchase_id);
