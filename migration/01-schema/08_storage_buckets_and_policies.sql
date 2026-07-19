INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('biometric-captures','biometric-captures',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('dispute-evidence','dispute-evidence',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('kyc-documents','kyc-documents',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('support-attachments','support-attachments',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('transaction-documents','transaction-documents',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('verification-evidence','verification-evidence',false,NULL,NULL) ON CONFLICT (id) DO NOTHING;
-- Storage policies ya incluidas en 06_rls_policies.sql (schema storage)
