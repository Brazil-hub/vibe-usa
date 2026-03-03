-- ============================================================
-- Comments moderation: proper RLS policies
-- ============================================================
-- Replaces the original simple "using (true)" policies with
-- rules that correctly support the pending/approved flow.

-- Drop old policies
DROP POLICY IF EXISTS "comments_read"   ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_update" ON public.comments;
DROP POLICY IF EXISTS "comments_delete" ON public.comments;

-- ── SELECT ───────────────────────────────────────────────────
-- • Everyone sees approved comments
-- • A user sees their OWN pending comments (so commenter sees
--   their comment labelled "pending review")
-- • The event organizer sees ALL comments (to moderate)
CREATE POLICY "comments_read" ON public.comments
  FOR SELECT USING (
    status = 'approved'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.events e ON e.id = p.event_id
      WHERE p.id = comments.post_id
        AND e.creator_id = auth.uid()
    )
  );

-- ── INSERT ───────────────────────────────────────────────────
-- • Any authenticated user can post their own comment
-- • Non-organizers MUST use status = 'pending'
-- • The event organizer can post directly as 'approved'
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      status = 'pending'
      OR EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.events e ON e.id = p.event_id
        WHERE p.id = post_id
          AND e.creator_id = auth.uid()
      )
    )
  );

-- ── UPDATE ───────────────────────────────────────────────────
-- Only the event organizer can update comments (approve them)
CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.events e ON e.id = p.event_id
      WHERE p.id = comments.post_id
        AND e.creator_id = auth.uid()
    )
  );

-- ── DELETE ───────────────────────────────────────────────────
-- Comment author can delete their own; organizer can delete any
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.events e ON e.id = p.event_id
      WHERE p.id = comments.post_id
        AND e.creator_id = auth.uid()
    )
  );
