-- Fix: make courses.org_id nullable (course_companies M2M handles visibility now)
ALTER TABLE public.courses ALTER COLUMN org_id DROP NOT NULL;

-- Fix: soft delete for organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Lesson content attachments
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video'
    CHECK (content_type IN ('video', 'document', 'slides', 'notebook', 'mixed')),
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS slides_url text,
  ADD COLUMN IF NOT EXISTS notebook_url text;
