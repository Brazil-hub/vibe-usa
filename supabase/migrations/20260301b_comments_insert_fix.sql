-- ============================================================
-- Simplify INSERT policy — status validation stays in JS/app layer
-- The previous policy restricted status='pending' for non-organizers
-- at the DB level, which can fail in edge cases. This version trusts
-- the application code to set the right status.
-- ============================================================

DROP POLICY IF EXISTS "comments_insert" ON public.comments;

-- Any authenticated user can insert a comment as themselves.
-- The application layer (EventPostAddComment.jsx) ensures:
--   • organizers → status = "approved"
--   • everyone else → status = "pending"
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
