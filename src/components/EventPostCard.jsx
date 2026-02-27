import { useState } from "react";
import { supabase } from "../supabase/client";
import EventPostComments from "./EventPostComments";
import styles from "../pages/EventDetailsPage.module.css";

export default function EventPostCard({
  post,
  isOrganizer,
  canComment,
  onChange,
}) {
  const user = post.users || {};
  const initial = user.name ? user.name.charAt(0).toUpperCase() : "?";

  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [liked, setLiked] = useState(post.userLiked || false);
  const [localStatus, setLocalStatus] = useState(post.status || "approved");

  async function toggleLike() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) return;

    if (liked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (!error) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("likes").insert({
        post_id: post.id,
        user_id: currentUser.id,
      });

      if (!error) {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    }
  }

  async function approvePost() {
    const { error } = await supabase
      .from("posts")
      .update({ status: "approved" })
      .eq("id", post.id);

    if (!error) {
      setLocalStatus("approved");
      onChange && onChange();
    }
  }

  async function deletePost() {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (!error) {
      onChange && onChange();
    }
  }

  const isPending = localStatus === "pending";

  return (
    <div className={styles.postCard}>
      <div className={styles.postHeader}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className={styles.postAvatar} />
        ) : (
          <div className={styles.postAvatarFallback}>{initial}</div>
        )}

        <div>
          <p className={styles.postName}>{user.name || "User"}</p>
          <p className={styles.postDate}>
            {new Date(post.created_at).toLocaleString("en-US", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {isPending && isOrganizer && (
            <span className={styles.postPendingBadge}>
              Pending approval
            </span>
          )}
        </div>
      </div>

      {post.text && <p className={styles.postText}>{post.text}</p>}

      {post.image_url && (
        <img src={post.image_url} alt="" className={styles.postImage} />
      )}

      <div className={styles.postFooter}>
        <button
          className={`${styles.likeButton} ${
            liked ? styles.likeButtonActive : ""
          }`}
          onClick={toggleLike}
        >
          ❤️ <span>{likeCount}</span>
        </button>

        <span className={styles.commentCount}>
          💬 {post.commentsCount}
        </span>

        <EventPostComments
          postId={post.id}
          canComment={canComment}
          isOrganizer={isOrganizer}
          onChange={onChange}
        />

        {isOrganizer && (
          <div className={styles.postAdminActions}>
            {isPending && (
              <button
                className={styles.postApprove}
                onClick={approvePost}
              >
                Approve
              </button>
            )}
            <button className={styles.postDelete} onClick={deletePost}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
