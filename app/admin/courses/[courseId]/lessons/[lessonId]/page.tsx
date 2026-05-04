import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { LessonForm } from '@/components/admin/LessonForm'
import { LabForm } from '@/components/admin/LabForm'

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const admin = createAdminClient()

  const [lessonResult, labResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('lessons')
      .select('id, title, mux_playback_id, duration_seconds, transcript, position, content_type, document_url, slides_url, notebook_url')
      .eq('id', lessonId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('labs')
      .select('id, title, description, context_instructions, passing_score, lab_criteria(id, name, description, weight, position)')
      .eq('lesson_id', lessonId)
      .maybeSingle(),
  ])

  if (!lessonResult.data) notFound()

  const lesson = lessonResult.data
  const lab = labResult.data ?? null

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href={`/admin/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Back to course
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Edit lesson</h1>
      </div>

      {/* Lesson content */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Content</h2>
        <LessonForm lesson={lesson} courseId={courseId} />
      </section>

      {/* Lab */}
      <section className="border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lab</h2>
          {lab && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              Active
            </span>
          )}
        </div>
        <LabForm lab={lab} lessonId={lessonId} />
      </section>
    </div>
  )
}
