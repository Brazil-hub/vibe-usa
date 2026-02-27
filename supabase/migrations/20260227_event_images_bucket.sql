-- ============================================================
-- Storage: create event-images public bucket
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Create the bucket (or make it public if it already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 10485760;

-- 2. Allow authenticated users to upload
DROP POLICY IF EXISTS "auth_upload_event_images" ON storage.objects;
CREATE POLICY "auth_upload_event_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

-- 3. Public read (needed even on a public bucket for the RLS layer)
DROP POLICY IF EXISTS "public_read_event_images" ON storage.objects;
CREATE POLICY "public_read_event_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

-- 4. Authenticated users can delete from event-images
DROP POLICY IF EXISTS "auth_delete_event_images" ON storage.objects;
CREATE POLICY "auth_delete_event_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');
