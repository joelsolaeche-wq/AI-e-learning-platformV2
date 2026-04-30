-- Helper function to check admin role without triggering RLS recursion.
-- SECURITY DEFINER bypasses RLS on the profiles table for this specific read,
-- the same pattern used by get_my_active_cohort_ids() for enrollments.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Drop the recursive policies created in the previous migration
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

-- Recreate using the SECURITY DEFINER helper (no recursion)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());
