-- ============================================================
-- 1. Add status column to comments table
-- ============================================================
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';

-- ============================================================
-- 2. Create comment-images public storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-images',
  'comment-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public          = true,
      file_size_limit = 5242880;

-- ============================================================
-- 3. Storage RLS policies for comment-images
-- ============================================================
DROP POLICY IF EXISTS "auth_upload_comment_images" ON storage.objects;
CREATE POLICY "auth_upload_comment_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "public_read_comment_images" ON storage.objects;
CREATE POLICY "public_read_comment_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "auth_delete_comment_images" ON storage.objects;
CREATE POLICY "auth_delete_comment_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comment-images');
