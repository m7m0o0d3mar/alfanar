INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, false, 5242880, '{image/png,image/jpeg,image/webp,image/gif}')
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars_public_read') THEN
    EXECUTE 'CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = ''avatars'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars_authenticated_insert') THEN
    EXECUTE 'CREATE POLICY "avatars_authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''avatars'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars_own_update') THEN
    EXECUTE 'CREATE POLICY "avatars_own_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''avatars'' AND owner = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars_own_delete') THEN
    EXECUTE 'CREATE POLICY "avatars_own_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''avatars'' AND owner = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars_service_all') THEN
    EXECUTE 'CREATE POLICY "avatars_service_all" ON storage.objects FOR ALL TO service_role USING (bucket_id = ''avatars'')';
  END IF;
END;
$$;
