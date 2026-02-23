import { useMemo, useState } from "react";

export default function PrivateEventInviteGate({ event, onAccessGranted }) {
  const storageKey = useMemo(
    () => `invited_event_${event.id}`,
    [event.id]
  );

  const [loading, setLoading] = useState(false);

  const hasInvite =
    typeof window !== "undefined" &&
    localStorage.getItem(storageKey) === "true";

  if (!event?.is_private || hasInvite) {
    onAccessGranted?.();
    return null;
  }

  function isInvalid() {
    if (
      typeof event.max_guests === "number" &&
      typeof event.guests_count === "number" &&
      event.guests_count >= event.max_guests
    ) {
      return true;
    }
    return false;
  }

  function handleEnter() {
    setLoading(true);

    if (isInvalid()) {
      alert(
        "This invite is no longer valid. Ask the organizer for a new link."
      );
      setLoading(false);
      return;
    }

    localStorage.setItem(storageKey, "true");
    setLoading(false);
    onAccessGranted?.();
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>🔒 Private Event</div>
      <p>You've been invited to this event</p>

      <h3>{event.title}</h3>
      <p>{event.description}</p>

      <button onClick={handleEnter} disabled={loading}>
        {loading ? "Joining..." : "Join Event"}
      </button>
    </div>
  );
}
