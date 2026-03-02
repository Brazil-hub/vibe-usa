import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase/client";
import EventPostComposer from "./EventPostComposer";
import EventPostCard from "./EventPostCard";
import styles from "../pages/EventDetailsPage.module.css";

export default function EventPostFeed({ eventId, rsvpStatus }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventMeta, setEventMeta] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingPostCount, setPendingPostCount] = useState(0);
  const pollRef = useRef(null);

  async function loadPosts() {
    setLoading(true);

    // 1) Buscar posts do evento (apenas approved para usuários normais)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: event } = await supabase
      .from("events")
      .select("id, creator_id, is_private")
      .eq("id", eventId)
      .single();

    const isOrganizer = user && event && event.creator_id === user.id;
    const isPrivate = event?.is_private;

    let postsQuery = supabase
      .from("posts")
      .select(
        `
        id,
        text,
        image_url,
        created_at,
        status,
        user_id,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (!isOrganizer) {
      postsQuery = postsQuery.eq("status", "approved");
    }

    const { data: postsData, error: postsError } = await postsQuery;

    if (postsError) {
      console.error("Erro carregando posts:", postsError);
      setPosts([]);
      setLoading(false);
      return;
    }

    const postsIds = postsData.map((p) => p.id);
      let likesByPost = {};
      let likedByUser = {};
      let commentsByPost = {};


    if (postsIds.length > 0) {
      const { data: likesData } = await supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", postsIds);

      if (likesData) {
        likesData.forEach((like) => {
          likesByPost[like.post_id] = (likesByPost[like.post_id] || 0) + 1;
        });

        if (user) {
          likesData
            .filter((l) => l.user_id === user.id)
            .forEach((l) => {
              likedByUser[l.post_id] = true;
            });
        }
      }
    }

      const { data: commentsData } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postsIds);

      if (commentsData) {
        commentsData.forEach((c) => {
          commentsByPost[c.post_id] =
            (commentsByPost[c.post_id] || 0) + 1;
      });
    }

    const enrichedPosts = postsData.map((post) => ({
      ...post,
      likeCount: likesByPost[post.id] || 0,
      commentsCount: commentsByPost[post.id] || 0,
      userLiked: likedByUser[post.id] || false,
    }));


    setPosts(enrichedPosts);
    setPendingPostCount(
      enrichedPosts.filter((p) => p.status === "pending").length
    );
    setLoading(false);
    setEventMeta(event);
    setCurrentUser(user || null);
  }

  useEffect(() => {
    loadPosts();
  }, [eventId]);

  // Auto-poll every 15 s so the organizer sees new pending posts
  // without a manual page reload.
  useEffect(() => {
    if (!isOrganizer) return;
    pollRef.current = setInterval(loadPosts, 15000);
    return () => clearInterval(pollRef.current);
  }, [isOrganizer, eventId]);

  const isOrganizer =
    currentUser && eventMeta && eventMeta.creator_id === currentUser.id;

  const isPrivate = eventMeta?.is_private;

  // regra de quem pode comentar:
  // - evento privado: qualquer logado
  // - evento público: só RSVP going/maybe ou organizador
  const [canComment, setCanComment] = useState(false);

  useEffect(() => {
    async function checkRsvp() {
      if (!currentUser || !eventMeta) {
        setCanComment(false);
        return;
      }

      if (eventMeta.is_private) {
        setCanComment(true);
        return;
      }

      // evento público: checar RSVP
      const { data, error } = await supabase
        .from("rsvps")
        .select("status")
        .eq("event_id", eventId)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao checar RSVP:", error);
        setCanComment(false);
        return;
      }

      const status = data?.status;
      setCanComment(
        isOrganizer ||
          status === "going" ||
          status === "maybe"
      );
    }

    if (currentUser && eventMeta) {
      checkRsvp();
    }
  }, [currentUser, eventMeta, eventId, isOrganizer, rsvpStatus]);

  return (
    <div className={styles.feedBlock}>
      <div className={styles.feedHeader}>
        <h3 className={styles.sectionTitle}>Event Posts</h3>
        {isOrganizer && pendingPostCount > 0 && (
          <span className={styles.pendingPostBadge}>
            {pendingPostCount} pending
          </span>
        )}
        {isOrganizer && (
          <button
            className={styles.feedRefreshButton}
            onClick={loadPosts}
            title="Refresh posts"
          >
            ↻
          </button>
        )}
      </div>

      <EventPostComposer
        eventId={eventId}
        isPrivate={isPrivate}
        isOrganizer={isOrganizer}
        canComment={canComment}
        onPosted={loadPosts}
      />

      {loading && <p className={styles.placeholderText}>Loading…</p>}

      {!loading && posts.length === 0 && (
        <p className={styles.placeholderText}>
          No posts yet. Start the conversation ✨
        </p>
      )}

      {posts.map((post) => (
        <EventPostCard
          key={post.id}
          post={post}
          isOrganizer={isOrganizer}
          canComment={canComment}
          onChange={loadPosts}
        />
      ))}
    </div>
  );
}
