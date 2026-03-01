import { supabase } from "./client";

//
// ============================================================
// CREATE EVENT
// ============================================================
//

export async function createEvent(payload) {
  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

//
// ============================================================
// GET EVENT BY ID
// ============================================================
//

export async function getEventById(id) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  return { data, error };
}

//
// ============================================================
// LIST PUBLIC EVENTS (Approved Only)
// ============================================================
//

export async function listPublicEvents() {
  // Uses the public_events_feed VIEW which handles RLS, timezone
  // normalisation and approved-status filtering correctly.
  // The client-side isEventStillVisible then applies the "1 AM next day" rule.
  const { data, error } = await supabase
    .from("public_events_feed")
    .select("*")
    .order("event_local_at", { ascending: true });

  return { data, error };
}

//
// ============================================================
// LIST EVENTS CREATED BY A USER
// (For Organizer Dashboard)
// ============================================================
//

export async function listEventsByCreator(user_id) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("creator_id", user_id)
    .order("created_at", { ascending: false });

  return { data, error };
}

//
// ============================================================
// UPDATE EVENT STATUS (ADMIN)
// - status: approved | rejected | pending
// ============================================================
//

export async function updateEventStatus(id, status) {
  const { data, error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

//
// ============================================================
// UPDATE EXISTING EVENT
// ============================================================
//

export async function updateEvent(id, updates) {
  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

//
// ============================================================
// DELETE EVENT
// ============================================================
//

export async function deleteEvent(id) {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  return { error };
}

//
// ============================================================
// ACCESS CONTROL — EVENT PRIVATE RULE
// ============================================================
//

export async function canUserAccessEvent(eventId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // 1️⃣ Buscar evento
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, creator_id, is_private")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return false;

  // 2️⃣ Evento público
  if (!event.is_private) return true;

  // 3️⃣ Organizador sempre entra
  if (event.creator_id === user.id) return true;

  // 4️⃣ Verificar convite
  const { data: invite } = await supabase
    .from("event_invites")
    .select("id")
    .eq("event_id", eventId)
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  return !!invite;
}
