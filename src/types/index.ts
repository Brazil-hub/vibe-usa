export interface Event {
  id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  category?: string | null;
  location?: string | null;
  online_url?: string | null;
  image_url?: string | null;
  is_paid: boolean;
  price?: number | null;
  is_private: boolean;
  is_public: boolean;
  event_format: "in_person" | "online";
  status: "pending" | "approved" | "rejected" | "archived";
  created_at: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  user_id: string | null;
  qr_code: string;
  name: string;
  price: number;
  quantity: number;
  status: "active" | "used" | "cancelled";
  payment_provider: string;
  paid_at?: string | null;
  used_at?: string | null;
  created_at: string;
  events?: Event;
}

export interface User {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface EventInvite {
  id: string;
  event_id: string;
  user_id?: string | null;
  email?: string | null;
  token: string;
  created_at: string;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: "going" | "not_going" | "maybe";
  created_at: string;
}
