-- ============================================================
-- Posts moderation: proper RLS policies
-- ============================================================
-- Ensures the event organizer can see ALL posts (pending + approved)
-- for their events, while regular users only see approved posts.
-- Mirrors the comments moderation RLS pattern.

-- Drop any existing policies on posts
DROP POLICY IF EXISTS "posts_read"   ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;

-- Enable RLS (safe to call even if already enabled)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- ── SELECT ───────────────────────────────────────────────────
-- • Everyone sees approved posts
-- • A user sees their OWN pending posts (so they know it's under review)
-- • The event organizer sees ALL posts for their event (to moderate)
CREATE POLICY "posts_read" ON public.posts
  FOR SELECT USING (
    status = 'approved'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = posts.event_id
        AND e.creator_id = auth.uid()
    )
  );

-- ── INSERT ───────────────────────────────────────────────────
-- Any authenticated user can post as themselves.
-- Application layer (EventPostComposer.jsx) sets the correct status:
--   • organizer or private event → "approved"
--   • everyone else             → "pending"
CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── UPDATE ───────────────────────────────────────────────────
-- Only the event organizer can update posts (approve/reject)
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = posts.event_id
        AND e.creator_id = auth.uid()
    )
  );

-- ── DELETE ───────────────────────────────────────────────────
-- Post author can delete their own; organizer can delete any post on their event
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = posts.event_id
        AND e.creator_id = auth.uid()
    )
  );
