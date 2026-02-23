// src/pages/Create/EventCreateForm.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Button from "../../components/ui/Button";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import styles from "./EventCreateForm.module.css";

/* 🔽 ADIÇÃO (PRO, sem bug) */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
/* 🔼 ADIÇÃO */

function toast(msg) {
  const div = document.createElement("div");
  div.className = styles.toast;
  div.innerText = msg;

  document.body.appendChild(div);

  setTimeout(() => div.classList.add(styles.toastShow), 10);
  setTimeout(() => {
    div.classList.remove(styles.toastShow);
    setTimeout(() => div.remove(), 250);
  }, 2300);
}

function toDatetimeLocal(value) {
  if (!value) return "";

  // já está no formato certo
  if (typeof value === "string" && value.includes("T")) {
    return value.slice(0, 16);
  }

  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}


export default function EventCreateForm() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState("party");
  const [locationField, setLocationField] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [price, setPrice] = useState("");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const isPaid = state?.is_paid ?? false;


  useEffect(() => {
  let source = state;

  if (!source) {
    try {
      const raw = sessionStorage.getItem("vg_create_event_draft");
      if (raw) source = JSON.parse(raw);
    } catch {}
  }

  if (!source) return;

  setTitle(source.title || "");
  setDescription(source.description || "");
  if (source.event_date) {
  setEventDate(toDatetimeLocal(source.event_date));
}else {
  const now = new Date();
  const formatted =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0") +
    "T" +
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");

  setEventDate(formatted);
}

  setCategory(source.category || "party");
  setLocationField(source.location || "");
  setOnlineUrl(source.online_url || "");
  setPrice(source.price || "");
  setPreviewUrl(source.image_url || null);
}, [state]);




  /* 🔽 ADIÇÃO (editor real, sem bug de cursor) */
  const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
  ],
  content: "",
  onUpdate({ editor }) {
    setDescription(editor.getHTML());
  },
});

useEffect(() => {
  if (!editor) return;
  if (!description) return;

  editor.commands.setContent(description);
}, [editor]);


  /* 🔼 ADIÇÃO */

  async function resizeAndCompressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const MAX_SIZE = 1600; // px
      let { width, height } = img;

      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.8 // compressão (0.7–0.85 é o sweet spot)
      );
    };

    reader.readAsDataURL(file);
  });
}


  async function handleFileChange(e) {
  const selected = e.target.files?.[0];
  if (!selected) return;

  const optimized = await resizeAndCompressImage(selected);

  setFile(optimized);
  setPreviewUrl(URL.createObjectURL(optimized));
}


  async function uploadImage() {
    if (!file && previewUrl) return previewUrl;
    if (!file) return null;
    if (!user?.id) {
      toast("Session is still loading. Try again.");
      return null;
    }
    const fileName = `${user.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("event-images")
      .upload(fileName, file);
    if (error) {
      toast("Error uploading image.");
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("event-images")
      .getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  }

  const storedDraft = (() => {
  try {
    const raw = sessionStorage.getItem("vg_create_event_draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const resolvedIsPublic =
  state?.is_public ??
  storedDraft?.is_public ??
  true; // fallback seguro

  const resolvedEventFormat =
  state?.event_format ??
  storedDraft?.event_format ??
  "in_person"; // fallback seguro

  const resolvedIsPaid =
  state?.is_paid ??
  storedDraft?.is_paid ??
  false; // fallback seguro (gratuito só se nunca foi pago)


  async function goToReview() {
    if (isSaving) return;
    if (authLoading) return toast("Loading session... try again.");
    if (!user?.id) {
      toast("You need to be logged in to create an event.");
      navigate("/login", { replace: true });
      return;
    }
    if (!title) return toast("Title is required.");
    if (!eventDate) return toast("Date is required.");
    if (state?.event_format === "in_person" && !locationField)
      return toast("Address is required.");
    if (state?.event_format === "online" && !onlineUrl)
      return toast("Link is required.");
    if (state?.is_paid && (!price || Number(price) <= 0))
      return toast("Invalid price.");

    setIsSaving(true);
    const finalImageUrl = await uploadImage();
    if (!finalImageUrl) {
      setIsSaving(false);
      return toast("Please choose a valid image.");
    }

    const draft = {
      event_id: state?.event_id ?? null,
      title,
      description,
      event_date: eventDate,
      category,
      location: locationField,
      online_url: onlineUrl,
      price: resolvedIsPaid ? price : null,
      is_paid: resolvedIsPaid,
      is_public: resolvedIsPublic,
      event_format: resolvedEventFormat,
      image_url: finalImageUrl,
    };
    sessionStorage.setItem("vg_create_event_draft", JSON.stringify(draft));

    navigate("/create/review", {
      state: { ...draft, fromReview: true },
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>Step 4 of 5 · Details</div>
      </div>

      <h2 className={styles.title}>Event Details</h2>

      <div className={styles.card}>
        <input
          className={styles.input}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      

      {/* 🔽 ÚNICA TROCA VISUAL/FUNCIONAL */}
      <div className={styles.card}>
        <EditorContent
          editor={editor}
          className={styles.descriptionInput}
        />
      </div>
      {/* 🔼 */}

      <div className={styles.card}>
        <input
          className={styles.input}
          type="datetime-local"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div className={styles.card}>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="party">Party</option>
          <option value="show">Show</option>
          <option value="teather">Theater</option>
          <option value="birthday">Birthday</option>
          <option value="class">Classes</option>
          <option value="workshop">Workshop</option>
          <option value="sport">Sports</option>
          <option value="art">Art</option>
          <option value="culture">Culture</option>
        </select>
      </div>

      {state?.event_format === "in_person" && (
        <div className={styles.card}>
          <input
            className={styles.input}
            placeholder="Address"
            value={locationField}
            onChange={(e) => setLocationField(e.target.value)}
          />
        </div>
      )}

      {state?.event_format === "online" && (
        <div className={styles.card}>
          <input
            className={styles.input}
            placeholder="Stream URL"
            value={onlineUrl}
            onChange={(e) => setOnlineUrl(e.target.value)}
          />
        </div>
      )}

      {(state?.is_paid ?? JSON.parse(sessionStorage.getItem("vg_create_event_draft"))?.is_paid) && (

        <div className={styles.card}>
          <input
            className={styles.input}
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      )}

      <div className={styles.card}>
        <label className={styles.fileLabel}>
          {previewUrl ? (
            <img src={previewUrl} className={styles.preview} alt="preview" />
          ) : (
            "Choose a cover image"
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
        </label>
      </div>

      <Button onClick={goToReview} disabled={isSaving}>
        {isSaving ? "Processing..." : "Review Event"}
      </Button>
    </div>
  );
}
