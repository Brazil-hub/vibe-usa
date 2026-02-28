// src/pages/Create/ReviewEvent.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import styles from "./ReviewEvent.module.css";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { draftFileStore } from "./draftFileStore";

export default function ReviewEvent() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;
  const { showToast, ToastComponent } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);

  const state = useMemo(() => {
    let data = null;
    try {
      const raw = sessionStorage.getItem("vg_create_event_draft");
      if (raw) data = JSON.parse(raw);
    } catch {
      // ignore JSON parse error
    }
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
    if (authLoading) { showToast("Loading session…"); return; }
    if (!user?.id)   { navigate("/login", { replace: true }); return; }
    if (isPublishing) return;

    setIsPublishing(true);

    try {
      // 1. Verify session is alive
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Session expired — please sign in again");
        navigate("/login", { replace: true });
        return;
      }

      // 2. Upload image if we have a blob URL (upload deferred from form step)
      let imageUrl = state.image_url || "";

      if (imageUrl.startsWith("blob:")) {
        try {
          const file = draftFileStore.get();
          if (file && user?.id) {
            const fileName = `${user.id}-${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from("event-images")
              .upload(fileName, file);

            if (uploadError) {
              console.error("❌ Upload error:", uploadError);
              imageUrl = ""; // publish without image rather than blocking
            } else {
              imageUrl =
                supabase.storage.from("event-images").getPublicUrl(fileName)
                  .data?.publicUrl || "";
              draftFileStore.clear();
            }
          } else {
            imageUrl = "";
          }
        } catch (uploadEx) {
          console.error("❌ Upload exception:", uploadEx);
          imageUrl = ""; // don't block publish if upload fails
        }
      }

      // 3. Build payload
      const isPrivate = state.is_public === false;
      const payload = {
        title:        state.title,
        description:  state.description,
        event_date:   state.event_date,
        category:     state.category,
        event_format: state.event_format,
        location:     state.location   || null,
        online_url:   state.online_url || null,
        image_url:    imageUrl         || null,
        is_paid:      !!state.is_paid,
        price:        state.is_paid ? Number(state.price) : null,
        is_private:   isPrivate,
        is_public:    !isPrivate,
      };

      const eventId = state?.event_id ?? state?.id ?? null;
      let error;

      if (eventId) {
        ({ error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", eventId)
          .eq("creator_id", user.id)
          .select()
          .single());
      } else {
        ({ error } = await supabase
          .from("events")
          .insert({ ...payload, creator_id: user.id, status: "pending" })
          .select()
          .single());
      }

      if (error) {
        console.error("❌ Event save error:", error);
        showToast(error.message || "Error saving event");
        return;
      }

      draftFileStore.clear();
      sessionStorage.removeItem("vg_create_event_draft");
      showToast(eventId ? "Event updated ✨" : "Event created ✨");
      setTimeout(() => navigate("/"), 800);

    } catch (unexpectedErr) {
      console.error("❌ Unexpected publish error:", unexpectedErr);
      showToast(unexpectedErr?.message || "Unexpected error — try again");
    } finally {
      setIsPublishing(false);
    }
  }

  if (!state) return null;

  const {
    title, description, event_date, category, event_format,
    location: loc, online_url, image_url, is_paid, price, is_public,
  } = state;

  // Human-readable date
  const dateLabel = event_date
    ? new Date(event_date).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>Step 5 of 5 · Review</div>
      </div>

      <h2 className={styles.title}>Review your event</h2>

      {image_url && (
        <img src={image_url} className={styles.cover} alt="cover" />
      )}

      <div className={styles.card}><span>Title</span><p>{title}</p></div>

      {description && (
        <div className={styles.card}>
          <span>Description</span>
          <div
            className={styles.descHtml}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </div>
      )}

      <div className={styles.card}><span>Date</span><p>{dateLabel}</p></div>
      <div className={styles.card}><span>Category</span><p>{category}</p></div>
      <div className={styles.card}><span>Format</span><p>{event_format}</p></div>
      <div className={styles.card}>
        <span>Visibility</span>
        <p>{is_public !== false ? "Public" : "Private"}</p>
      </div>

      {loc && (
        <div className={styles.card}><span>Address</span><p>{loc}</p></div>
      )}
      {online_url && (
        <div className={styles.card}><span>Link</span><p>{online_url}</p></div>
      )}

      <div className={styles.card}>
        <span>Price</span>
        <p>{is_paid ? `$${price}` : "Free"}</p>
      </div>

      <div className={styles.buttons}>
        <Button
          onClick={() =>
            navigate("/create/form", {
              state: { ...state, fromReview: true },
            })
          }
        >
          ← Edit
        </Button>

        <Button onClick={publish} disabled={isPublishing}>
          {isPublishing ? "Publishing…" : "Publish Event 🚀"}
        </Button>
      </div>

      {ToastComponent}
    </div>
  );
}
