import { useState } from "react";
import { supabase } from "../supabase/client";
import styles from "../pages/EventDetailsPage.module.css";

/**
 * Compactação agressiva para comentários
 * - reduz resolução
 * - converte para JPEG
 * - ~80% menor
 */
async function compressForComment(file) {
  const QUALITY = 0.8; // 80% menor
  const MAX = 800;   // limite de resolução

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;

  if (width > height && width > MAX) {
    height = Math.round((height * MAX) / width);
    width = MAX;
  } else if (height > MAX) {
    width = Math.round((width * MAX) / height);
    height = MAX;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  );

  if (!blob) throw new Error("Failed to compress image");

  const safeName = (file.name || "comment")
    .replace(/\.(png|jpg|jpeg|webp|heic|heif)$/i, "")
    .slice(0, 40);

  return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
}

export default function EventPostAddComment({ postId, onComment }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressForComment(file);

      console.log(
        "Original image (KB):",
        Math.round(file.size / 1024),
        "→ compressed (KB):",
        Math.round(compressed.size / 1024)
      );

      setImageFile(compressed);
    } catch (err) {
      console.error("Error compressing image:", err);
      setImageFile(file); // fallback
    }
  }

  async function submit() {
    if (!text.trim() && !imageFile) return;
    setSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    let image_url = null;

    if (imageFile) {
      const filePath = `${postId}/${user.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("comment-images")
        .upload(filePath, imageFile, {
          contentType: "image/jpeg",
        });

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
      } else {
        const { data } = supabase.storage
          .from("comment-images")
          .getPublicUrl(filePath);

        image_url = data.publicUrl;
      }
    }

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      text,
      image_url,
      status: "approved",
    });

    if (error) {
      console.error("Error posting comment:", error);
    } else {
      setText("");
      setImageFile(null);
      onComment && onComment();
    }

    setSending(false);
  }

  return (
    <div className={styles.commentComposer}>
      <input
        className={styles.commentInput}
        type="text"
        placeholder="Write a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={sending}
      />

      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        disabled={sending}
        className={styles.commentImageInput}
      />

      <button
        className={styles.commentSend}
        onClick={submit}
        disabled={sending || (!text.trim() && !imageFile)}
      >
        Send
      </button>
    </div>
  );
}
