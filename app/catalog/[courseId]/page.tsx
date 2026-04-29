import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Database } from '@/lib/database.types'
import { EnrollButton } from '@/components/EnrollButton'

type CourseRow = Pick<
  Database['public']['Tables']['courses']['Row'],
  'id' | 'title' | 'slug' | 'description' | 'thumbnail_url'
>

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'title' | 'position' | 'duration_seconds'
>

type ModuleWithLessons = Pick<
  Database['public']['Tables']['modules']['Row'],
  'id' | 'title' | 'position'
> & { lessons: LessonRow[] | null }

type CohortRow = Pick<
  Database['public']['Tables']['cohorts']['Row'],
  'id' | 'title' | 'starts_at' | 'ends_at' | 'max_seats' | 'status'
>

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params   // params is a Promise in Next.js 15 App Router

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Parallel fetches — course + modules+lessons + cohorts + user enrollments
  const [courseResult, modulesResult, cohortsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .eq('id', courseId)
      .eq('is_published', true)
      .single(),

    supabase
      .from('modules')
      .select(`
        id,
        title,
        position,
        lessons (
          id,
          title,
          position,
          duration_seconds
        )
      `)
      .eq('course_id', courseId)
      .order('position', { ascending: true }),

    supabase
      .from('cohorts')
      .select('id, title, starts_at, ends_at, max_seats, status')
      .eq('course_id', courseId)
      .order('starts_at', { ascending: true }),

    supabase
      .from('enrollments')
      .select('cohort_id')
      .eq('user_id', user.id),
  ])

  // Log server-side errors so they appear in Vercel function logs
  if (modulesResult.error) {
    console.error('modules fetch error', modulesResult.error)
  }
  if (cohortsResult.error) {
    console.error('cohorts fetch error', cohortsResult.error)
  }

  // Extract data with explicit types — Supabase discriminated union requires casts
  const modules: ModuleWithLessons[] = (modulesResult.data as ModuleWithLessons[] | null) ?? []
  const cohorts: CohortRow[] = (cohortsResult.data as CohortRow[] | null) ?? []
  type EnrollmentCohortIdRow = { cohort_id: string }
  const enrolledCohortIds = new Set<string>(
    ((enrollmentsResult.data ?? []) as EnrollmentCohortIdRow[]).map((e) => e.cohort_id)
  )

  // 404 if course not found or not published
  // Extract data before the guard so TypeScript can narrow it independently
  const rawCourse = courseResult.data
  if (courseResult.error || !rawCourse) {
    notFound()
  }

  const course: CourseRow = rawCourse as CourseRow

  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-12 pb-16 space-y-8">
      {/* Course Header */}
      <header>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">No preview</span>
            </div>
          )}
        </div>
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight">{course.title}</h1>
            <Badge variant="secondary">AI</Badge>
          </div>
          {course.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          )}
        </div>
      </header>

      <Separator />

      {/* Course Outline */}
      <section>
        <h2 className="text-[20px] font-semibold mb-4">Course Outline</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modules available yet.</p>
        ) : (
          <div className="space-y-6">
            {modules.map((module, moduleIdx) => (
              <div key={module.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Module {module.position}
                  </span>
                </div>
                <h3 className="text-base font-semibold mb-2">{module.title}</h3>
                <div className="space-y-1 pl-4 border-l border-border">
                  {(module.lessons ?? [])
                    .sort((a, b) => a.position - b.position)
                    .map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <Link
                            href={`/dashboard/lesson/${lesson.id}`}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {lesson.title}
                          </Link>
                        {lesson.duration_seconds && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(lesson.duration_seconds / 60)} min
                          </span>
                        )}
                      </div>
                    ))}
                </div>
                {moduleIdx < modules.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cohort Schedule */}
      <section>
        <h2 className="text-[20px] font-semibold mb-4">Available Cohorts</h2>
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohorts scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {cohorts.map((cohort) => (
              <Card key={cohort.id} className="border-border bg-card">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{cohort.title}</h3>
                    <Badge
                      variant={cohort.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {cohort.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Starts:{' '}
                        {new Date(cohort.starts_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      {cohort.max_seats > 0 && (
                        <p>Up to {cohort.max_seats} seats</p>
                      )}
                    </div>
                    {enrolledCohortIds.has(cohort.id) ? (
                      <Badge variant="secondary">Enrolled</Badge>
                    ) : (
                      <EnrollButton cohortId={cohort.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
