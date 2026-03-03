import { useEffect, useState } from "react";
import { supabase } from "../../supabase/client";

export default function AdminReviewPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  function getPublicImageUrl(path) {
    if (!path) return null;

    // if already a full URL, return directly
    if (path.startsWith("http")) return path;

    // build Supabase Storage public URL
    const { data } = supabase.storage
      .from("event-images")
      .getPublicUrl(path);

    return data?.publicUrl || null;
  }

  async function loadPendingEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading pending events:", error);
      alert(error.message);
      setEvents([]);
    } else {
      setEvents(data || []);
    }

    setLoading(false);
  }

  async function setStatus(id, nextStatus) {
    setBusyId(id);

    const { data, error } = await supabase
      .from("events")
      .update({ status: nextStatus })
      .eq("id", id)
      .select("id");

    setBusyId(null);

    if (error || !data || data.length === 0) {
      alert("Error updating status");
      return;
    }

    loadPendingEvents();
  }

  useEffect(() => {
    loadPendingEvents();
  }, []);

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (!events.length)
    return <p style={{ padding: 16 }}>No pending events.</p>;

  return (
    <div style={{ padding: 16, maxWidth: 420 }}>
      <h2 style={{ marginBottom: 12 }}>Event Review</h2>

      {events.map((event) => {
        const imageUrl = getPublicImageUrl(event.image_url);

        return (
          <div
            key={event.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              background: "#fff",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 10,
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 8,
                  background: "#f3f3f3",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#777",
                  fontSize: 14,
                }}
              >
                No image
              </div>
            )}

            <h3 style={{ margin: "6px 0 4px" }}>{event.title}</h3>

            {event.description && (
              <div
                style={{ margin: "0 0 8px", color: "#444" }}
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            )}

            <p style={{ margin: "6px 0" }}>
              <strong>Date:</strong>{" "}
              {event.event_date
                ? new Date(event.event_date).toLocaleString()
                : "—"}
            </p>

            <p style={{ margin: "6px 0" }}>
              <strong>Category:</strong> {event.category || "—"}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setStatus(event.id, "approved")}
                disabled={busyId === event.id}
              >
                {busyId === event.id ? "Approving…" : "Approve"}
              </button>

              <button
                onClick={() => setStatus(event.id, "rejected")}
                disabled={busyId === event.id}
              >
                {busyId === event.id ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
