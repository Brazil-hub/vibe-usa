// src/pages/Create/ReviewEvent.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import Button from "../../components/ui/Button";
import styles from "./ReviewEvent.module.css";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";

export default function ReviewEvent() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;
  const { showToast, ToastComponent } = useToast();

  const state = useMemo(() => {
  let data = null;

  try {
    const raw = sessionStorage.getItem("vg_create_event_draft");
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
  if (authLoading) {
    showToast("Loading session...");
    return;
  }

  if (!user?.id) {
    navigate("/login", { replace: true });
    return;
  }

  const eventId = state?.event_id ?? state?.id ?? null;

  const payload = {
    title: state.title,
    description: state.description,
    event_date: state.event_date,
    category: state.category,
    event_format: state.event_format,
    location: state.location || null,
    online_url: state.online_url || null,
    image_url: state.image_url || null,
    is_paid: !!state.is_paid,
    price: state.is_paid ? Number(state.price) : null,
    is_private: state.is_public === false,
  };

  let error;

  if (eventId) {
    ({ error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", eventId)
      .eq("creator_id", user.id));
  } else {
    ({ error } = await supabase.from("events").insert({
      ...payload,
      creator_id: user.id,
      status: "pending",
    }));
  }

  if (error) {
    showToast("Error saving event");
    return;
  }

  sessionStorage.removeItem("vg_create_event_draft");
  showToast(eventId ? "Event updated ✨" : "Event created ✨");
  setTimeout(() => navigate("/"), 800);
}



  if (!state) return null;

  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>Step 5 of 5 · Review</div>
      </div>

      <h2 className={styles.title}>Review Event</h2>

      {state.image_url && (
        <img src={state.image_url} className={styles.cover} alt="cover" />
      )}

      <div className={styles.card}><span>Title</span><p>{state.title}</p></div>
      <div className={styles.card}><span>Description</span><p>{state.description}</p></div>
      <div className={styles.card}><span>Date</span><p>{state.event_date}</p></div>
      <div className={styles.card}><span>Category</span><p>{state.category}</p></div>
      <div className={styles.card}><span>Format</span><p>{state.event_format}</p></div>
      <div className={styles.card}><span>Visibility</span><p>{state.is_public ? "Public" : "Private"}</p></div>

      {state.location && (
        <div className={styles.card}><span>Address</span><p>{state.location}</p></div>
      )}

      {state.online_url && (
        <div className={styles.card}><span>Link</span><p>{state.online_url}</p></div>
      )}

      <div className={styles.card}>
        <span>Price</span>
        <p>{state.is_paid ? `$${state.price}` : "Free"}</p>
      </div>

      <div className={styles.buttons}>
  <Button
    onClick={() =>
      navigate("/create/form", {
        state: { ...state, fromReview: true },
      })
    }
  >
    Back
  </Button>

  <Button onClick={publish}>Publish</Button>
</div>


      {ToastComponent}
    </div>
  );
}
