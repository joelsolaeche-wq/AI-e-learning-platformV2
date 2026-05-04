-- Enhance organizations table with description, logo, website
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS website text;

-- M2M table: which courses are accessible to which companies
CREATE TABLE IF NOT EXISTS public.course_companies (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, company_id)
);

ALTER TABLE public.course_companies ENABLE ROW LEVEL SECURITY;

-- Admins can manage all course-company assignments
CREATE POLICY "admin_manage_course_companies"
  ON public.course_companies
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Learners can see assignments for their own company (used for catalog filtering)
CREATE POLICY "learners_see_own_company_courses"
  ON public.course_companies
  FOR SELECT
  USING (
    company_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
