-- ============================================================
-- Create avatars public storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public          = true,
      file_size_limit = 2097152;

-- ============================================================
-- RLS policies for avatars bucket
-- ============================================================
DROP POLICY IF EXISTS "auth_upload_avatars" ON storage.objects;
CREATE POLICY "auth_upload_avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
CREATE POLICY "public_read_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "auth_update_avatars" ON storage.objects;
CREATE POLICY "auth_update_avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "auth_delete_avatars" ON storage.objects;
CREATE POLICY "auth_delete_avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
