import { supabase } from "./client";

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

/** Gera um código único de ingresso ex: VB-ABCD1-XYZ23 */
function generateTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem chars ambíguos
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 5; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VB-${part1}-${part2}`;
}

// ─────────────────────────────────────────────
// COMPRAR INGRESSO (evento pago)
// ─────────────────────────────────────────────

/**
 * Cria um ingresso para evento pago
 * @param {Object} params
 * @param {string} params.eventId
 * @param {number} params.price
 * @param {string} params.attendeeName
 * @param {string} params.attendeeEmail
 * @param {string} [params.paymentMethod]
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
    return { error: authError || new Error("Não autenticado") };
  }

  const qr_code = generateTicketCode();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      user_id: user.id,
      qr_code,
      name: attendeeName,
      price: price || 0,
      quantity: 1,
      status: "active",
      payment_provider: paymentMethod,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  return { data: ticket, error };
}

// ─────────────────────────────────────────────
// GERAR INGRESSO (evento privado — organizador)
// ─────────────────────────────────────────────

/**
 * Organizer gera um ingresso gratuito para um convidado
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
    return { error: authError || new Error("Não autenticado") };
  }

  // Verifica se o usuário é criador do evento
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return { error: new Error("Evento não encontrado") };
  if (event.creator_id !== user.id) return { error: new Error("Sem permissão") };

  const qr_code = generateTicketCode();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      user_id: null,
      qr_code,
      name: attendeeName,
      price: 0,
      quantity: 1,
      status: "active",
      payment_provider: "generated",
    })
    .select()
    .single();

  return { data: ticket, error };
}

// ─────────────────────────────────────────────
// LISTAR INGRESSOS DO USUÁRIO
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
// BUSCAR INGRESSO POR ID
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
// LISTAR INGRESSOS DO EVENTO (para organizador)
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
// CHECK-IN (organizador valida ingresso)
// ─────────────────────────────────────────────

export async function checkInTicket(ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select()
    .single();

  return { data, error };
}

// ─────────────────────────────────────────────
// CANCELAR INGRESSO
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
// VERIFICAR SE USUÁRIO JÁ TEM INGRESSO
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
// CONTAR INGRESSOS DO EVENTO (para dashboard)
// ─────────────────────────────────────────────

export async function countEventTickets(eventId) {
  const { count, error } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  return { count: count || 0, error };
}
