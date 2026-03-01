import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import EventPostAddComment from "./EventPostAddComment";
import styles from "../pages/EventDetailsPage.module.css";

export default function EventPostComments({
  postId,
  canComment,
  isOrganizer,
  onChange,
}) {
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Get current user id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  async function loadComments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("comments")
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
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading comments:", error);
      setComments([]);
    } else {
      const rows = data || [];
      setComments(rows);
      // Count pending for the organizer badge
      setPendingCount(rows.filter((c) => c.status === "pending").length);
    }

    setLoading(false);
  }

  // Reload when the section opens, when isOrganizer is confirmed,
  // or when postId changes.
  useEffect(() => {
    if (open) loadComments();
  }, [open, postId, isOrganizer]);

  // Poll for new pending comments while the section is open (organizer only)
  useEffect(() => {
    if (!isOrganizer || !open) return;
    const interval = setInterval(loadComments, 15000); // every 15 s
    return () => clearInterval(interval);
  }, [isOrganizer, open, postId]);

  async function handleApprove(id) {
    const { error } = await supabase
      .from("comments")
      .update({ status: "approved" })
      .eq("id", id);

    if (!error) {
      loadComments();
      onChange && onChange();
    }
  }

  async function handleDelete(id) {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", id);

    if (!error) {
      loadComments();
      onChange && onChange();
    }
  }

  return (
    <div className={styles.commentsContainer}>
      <div className={styles.commentsToggleRow}>
        <button
          className={styles.commentsToggle}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Hide comments" : "Comments"}
        </button>

        {/* Badge showing pending count to organizer even when section is closed */}
        {isOrganizer && pendingCount > 0 && !open && (
          <span className={styles.pendingCountBadge}>
            {pendingCount} pending
          </span>
        )}

        {/* Refresh button for organizer when section is open */}
        {isOrganizer && open && (
          <button
            className={styles.refreshButton}
            onClick={loadComments}
            title="Refresh comments"
          >
            ↻
          </button>
        )}
      </div>

      {open && (
        <>
          {canComment && (
            <EventPostAddComment
              postId={postId}
              onComment={loadComments}
              isOrganizer={isOrganizer}
            />
          )}

          {loading && (
            <p className={styles.placeholderText}>Loading comments…</p>
          )}

          {!loading && comments.length === 0 && (
            <p className={styles.placeholderText}>No comments yet.</p>
          )}

          {!loading &&
            comments.map((comment) => {
              const user = comment.users || {};
              const initial = user.name
                ? user.name.charAt(0).toUpperCase()
                : "?";

              const isPending = comment.status === "pending";
              const isOwnPending =
                isPending && comment.user_id === currentUserId;

              return (
                <div
                  key={comment.id}
                  className={`${styles.commentItem} ${
                    isPending ? styles.commentPending : ""
                  }`}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className={styles.commentAvatar}
                    />
                  ) : (
                    <div className={styles.commentAvatarFallback}>
                      {initial}
                    </div>
                  )}

                  <div className={styles.commentBody}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentName}>
                        {user.name || "User"}
                      </span>
                      <span className={styles.commentDate}>
                        {new Date(comment.created_at).toLocaleString("en-US", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {isOwnPending && !isOrganizer && (
                        <span className={styles.commentPendingBadge}>
                          pending review
                        </span>
                      )}

                      {isPending && isOrganizer && (
                        <span className={styles.commentPendingBadge}>
                          pending
                        </span>
                      )}
                    </div>

                    {comment.text && (
                      <p className={styles.commentText}>{comment.text}</p>
                    )}

                    {comment.image_url && (
                      <img
                        src={comment.image_url}
                        alt=""
                        className={styles.commentImage}
                      />
                    )}

                    {isOrganizer && (
                      <div className={styles.commentActions}>
                        {isPending && (
                          <button
                            onClick={() => handleApprove(comment.id)}
                            className={styles.commentApprove}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className={styles.commentDelete}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </>
      )}
    </div>
  );
}
