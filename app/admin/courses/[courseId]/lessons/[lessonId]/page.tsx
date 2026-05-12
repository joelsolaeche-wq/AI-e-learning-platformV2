import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { LessonForm } from '@/components/admin/LessonForm'
import { LabEditorForm } from '@/components/admin/LabEditorForm'
import { getLessonDetailForAdmin } from '@/lib/queries/admin/courses.queries'

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params

  const detail = await getLessonDetailForAdmin(lessonId)
  if (detail === null) redirect('/admin')
  if (!detail.lesson) notFound()
  const { lesson, existingLab, rubricItems } = detail

  const hasTranscript = Boolean(lesson.transcript && lesson.transcript.trim().length > 0)

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

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Content</h2>
        <LessonForm lesson={lesson} courseId={courseId} />
      </section>

      <section className="border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lab</h2>
          {existingLab && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              Active
            </span>
          )}
        </div>
        <LabEditorForm
          lessonId={lessonId}
          defaultTitle={existingLab?.title ?? lesson.title + ' — Lab'}
          defaultBrief={existingLab?.brief_md ?? ''}
          defaultItems={rubricItems}
          canDraft={hasTranscript}
          existingLab={Boolean(existingLab)}
        />
      </section>
    </div>
  )
}
