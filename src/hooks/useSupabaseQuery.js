import { useQuery } from "@tanstack/react-query";
import { listPublicEvents, getEventById } from "../supabase/events";
import { getMyTickets, getTicketById, getUserTicketForEvent } from "../supabase/tickets";

export function usePublicEvents() {
  return useQuery({
    queryKey: ["events", "public"],
    queryFn: async () => {
      const { data, error } = await listPublicEvents();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEvent(eventId) {
  return useQuery({
    queryKey: ["events", eventId],
    queryFn: async () => {
      const { data, error } = await getEventById(eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}

export function useMyTickets(userId) {
  return useQuery({
    queryKey: ["tickets", "mine", userId],
    queryFn: async () => {
      const { data, error } = await getMyTickets();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useTicket(ticketId, userId) {
  return useQuery({
    queryKey: ["tickets", ticketId],
    queryFn: async () => {
      const { data, error } = await getTicketById(ticketId);
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId && !!userId,
  });
}

export function useUserTicketForEvent(eventId, userId) {
  return useQuery({
    queryKey: ["tickets", "event", eventId, userId],
    queryFn: async () => {
      const { data, error } = await getUserTicketForEvent(eventId);
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!eventId && !!userId,
  });
}
