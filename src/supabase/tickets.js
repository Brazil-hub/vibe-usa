import { supabase } from "./client";

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

/** Generates a unique ticket code e.g. VB-ABCD1-XYZ23 */
function generateTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 5; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VB-${part1}-${part2}`;
}

// ─────────────────────────────────────────────
// BUY TICKET (paid or free event)
// ─────────────────────────────────────────────

/**
 * Creates a ticket (and a matching order row) for the authenticated user.
 * @param {Object} params
 * @param {string} params.eventId
 * @param {number} params.price
 * @param {string} params.attendeeName
 * @param {string} params.attendeeEmail
 * @param {string} [params.paymentMethod]
 * @returns {{ data: { ticket, order } | null, error }}
 */
export async function purchaseTicket({
  eventId,
  price,
  attendeeName,
  attendeeEmail,
  paymentMethod = "simulated",
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: authError || new Error("Not authenticated") };
  }

  const code = generateTicketCode();

  // 1. Insert ticket
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      event_id:       eventId,
      user_id:        user.id,
      code,
      attendee_name:  attendeeName,
      attendee_email: attendeeEmail,
      ticket_type:    "standard",
      status:         "active",
    })
    .select()
    .single();

  if (ticketError) return { error: ticketError };

  // 2. Insert order (non-blocking — ticket already created)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id:       eventId,
      buyer_id:       user.id,
      ticket_id:      ticket.id,
      quantity:       1,
      unit_price:     price || 0,
      total_amount:   price || 0,
      status:         "completed",
      payment_method: paymentMethod,
    })
    .select()
    .single();

  if (orderError) {
    console.warn("Order insert failed (non-blocking):", orderError);
  }

  return { data: { ticket, order: order || null }, error: null };
}

// ─────────────────────────────────────────────
// GENERATE TICKET (organizer → private event guest)
// ─────────────────────────────────────────────

/**
 * Organizer generates a free ticket for a guest.
 */
export async function generateTicket({
  eventId,
  attendeeName,
  attendeeEmail,
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: authError || new Error("Not authenticated") };
  }

  // Verify the user is the event creator
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return { error: new Error("Event not found") };
  if (event.creator_id !== user.id) return { error: new Error("Not authorized") };

  // Fetch a ticket_type_id for this event (required if column is NOT NULL)
  const { data: ticketType } = await supabase
    .from("ticket_types")
    .select("id")
    .eq("event_id", eventId)
    .limit(1)
    .maybeSingle();

  const code = generateTicketCode();

  const insertPayload = {
    event_id:         eventId,
    user_id:          null,
    qr_code:          code,
    name:             attendeeName,
    status:           "active",
    payment_provider: "generated",
  };

  // Include ticket_type_id only if a ticket type exists for this event
  if (ticketType?.id) {
    insertPayload.ticket_type_id = ticketType.id;
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert(insertPayload)
    .select()
    .single();

  return { data: ticket ? { ...ticket } : null, error };
}

// ─────────────────────────────────────────────
// LIST USER'S TICKETS
// ─────────────────────────────────────────────

export async function getMyTickets() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { data: [], error: authError };

  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      *,
      events (
        id,
        title,
        event_date,
        location,
        online_url,
        event_format,
        image_url,
        is_paid,
        price,
        is_private
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

// ─────────────────────────────────────────────
// GET TICKET BY ID
// ─────────────────────────────────────────────

export async function getTicketById(ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      *,
      events (
        id,
        title,
        event_date,
        location,
        online_url,
        event_format,
        image_url,
        is_paid,
        price,
        is_private,
        category
      )
    `
    )
    .eq("id", ticketId)
    .single();

  return { data, error };
}

// ─────────────────────────────────────────────
// LIST EVENT TICKETS (organizer)
// ─────────────────────────────────────────────

export async function getEventTickets(eventId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

// ─────────────────────────────────────────────
// CHECK-IN (organizer validates ticket)
// ─────────────────────────────────────────────

export async function checkInTicket(ticketId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tickets")
    .update({
      status:        "used",
      used_at:       now,
      checked_in_at: now,
    })
    .eq("id", ticketId)
    .select()
    .single();

  return { data, error };
}

// ─────────────────────────────────────────────
// CANCEL TICKET
// ─────────────────────────────────────────────

export async function cancelTicket(ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("id", ticketId)
    .select()
    .single();

  return { data, error };
}

// ─────────────────────────────────────────────
// CHECK IF USER ALREADY HAS A TICKET
// ─────────────────────────────────────────────

export async function getUserTicketForEvent(eventId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  return { data, error };
}

// ─────────────────────────────────────────────
// COUNT EVENT TICKETS (for dashboard)
// ─────────────────────────────────────────────

export async function countEventTickets(eventId) {
  const { count, error } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  return { count: count || 0, error };
}
