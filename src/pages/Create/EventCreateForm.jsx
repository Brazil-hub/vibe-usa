// src/pages/Create/EventCreateForm.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Button from "../../components/ui/Button";
import { useAuth } from "../../auth/useAuth";
import styles from "./EventCreateForm.module.css";
import { useToast } from "../../hooks/useToast";
import { DRAFT_SESSION_KEY } from "../../constants";
import { draftFileStore } from "./draftFileStore";
import LocationMapPicker from "../../components/LocationMapPicker";
import PhotoCropPicker from "../../components/PhotoCropPicker";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

function toDatetimeLocal(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) return value.slice(0, 16);
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
  );
}


export default function EventCreateForm() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;
  const { showToast, ToastComponent } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState("party");
  const [locationField, setLocationField] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [onlineUrl, setOnlineUrl] = useState("");
  const [price, setPrice] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCropPicker, setShowCropPicker] = useState(false);

  // ── Resolved meta values (nav state → sessionStorage → safe fallback) ──
  const storedDraft = (() => {
    try { const r = sessionStorage.getItem(DRAFT_SESSION_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  })();
  const resolvedIsPublic    = state?.is_public    ?? storedDraft?.is_public    ?? true;
  const resolvedEventFormat = state?.event_format ?? storedDraft?.event_format ?? "in_person";
  const resolvedIsPaid      = state?.is_paid      ?? storedDraft?.is_paid      ?? false;

  // ── Load draft ──────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Always try sessionStorage first — it has the full event object when
    //    coming from handleEditEvent (dashboard edit).
    let source = null;
    try {
      const r = sessionStorage.getItem(DRAFT_SESSION_KEY);
      if (r) source = JSON.parse(r);
    } catch {}

    // 2. Merge nav state on top (higher priority for its own fields).
    //    When editing from dashboard, nav state is { id, fromDashboardEdit }
    //    with no form fields — so sessionStorage data wins for those.
    if (state) source = source ? { ...source, ...state } : state;

    if (!source) return;

    setTitle(source.title || "");
    setDescription(source.description || "");

    if (source.event_date) {
      setEventDate(toDatetimeLocal(source.event_date));
    } else {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      setEventDate(
        now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
        "T" + pad(now.getHours()) + ":" + pad(now.getMinutes())
      );
    }

    setCategory(source.category || "party");
    setLocationField(source.location || "");
    setLat(source.lat ?? null);
    setLng(source.lng ?? null);
    setOnlineUrl(source.online_url || "");
    setPrice(source.price || "");

    // Blob URLs are still valid within the same SPA session
    if (source.image_url) setPreviewUrl(source.image_url);
  }, [state]);

  // ── TipTap ──────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: "",
    onUpdate({ editor }) { setDescription(editor.getHTML()); },
  });

  const editorSynced = useRef(false);
  useEffect(() => {
    // Re-runs when editor initialises OR description first loads from draft.
    // The ref prevents resetting content while the user is typing.
    if (!editor || editorSynced.current || !description) return;
    editorSynced.current = true;
    editor.commands.setContent(description);
  }, [editor, description]);

  // ── Navigate to review ──────────────────────────────────────────────────
  // Image is NOT uploaded here — the blob URL travels with the draft and the
  // actual Supabase upload happens when the user hits Publish in ReviewEvent.
  function goToReview() {
    if (authLoading) return showToast("Loading session... try again.");
    if (!user?.id) {
      showToast("You need to be logged in to create an event.");
      navigate("/login", { replace: true });
      return;
    }
    if (!title)                                                return showToast("Title is required.");
    if (!eventDate)                                            return showToast("Date is required.");
    if (resolvedEventFormat === "in_person" && !locationField) return showToast("Address is required.");
    if (resolvedEventFormat === "online"    && !onlineUrl)     return showToast("Link is required.");
    if (resolvedIsPaid && (!price || Number(price) <= 0))      return showToast("Invalid price.");

    const draft = {
      event_id:     state?.event_id ?? state?.id ?? null,
      title,
      description,
      event_date:   eventDate,
      category,
      location:     locationField,
      lat:          lat,
      lng:          lng,
      online_url:   onlineUrl,
      price:        resolvedIsPaid ? price : null,
      is_paid:      resolvedIsPaid,
      is_public:    resolvedIsPublic,
      event_format: resolvedEventFormat,
      // blob URL or existing http URL — upload happens at publish time
      image_url:    previewUrl || "",
    };

    sessionStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify(draft));
    navigate("/create/review", { state: { ...draft, fromReview: true } });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>
          {state?.fromDashboardEdit ? "Edit Event" : "Create Event"}
        </div>
        <div className={styles.processStep}>
          {state?.fromDashboardEdit ? "Edit Details" : "Step 4 of 5 · Details"}
        </div>
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

      <div className={styles.card}>
        <EditorContent editor={editor} className={styles.descriptionInput} />
      </div>

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

      {resolvedEventFormat === "in_person" && (
        <div className={styles.card}>
          <LocationMapPicker
            value={locationField}
            onChange={(addr, newLat, newLng) => {
              setLocationField(addr);
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </div>
      )}

      {resolvedEventFormat === "online" && (
        <div className={styles.card}>
          <input
            className={styles.input}
            placeholder="Stream URL"
            value={onlineUrl}
            onChange={(e) => setOnlineUrl(e.target.value)}
          />
        </div>
      )}

      {resolvedIsPaid && (
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
        {/* ── Cover image: thumbnail + swap, OR full crop picker ── */}
        {previewUrl && !showCropPicker ? (
          <div className={styles.coverPreviewWrap}>
            <img src={previewUrl} className={styles.coverThumb} alt="cover" />
            <button
              type="button"
              className={styles.changeCoverBtn}
              onClick={() => setShowCropPicker(true)}
            >
              ✎ Change / Recrop
            </button>
          </div>
        ) : (
          <PhotoCropPicker
            onCrop={(blob, url) => {
              draftFileStore.set(blob);
              setPreviewUrl(url);
              setShowCropPicker(false);
            }}
          />
        )}
      </div>

      <Button onClick={goToReview}>
        {state?.fromDashboardEdit ? "Review Changes" : "Review Event"}
      </Button>

      {ToastComponent}
    </div>
  );
}
