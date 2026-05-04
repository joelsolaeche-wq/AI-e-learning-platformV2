-- Add modality, notes, and company link to cohorts
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS modality text DEFAULT 'virtual',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Invitation codes for cohorts
CREATE TABLE IF NOT EXISTS public.cohort_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cohort_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_invitations"
  ON public.cohort_invitations
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Anyone authenticated can read an invitation by code (to validate it)
CREATE POLICY "authenticated_read_invitations"
  ON public.cohort_invitations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Waitlist for full cohorts
CREATE TABLE IF NOT EXISTS public.cohort_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, user_id)
);

ALTER TABLE public.cohort_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_waitlist"
  ON public.cohort_waitlist
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_view_waitlist"
  ON public.cohort_waitlist
  FOR SELECT
  USING (public.is_admin());

-- Admin can manage cohorts (INSERT/UPDATE/DELETE)
CREATE POLICY "admin_instructor_insert_cohorts"
  ON public.cohorts
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
  );

CREATE POLICY "admin_instructor_update_cohorts"
  ON public.cohorts
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
  );

CREATE POLICY "admin_instructor_delete_cohorts"
  ON public.cohorts
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
  );

-- Admin can manage enrollments
CREATE POLICY "admin_insert_enrollments"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_enrollments"
  ON public.enrollments
  FOR UPDATE
  USING (public.is_admin());
