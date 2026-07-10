GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variations TO authenticated;
GRANT SELECT ON public.product_variations TO anon;
GRANT ALL ON public.product_variations TO service_role;