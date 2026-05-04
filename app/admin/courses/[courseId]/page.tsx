import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CourseForm } from '@/components/admin/CourseForm'
import { CourseModuleEditor } from '@/components/admin/CourseModuleEditor'
import { CourseDuplicateButton } from '@/components/admin/CourseDuplicateButton'

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (admin as any)
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: modules } = await (admin as any)
    .from('modules')
    .select(`
      id, title, position,
      lessons(id, title, position, mux_playback_id, duration_seconds)
    `)
    .eq('course_id', courseId)
    .order('position')

  const modulesWithLessons = (modules ?? []).map((m: {
    id: string; title: string; position: number;
    lessons: { id: string; title: string; position: number; mux_playback_id: string | null; duration_seconds: number | null }[]
  }) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a, b) => a.position - b.position),
  }))

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} /> Courses
          </Link>
          <h1 className="mt-3 text-2xl font-bold">{course.title}</h1>
        </div>
        <CourseDuplicateButton courseId={courseId} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h2>
        <CourseForm course={course} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Curriculum</h2>
        <CourseModuleEditor courseId={courseId} modules={modulesWithLessons} />
      </section>
    </div>
  )
}
