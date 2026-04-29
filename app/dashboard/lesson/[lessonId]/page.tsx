import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import { VideoPlayer } from '@/components/VideoPlayer'

// ---------------------------------------------------------------------------
// Types — explicit Pick aliases following the dashboard/catalog page convention
// ---------------------------------------------------------------------------

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'title' | 'module_id' | 'mux_playback_id' | 'duration_seconds' | 'transcript'
>

type ProgressRow = Pick<
  Database['public']['Tables']['lesson_progress']['Row'],
  'last_position' | 'completed'
>

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface LessonPageProps {
  params: Promise<{ lessonId: string }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params

  const supabase = await createClient()

  // Belt-and-suspenders auth guard (middleware already protects /dashboard).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch lesson + progress in parallel.
  // RLS on lessons ensures only enrolled users can read rows — if the lesson
  // returns null (not found or not enrolled), we call notFound().
  const [lessonResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, module_id, mux_playback_id, duration_seconds, transcript')
      .eq('id', lessonId)
      .single(),
    supabase
      .from('lesson_progress')
      .select('last_position, completed')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
  ])

  const rawLesson = lessonResult.data
  if (lessonResult.error || !rawLesson) {
    notFound()
  }

  const lesson = rawLesson as LessonRow
  const progress = progressResult.data as unknown as ProgressRow | null

  const resumePosition = progress?.last_position ?? 0

  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-8 pb-16 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </header>

      <div className="rounded-lg overflow-hidden bg-black">
        {lesson.mux_playback_id ? (
          <VideoPlayer
            playbackId={lesson.mux_playback_id}
            lessonId={lesson.id}
            resumePosition={resumePosition}
            duration={lesson.duration_seconds ?? 0}
          />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-muted">
            <p className="text-sm text-muted-foreground">Video not available</p>
          </div>
        )}
      </div>

      {lesson.transcript && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Transcript
          </h2>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {lesson.transcript}
          </p>
        </section>
      )}
    </main>
  )
}
