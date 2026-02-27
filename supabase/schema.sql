-- ============================================================
-- VibeCultural — Full DB Schema
-- Paste this into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- UUID support
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES  (main user table)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- "users" = updatable view so ensureUserProfile.js and rsvp joins both work
create or replace view public.users as
  select id, email, name, avatar_url, created_at from public.profiles;

-- ============================================================
-- EVENTS
-- ============================================================
create table if not exists public.events (
  id            uuid        primary key default gen_random_uuid(),
  creator_id    uuid        references public.profiles(id) on delete cascade,
  title         text        not null,
  description   text,
  event_date    timestamptz,
  category      text,
  event_format  text        default 'in_person', -- in_person | online | hybrid
  location      text,
  online_url    text,
  image_url     text,
  is_paid       boolean     default false,
  price         numeric(10,2),
  is_private    boolean     default false,
  is_public     boolean     default true,
  status        text        default 'pending',   -- pending | approved | rejected
  created_at    timestamptz default now()
);

-- ============================================================
-- PUBLIC EVENTS FEED  (view used by HomePage)
-- ============================================================
create or replace view public.public_events_feed as
  select
    *,
    event_date                                           as event_local_at,
    to_char(event_date, 'Mon DD')                        as date_label,
    to_char(event_date, 'HH12:MI AM')                   as time_label
  from public.events
  where status = 'approved'
    and (is_private = false or is_private is null);

-- ============================================================
-- RSVPs
-- ============================================================
create table if not exists public.rsvps (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        references public.events(id) on delete cascade,
  user_id    uuid        references public.profiles(id) on delete cascade,
  status     text        default 'going',  -- going | maybe | no
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- ============================================================
-- POSTS  (organizer/attendee updates inside an event)
-- ============================================================
create table if not exists public.posts (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        references public.events(id) on delete cascade,
  user_id    uuid        references public.profiles(id) on delete cascade,
  text       text,
  image_url  text,
  status     text        default 'pending',  -- pending | approved
  created_at timestamptz default now()
);

-- ============================================================
-- COMMENTS
-- ============================================================
create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        references public.posts(id) on delete cascade,
  user_id    uuid        references public.profiles(id) on delete cascade,
  text       text,
  image_url  text,
  created_at timestamptz default now()
);

-- ============================================================
-- LIKES
-- ============================================================
create table if not exists public.likes (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        references public.posts(id) on delete cascade,
  user_id    uuid        references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- ============================================================
-- EVENT INVITES
-- ============================================================
create table if not exists public.event_invites (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        references public.events(id) on delete cascade,
  email        text,
  user_id      uuid        references public.profiles(id) on delete set null,
  invited_by   uuid        references public.profiles(id) on delete set null,
  status       text        default 'pending',  -- pending | accepted | declined
  created_at   timestamptz default now()
);

-- ============================================================
-- TICKET TYPES
-- ============================================================
create table if not exists public.ticket_types (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        references public.events(id) on delete cascade,
  name       text        not null,
  price      numeric(10,2) default 0,
  quantity   integer,
  created_at timestamptz default now()
);

-- ============================================================
-- TICKETS
-- ============================================================
create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references public.events(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  ticket_type_id  uuid references public.ticket_types(id) on delete set null,
  status          text default 'active',  -- active | used | cancelled
  created_at      timestamptz default now()
);

-- ============================================================
-- CHECKINS
-- ============================================================
create table if not exists public.checkins (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        references public.events(id) on delete cascade,
  user_id    uuid        references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- PROFILES
alter table public.profiles enable row level security;

create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- EVENTS
alter table public.events enable row level security;

create policy "events_read"   on public.events for select
  using (status = 'approved' or creator_id = auth.uid() or is_private = false);
create policy "events_insert" on public.events for insert
  with check (auth.uid() = creator_id);
create policy "events_update" on public.events for update
  using (auth.uid() = creator_id or auth.uid() is not null);  -- auth.uid() is not null = any logged-in user can update status (for admin page)
create policy "events_delete" on public.events for delete
  using (auth.uid() = creator_id);

-- RSVPS
alter table public.rsvps enable row level security;

create policy "rsvps_read"  on public.rsvps for select using (auth.uid() is not null);
create policy "rsvps_write" on public.rsvps for all    using (auth.uid() = user_id);

-- POSTS
alter table public.posts enable row level security;

create policy "posts_read"   on public.posts for select
  using (status = 'approved' or user_id = auth.uid());
create policy "posts_insert" on public.posts for insert
  with check (auth.uid() = user_id);
create policy "posts_update" on public.posts for update
  using (auth.uid() = user_id);
create policy "posts_delete" on public.posts for delete
  using (auth.uid() = user_id);

-- COMMENTS
alter table public.comments enable row level security;

create policy "comments_read"   on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id);

-- LIKES
alter table public.likes enable row level security;

create policy "likes_read"  on public.likes for select using (true);
create policy "likes_write" on public.likes for all    using (auth.uid() = user_id);

-- EVENT INVITES
alter table public.event_invites enable row level security;

create policy "invites_read"   on public.event_invites for select
  using (auth.uid() = invited_by or auth.uid() = user_id);
create policy "invites_insert" on public.event_invites for insert
  with check (auth.uid() = invited_by);
create policy "invites_update" on public.event_invites for update
  using (auth.uid() = user_id);

-- TICKET TYPES
alter table public.ticket_types enable row level security;

create policy "ticket_types_read"  on public.ticket_types for select using (true);
create policy "ticket_types_write" on public.ticket_types for all
  using (auth.uid() = (select creator_id from public.events where id = event_id));

-- TICKETS
alter table public.tickets enable row level security;

create policy "tickets_read"   on public.tickets for select using (auth.uid() = user_id);
create policy "tickets_insert" on public.tickets for insert with check (auth.uid() = user_id);

-- CHECKINS
alter table public.checkins enable row level security;

create policy "checkins_read" on public.checkins for select
  using (auth.uid() = user_id or
         auth.uid() = (select creator_id from public.events where id = event_id));
create policy "checkins_insert" on public.checkins for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN UP  (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS  (run separately or create via Dashboard UI)
-- Dashboard → Storage → New bucket
-- ============================================================
-- event-images  (public)
-- event-covers  (public)
-- avatars       (public)
-- comment-images (public)
--
-- For each bucket, add policy:
--   SELECT: true  (public read)
--   INSERT: auth.uid() is not null  (authenticated upload)
