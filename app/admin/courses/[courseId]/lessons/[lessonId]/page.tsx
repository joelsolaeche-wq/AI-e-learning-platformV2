import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { LessonForm } from '@/components/admin/LessonForm'

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = await (admin as any)
    .from('lessons')
    .select('id, title, mux_playback_id, duration_seconds, transcript, position')
    .eq('id', lessonId)
    .single()

  if (!lesson) notFound()

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
      <LessonForm lesson={lesson} courseId={courseId} />
    </div>
  )
}
