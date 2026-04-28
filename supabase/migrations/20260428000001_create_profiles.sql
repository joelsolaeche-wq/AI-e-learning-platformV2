-- ============================================================
-- Migration: 20260428000001_create_profiles
-- Phase 1: Auth + RLS Foundation
-- Creates the profiles table, enables RLS, adds policies,
-- and sets up the auto-create trigger on auth.users.
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() if not already available
create extension if not exists "pgcrypto";

-- ============================================================
-- Table: public.profiles
-- Extends auth.users — one row per authenticated user.
-- id is a FK to auth.users.id with cascade delete.
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'learner'
                check (role in ('learner', 'instructor', 'admin')),
  org_id      uuid,   -- FK to organizations added in Phase 2
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- RLS: enable row level security on profiles
-- After this, no row is returned unless a policy permits it.
-- ============================================================
alter table public.profiles enable row level security;

-- SELECT: a user can only read their own profile row
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- UPDATE: a user can only update their own profile row
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT: intentionally no policy — the trigger (SECURITY DEFINER)
-- handles inserts and bypasses RLS. Direct client inserts are blocked.

-- DELETE: intentionally no policy — profile deletion is out of scope for v1.

-- ============================================================
-- Function: public.handle_new_user
-- Fires after every new row in auth.users.
-- SECURITY DEFINER: runs as the function owner (postgres),
-- bypassing RLS on public.profiles.
-- set search_path = public: prevents search_path injection.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- ============================================================
-- Trigger: on_auth_user_created
-- Fires AFTER INSERT on auth.users for each new row.
-- Creates the matching public.profiles row automatically.
-- ============================================================
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
