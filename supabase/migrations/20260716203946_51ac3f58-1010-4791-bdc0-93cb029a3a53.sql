
-- 1) biometric_enrollments: explicit admin-only DELETE, block owner deletes.
DROP POLICY IF EXISTS "admin_delete_enrollments" ON public.biometric_enrollments;
CREATE POLICY "admin_delete_enrollments"
ON public.biometric_enrollments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) storage.biometric-captures: owner-scoped writes, admin lifecycle deletes, no updates.
DROP POLICY IF EXISTS "biometric_owner_write" ON storage.objects;
CREATE POLICY "biometric_owner_write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'biometric-captures'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "biometric_admin_delete" ON storage.objects;
CREATE POLICY "biometric_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'biometric-captures'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Intentionally no UPDATE policy on biometric-captures (updates blocked for authenticated).

-- 3) audit_events: documentar que las escrituras son sólo por el sistema (service_role / SECURITY DEFINER).
COMMENT ON TABLE public.audit_events IS
  'Registro de auditoría inmutable. Las escrituras las realiza el sistema (service_role o funciones SECURITY DEFINER); los usuarios autenticados sólo pueden leer los eventos de su organización o los propios.';
