import { useState } from "react";
import { supabase } from "../supabase/client";
import styles from "../pages/EventDetailsPage.module.css";

export default function EventPostComposer({
  eventId,
  isPrivate,
  isOrganizer,
  canComment,
  onPosted,
}) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  const disabled = !canComment && !isOrganizer;

  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    // compressão básica
    const image = await new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => resolve(img);
    });

    const canvas = document.createElement("canvas");
    const MAX_WIDTH = 1080;

    const scale = MAX_WIDTH / image.width;
    const width = Math.min(MAX_WIDTH, image.width);
    const height = image.height * (image.width > MAX_WIDTH ? scale : 1);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.75)
    );

    const fileName = `${eventId}-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("event-images")
      .upload(fileName, blob, {
        contentType: "image/jpeg",
      });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from("event-images")
        .getPublicUrl(fileName);

      setImageUrl(urlData.publicUrl);
    } else {
      console.error("Erro ao subir imagem:", error);
    }

    setUploading(false);
  }

  async function submitPost() {
    if (disabled) return;
    if (!text && !imageUrl) return;

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      return;
    }

    // regra de status
    let status = "pending";
    if (isPrivate || isOrganizer) {
      status = "approved";
    }

    const { error } = await supabase.from("posts").insert({
      event_id: eventId,
      user_id: user.id,
      text,
      image_url: imageUrl || null,
      status,
    });

    if (error) {
      console.error("Erro ao criar post:", error);
    } else {
  setText("");
  setImageUrl(null);
  setPosted(true);
  onPosted && onPosted();
  setTimeout(() => setPosted(false), 3000);
}

    setSubmitting(false);
  }

  return (
    <div className={styles.composerBox}>
      <textarea
        className={styles.composerInput}
        placeholder={
          disabled
            ? "RSVP to comment on this event."
            : "Write something…"
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || submitting}
      />

      {imageUrl && (
        <img src={imageUrl} alt="" className={styles.composerPreview} />
      )}

      <div className={styles.composerActions}>
        <label
          className={`${styles.composerButton} ${
            disabled ? styles.composerButtonDisabled : ""
          }`}
        >
          📷
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={uploadImage}
            disabled={disabled || uploading}
          />
        </label>

        <button
          onClick={submitPost}
          className={styles.composerSubmit}
          disabled={disabled || submitting || posted || (!text && !imageUrl)}
        >
          {posted
            ? "Post sent ✅"
            : isPrivate || isOrganizer
            ? "Post"
            : "Post Comment"}
        </button>

      </div>
    </div>
  );
}
