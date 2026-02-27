-- ============================================================
-- SISTEMA DE INGRESSOS — Vibra Cultural
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1️⃣ TABELA TICKETS
-- Representa cada ingresso individual
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id),
  order_id        UUID,                                        -- preenchido após criar order
  code            TEXT        UNIQUE NOT NULL,                 -- código único ex: VB-ABCD1-XYZ23
  attendee_name   TEXT,
  attendee_email  TEXT,
  ticket_type     TEXT        NOT NULL DEFAULT 'standard',
  status          TEXT        NOT NULL DEFAULT 'active',       -- active | used | cancelled
  is_generated    BOOLEAN     NOT NULL DEFAULT false,          -- true = gerado pelo organizador
  checked_in_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ TABELA ORDERS
-- Representa uma compra (pode ter 1+ ingressos no futuro)
CREATE TABLE IF NOT EXISTS orders (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        UUID        NOT NULL REFERENCES events(id),
  buyer_id        UUID        NOT NULL REFERENCES auth.users(id),
  ticket_id       UUID        REFERENCES tickets(id),
  quantity        INTEGER     NOT NULL DEFAULT 1,
  unit_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'completed',    -- pending | completed | cancelled | refunded
  payment_method  TEXT        DEFAULT 'simulated',            -- simulated | pix | card
  payment_ref     TEXT,                                        -- ID externo do gateway
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3️⃣ FOREIGN KEY CRUZADA
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- 4️⃣ ROW LEVEL SECURITY

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders  ENABLE ROW LEVEL SECURITY;

-- TICKETS: dono pode ler os próprios
DROP POLICY IF EXISTS "ticket_owner_select" ON tickets;
CREATE POLICY "ticket_owner_select"
  ON tickets FOR SELECT
  USING (user_id = auth.uid());

-- TICKETS: criador do evento pode ler todos do evento
DROP POLICY IF EXISTS "event_creator_select_tickets" ON tickets;
CREATE POLICY "event_creator_select_tickets"
  ON tickets FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE creator_id = auth.uid()
    )
  );

-- TICKETS: usuário autenticado pode inserir
DROP POLICY IF EXISTS "auth_insert_ticket" ON tickets;
CREATE POLICY "auth_insert_ticket"
  ON tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- TICKETS: criador do evento pode atualizar (check-in)
DROP POLICY IF EXISTS "event_creator_update_ticket" ON tickets;
CREATE POLICY "event_creator_update_ticket"
  ON tickets FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM events WHERE creator_id = auth.uid()
    )
  );

-- ORDERS: dono pode ler os próprios
DROP POLICY IF EXISTS "order_owner_select" ON orders;
CREATE POLICY "order_owner_select"
  ON orders FOR SELECT
  USING (buyer_id = auth.uid());

-- ORDERS: usuário autenticado pode inserir
DROP POLICY IF EXISTS "auth_insert_order" ON orders;
CREATE POLICY "auth_insert_order"
  ON orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- 5️⃣ ÍNDICES
CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON tickets(event_id);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx  ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_code_idx     ON tickets(code);
CREATE INDEX IF NOT EXISTS orders_buyer_id_idx  ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_event_id_idx  ON orders(event_id);
