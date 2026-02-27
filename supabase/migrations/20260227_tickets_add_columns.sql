-- Migration: add missing columns to tickets table
-- Run this in Supabase → SQL Editor

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS qr_code           text,
  ADD COLUMN IF NOT EXISTS name              text,
  ADD COLUMN IF NOT EXISTS price             numeric(10,2) default 0,
  ADD COLUMN IF NOT EXISTS quantity          int default 1,
  ADD COLUMN IF NOT EXISTS payment_provider  text,
  ADD COLUMN IF NOT EXISTS paid_at           timestamptz,
  ADD COLUMN IF NOT EXISTS used_at           timestamptz;
