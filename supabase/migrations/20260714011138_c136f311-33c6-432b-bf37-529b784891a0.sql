
CREATE POLICY "biometric_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id='biometric-captures' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
