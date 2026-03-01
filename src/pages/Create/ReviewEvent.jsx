// src/pages/Create/ReviewEvent.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EventCard from "../../components/EventCard";
import styles from "./ReviewEvent.module.css";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { DRAFT_SESSION_KEY } from "../../constants";
import { draftFileStore } from "./draftFileStore";

export default function ReviewEvent() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;
  const { showToast, ToastComponent } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);

  // Merge sessionStorage draft with navigation state (nav state wins)
  const state = useMemo(() => {
    let data = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_SESSION_KEY);
      if (raw) data = JSON.parse(raw);
    } catch {}
    if (location.state) {
      data = { ...data, ...location.state };
    }
    return data;
  }, [location.state]);

  useEffect(() => {
    if (!state) {
      navigate("/create/visibility", { replace: true });
    }
  }, [state, navigate]);

  async function publish() {
    if (authLoading) { showToast("Loading session..."); return; }
    if (!user?.id)   { navigate("/login", { replace: true }); return; }
    if (isPublishing) return;

    setIsPublishing(true);

    try {
      // ── Verify Supabase session ──────────────────────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Session expired — please sign in again");
        navigate("/login", { replace: true });
        return;
      }
      console.log("✅ Session OK, user:", session.user.id);

      // ── Upload cover image ──────────────────────────────────────────────
      // The form defers the upload. Upload happens here, but any failure is
      // non-blocking — the event is still published without a cover photo.
      let imageUrl = state.image_url || "";

      if (imageUrl.startsWith("blob:")) {
        try {
          const file = draftFileStore.get();
          if (file && user?.id) {
            // Always use a clean filename — avoids spaces/special chars that
            // break Supabase Storage URLs. resizeAndCompressImage outputs JPEG.
            const fileName = `${user.id}-${Date.now()}.jpg`;
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from("event-images")
              .upload(fileName, file, { contentType: "image/jpeg" });

            if (uploadError) {
              console.warn("Cover upload error:", uploadError);
              showToast(`Image upload failed: ${uploadError.message}`);
              imageUrl = "";
            } else {
              console.log("Cover uploaded:", uploadData);
              const { data: urlData } = supabase.storage
                .from("event-images")
                .getPublicUrl(fileName);
              imageUrl = urlData?.publicUrl || "";
              draftFileStore.clear();
            }
          } else {
            // File was lost (page refresh between steps) — publish without image
            console.warn("draftFileStore empty — publishing without image");
            showToast("Image was lost (page was refreshed) — publishing without cover photo");
            imageUrl = "";
          }
        } catch (uploadEx) {
          console.warn("Cover upload threw:", uploadEx);
          showToast(`Image upload error: ${uploadEx?.message || "unknown error"}`);
          imageUrl = "";
        }
      }

      const eventId = state?.event_id ?? state?.id ?? null;
      const isPrivate = state.is_public === false;

      const payload = {
        title:        state.title,
        description:  state.description,
        event_date:   state.event_date,
        category:     state.category,
        event_format: state.event_format,
        location:     state.location   || null,
        lat:          state.lat        ?? null,
        lng:          state.lng        ?? null,
        online_url:   state.online_url || null,
        image_url:    imageUrl         || null,
        is_paid:      !!state.is_paid,
        price:        state.is_paid ? Number(state.price) : null,
        is_private:   isPrivate,
        is_public:    !isPrivate,
      };

      console.log("📤 Saving event payload:", payload);

      let error;
      if (eventId) {
        ({ error } = await supabase
          .from("events").update(payload)
          .eq("id", eventId).eq("creator_id", user.id)
          .select().single());
      } else {
        ({ error } = await supabase
          .from("events")
          .insert({ ...payload, creator_id: user.id, status: "pending" })
          .select()
          .single());
      }

      if (error) {
        console.error("❌ Event save error:", error);
        showToast(error.message || error.details || "Error saving event");
        return;
      }

      draftFileStore.clear();
      sessionStorage.removeItem(DRAFT_SESSION_KEY);
      showToast(eventId ? "Event updated ✨" : "Event created ✨");
      setTimeout(() => navigate("/"), 800);

    } catch (unexpectedErr) {
      console.error("❌ Unexpected publish error:", unexpectedErr);
      showToast(unexpectedErr?.message || "Unexpected error — please try again");
    } finally {
      setIsPublishing(false);
    }
  }

  if (!state) return null;

  // ── Build the EventCard preview props ──────────────────────────────────────
  const date = state.event_date ? new Date(state.event_date) : null;

  const dateLabel = date
    ? date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  const timeLabel = date
    ? date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  const previewEvent = {
    id: "preview",
    title: state.title || "Untitled Event",
    image_url: state.image_url || undefined,
    category: state.category || null,
    is_paid: !!state.is_paid,
    price: state.price || null,
    event_date: state.event_date || null,
    date_label: dateLabel,
    time_label: timeLabel,
    venue_name: state.event_format === "in_person" ? (state.location || null) : null,
    city: null,
  };

  const visibilityLabel = state.is_public === false ? "Private 🔒" : "Public";
  const formatLabel = state.event_format === "online" ? "Online" : "In person";

  // Description is empty if TipTap only has an empty paragraph
  const hasDescription =
    state.description &&
    state.description !== "<p></p>" &&
    state.description !== "<p> </p>";

  return (
    <div className={styles.container}>
      {/* ── Step header ── */}
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>
          {state?.event_id ? "Edit Event" : "Create Event"}
        </div>
        <div className={styles.processStep}>
          {state?.event_id ? "Review Changes" : "Step 5 of 5 · Review"}
        </div>
      </div>

      {/* ── Preview label ── */}
      <div className={styles.previewLabel}>
        <span className={styles.previewLabelText}>Feed preview</span>
        <span className={styles.previewLabelSub}>
          This is exactly how your event looks in the feed.
        </span>
      </div>

      {/* ── EventCard (non-clickable wrapper) ── */}
      <div className={styles.previewWrap}>
        <EventCard event={previewEvent} />
      </div>

      {/* ── Meta badges (visibility / format / price) ── */}
      <div className={styles.metaRow}>
        <span className={styles.metaBadge}>{visibilityLabel}</span>
        <span className={styles.metaBadge}>{formatLabel}</span>
        {state.is_paid && state.price ? (
          <span className={styles.metaBadgePink}>
            ${Number(state.price).toFixed(2)}
          </span>
        ) : (
          <span className={styles.metaBadge}>Free</span>
        )}
      </div>

      {/* ── Extra cards ── */}
      <div className={styles.cards}>
        {/* Online URL */}
        {state.event_format === "online" && state.online_url && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>🔗 Stream Link</span>
            <p className={styles.cardValue}>{state.online_url}</p>
          </div>
        )}

        {/* Description */}
        {hasDescription && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>📝 Description</span>
            <div
              className={styles.cardDesc}
              dangerouslySetInnerHTML={{ __html: state.description }}
            />
          </div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          onClick={() =>
            navigate("/create/form", { state: { ...state, fromReview: true } })
          }
        >
          ← Edit
        </Button>
        <Button onClick={publish} disabled={isPublishing}>
          {isPublishing ? "Publishing…" : state.event_id ? "Save Changes" : "Publish Event 🚀"}
        </Button>
      </div>

      {ToastComponent}
    </div>
  );
}
