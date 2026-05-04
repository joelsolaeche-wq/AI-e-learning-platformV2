-- Add status field to courses (draft | published | archived)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived'));

-- Migrate existing is_published → status
UPDATE public.courses SET status = 'published' WHERE is_published = true;

-- Admin and instructor can INSERT courses
CREATE POLICY "admin_instructor_insert_courses"
  ON public.courses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- Admin and instructor can UPDATE courses
CREATE POLICY "admin_instructor_update_courses"
  ON public.courses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- Admin can DELETE courses
CREATE POLICY "admin_delete_courses"
  ON public.courses
  FOR DELETE
  USING (public.is_admin());

-- Admin and instructor can manage modules
CREATE POLICY "admin_instructor_insert_modules"
  ON public.modules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

CREATE POLICY "admin_instructor_update_modules"
  ON public.modules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

CREATE POLICY "admin_instructor_delete_modules"
  ON public.modules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- Admin and instructor can manage lessons
CREATE POLICY "admin_instructor_insert_lessons"
  ON public.lessons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

CREATE POLICY "admin_instructor_update_lessons"
  ON public.lessons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

CREATE POLICY "admin_instructor_delete_lessons"
  ON public.lessons
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- Admin can view all courses (including unpublished)
CREATE POLICY "admin_view_all_courses"
  ON public.courses
  FOR SELECT
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'instructor'
  ));
