import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LabEditorForm } from '@/components/admin/LabEditorForm'

export default async function AdminLabEditorPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lessonResult = await (admin as any)
    .from('lessons')
    .select('id, title, transcript, modules(title, courses(title))')
    .eq('id', lessonId)
    .single()

  const lesson = lessonResult.data as {
    id: string
    title: string
    transcript: string | null
    modules: { title: string; courses: { title: string } | null } | null
  } | null
  if (!lesson) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingLab } = await (admin as any)
    .from('labs')
    .select('id, title, brief_md')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  let items: Array<{ criterion: string; description: string; weight: number }> = []
  if (existingLab) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rubric } = await (admin as any)
      .from('lab_rubric_items')
      .select('criterion, description, weight, position')
      .eq('lab_id', existingLab.id)
      .order('position', { ascending: true })

    items = (rubric ?? []).map((r: { criterion: string; description: string; weight: number }) => ({
      criterion: r.criterion,
      description: r.description,
      weight: r.weight,
    }))
  }

  const courseTitle = lesson.modules?.courses?.title ?? ''
  const moduleTitle = lesson.modules?.title ?? ''
  const hasTranscript = Boolean(lesson.transcript && lesson.transcript.trim().length > 0)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/labs"
          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{existingLab ? 'Edit lab' : 'Author lab'}</h1>
          <p className="text-sm text-muted-foreground">
            {courseTitle && <>{courseTitle} · </>}
            {moduleTitle && <>{moduleTitle} · </>}
            {lesson.title}
          </p>
        </div>
      </div>

      <LabEditorForm
        lessonId={lessonId}
        defaultTitle={existingLab?.title ?? lesson.title + ' — Lab'}
        defaultBrief={existingLab?.brief_md ?? ''}
        defaultItems={items}
        canDraft={hasTranscript}
        existingLab={Boolean(existingLab)}
      />
    </div>
  )
}
