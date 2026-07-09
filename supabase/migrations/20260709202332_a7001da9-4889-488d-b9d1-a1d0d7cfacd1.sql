
CREATE POLICY "Public read product media" ON storage.objects FOR SELECT USING (bucket_id = 'product-media');
CREATE POLICY "Admins upload product media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media' AND private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins update product media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media' AND private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins delete product media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-media' AND private.has_role(auth.uid(),'admin'::public.app_role));
