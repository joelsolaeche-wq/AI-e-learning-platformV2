-- Phase 4: Labs + AI Evaluator
-- labs, lab_criteria, lab_submissions, lab_evaluations

-- ============================================================
-- labs: one lab per lesson (optional)
-- ============================================================
CREATE TABLE public.labs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id             uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text,
  context_instructions  text,
  passing_score         numeric NOT NULL DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- lab_criteria: rubric items for a lab
-- ============================================================
CREATE TABLE public.lab_criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id      uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  weight      numeric NOT NULL DEFAULT 1 CHECK (weight > 0),
  position    integer NOT NULL,
  UNIQUE (lab_id, position)
);

-- ============================================================
-- lab_submissions: learner work
-- ============================================================
CREATE TABLE public.lab_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id           uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id        uuid REFERENCES public.cohorts(id),
  submission_text  text,
  submission_url   text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','evaluating','evaluated')),
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- lab_evaluations: AI scores per criterion
-- ============================================================
CREATE TABLE public.lab_evaluations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.lab_submissions(id) ON DELETE CASCADE,
  criteria_id    uuid NOT NULL REFERENCES public.lab_criteria(id),
  score          numeric NOT NULL CHECK (score BETWEEN 0 AND 100),
  feedback       text,
  suggestion     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, criteria_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_evaluations ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_manage_labs" ON public.labs
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_lab_criteria" ON public.lab_criteria
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Learners: read labs for lessons they are enrolled in
CREATE POLICY "enrolled_read_labs" ON public.labs
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON l.module_id = m.id
      JOIN public.cohorts c ON m.course_id = c.course_id
      JOIN public.enrollments e ON c.id = e.cohort_id
      WHERE l.id = labs.lesson_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE POLICY "enrolled_read_lab_criteria" ON public.lab_criteria
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.labs lb WHERE lb.id = lab_criteria.lab_id
      AND (
        public.is_admin() OR
        EXISTS (
          SELECT 1
          FROM public.lessons l
          JOIN public.modules m ON l.module_id = m.id
          JOIN public.cohorts c ON m.course_id = c.course_id
          JOIN public.enrollments e ON c.id = e.cohort_id
          WHERE l.id = lb.lesson_id
            AND e.user_id = auth.uid()
            AND e.status = 'active'
        )
      )
    )
  );

-- Submissions: own only
CREATE POLICY "own_submissions_select" ON public.lab_submissions
  FOR SELECT USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "own_submissions_insert" ON public.lab_submissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_submissions_update" ON public.lab_submissions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Evaluations: readable by the submission owner
CREATE POLICY "own_evaluations_select" ON public.lab_evaluations
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.lab_submissions s
      WHERE s.id = lab_evaluations.submission_id AND s.user_id = auth.uid()
    )
  );
