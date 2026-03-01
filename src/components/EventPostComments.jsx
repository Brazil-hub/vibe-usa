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

  async function loadComments() {
    setLoading(true);

    let query = supabase
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

    if (!isOrganizer) {
      query = query.eq("status", "approved");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading comments:", error);
      setComments([]);
    } else {
      setComments(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, postId]);

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
      <button
        className={styles.commentsToggle}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Hide comments" : "Comments"}
      </button>

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

              return (
                <div key={comment.id} className={styles.commentItem}>
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
                        {new Date(comment.created_at).toLocaleString(
                          "en-US",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
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
                        {comment.status === "pending" && (
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
