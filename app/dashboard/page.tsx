import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Types — explicit Pick aliases per the catalog page convention.
// Supabase returns nested relations as discriminated unions, so we cast.
// ---------------------------------------------------------------------------

type EnrollmentWithCohort = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'id' | 'cohort_id' | 'enrolled_at' | 'status'
> & {
  cohorts:
    | (Pick<
        Database['public']['Tables']['cohorts']['Row'],
        'id' | 'title' | 'status' | 'starts_at' | 'course_id'
      > & {
        courses: Pick<
          Database['public']['Tables']['courses']['Row'],
          'id' | 'title' | 'slug'
        > | null
      })
    | null
}

type TeammateProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email'
>

type TeammateEnrollment = {
  cohort_id: string
  user_id: string
  profiles: TeammateProfile | null
}

type LessonRowMin = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'module_id'
>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(p: TeammateProfile): string {
  if (p.full_name && p.full_name.trim().length > 0) return p.full_name
  return p.email.split('@')[0]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient()

  // Belt-and-suspenders auth guard (middleware already protects this route).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // -- Fetch all data the dashboard needs in parallel ------------------------
  const [enrollmentsResult, progressResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select(`
        id,
        cohort_id,
        enrolled_at,
        status,
        cohorts (
          id,
          title,
          status,
          starts_at,
          course_id,
          courses (
            id,
            title,
            slug
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active'),

    supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', user.id)
      .eq('completed', true),
  ])

  const enrollments: EnrollmentWithCohort[] =
    (enrollmentsResult.data as EnrollmentWithCohort[] | null) ?? []

  type LessonProgressRow = { lesson_id: string; completed: boolean }
  const completedLessonIds = new Set<string>(
    ((progressResult.data ?? []) as LessonProgressRow[]).map((r) => r.lesson_id)
  )

  // For each enrolled cohort we need (a) the total lesson count for that
  // cohort's course and (b) the teammate roster. Both are scoped by the
  // cohort_ids we already have.
  const cohortIds = enrollments
    .map((e) => e.cohort_id)
    .filter((id): id is string => Boolean(id))
  const courseIds = enrollments
    .map((e) => e.cohorts?.course_id)
    .filter((id): id is string => Boolean(id))

  // Total lessons per course = lessons whose module belongs to that course.
  // We fetch all lessons for the courses the user is enrolled in, then group.
  const lessonsByCourse = new Map<string, LessonRowMin[]>()
  if (courseIds.length > 0) {
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('id, module_id, modules!inner(course_id)')
      .in('modules.course_id', courseIds)

    type LessonWithModule = LessonRowMin & {
      modules: { course_id: string } | null
    }
    const rows = (lessonsData ?? []) as unknown as LessonWithModule[]
    for (const row of rows) {
      const courseId = row.modules?.course_id
      if (!courseId) continue
      const arr = lessonsByCourse.get(courseId) ?? []
      arr.push({ id: row.id, module_id: row.module_id })
      lessonsByCourse.set(courseId, arr)
    }
  }

  // Teammates per cohort: enrollments rows where cohort_id ∈ cohortIds AND
  // user_id != current user, joined to profiles for display info.
  const teammatesByCohort = new Map<string, TeammateEnrollment[]>()
  if (cohortIds.length > 0) {
    const { data: teammatesData } = await supabase
      .from('enrollments')
      .select('cohort_id, user_id, profiles ( id, full_name, email )')
      .in('cohort_id', cohortIds)
      .neq('user_id', user.id)

    const rows = (teammatesData ?? []) as unknown as TeammateEnrollment[]
    for (const row of rows) {
      const arr = teammatesByCohort.get(row.cohort_id) ?? []
      arr.push(row)
      teammatesByCohort.set(row.cohort_id, arr)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-12 pb-16 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Cohorts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {user.email}
          </p>
        </div>

        <form action="/auth/logout" method="POST">
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </header>

      {enrollments.length === 0 ? (
        // Empty state — UI-SPEC copywriting locked
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="text-lg font-semibold">No cohorts yet</h2>
          <p className="text-sm text-muted-foreground">
            Browse the catalog to find your team&apos;s AI course.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/catalog">Browse catalog →</Link>
          </Button>
        </div>
      ) : (
        <section className="space-y-4">
          {enrollments.map((enrollment) => {
            const cohort = enrollment.cohorts
            if (!cohort) return null
            const course = cohort.courses

            const courseLessons = lessonsByCourse.get(cohort.course_id) ?? []
            const totalLessons = courseLessons.length
            const completedCount = courseLessons.filter((l) =>
              completedLessonIds.has(l.id)
            ).length
            const pct =
              totalLessons > 0
                ? Math.floor((completedCount / totalLessons) * 100)
                : 0

            const teammates = teammatesByCohort.get(cohort.id) ?? []

            return (
              <Card key={enrollment.id} className="border-border bg-card">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{cohort.title}</h2>
                    <Badge
                      variant={cohort.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {cohort.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {/* Progress section */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {completedCount} of {totalLessons} lessons complete
                    </p>
                    <div
                      className="h-1.5 w-full rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`Lesson progress: ${completedCount} of ${totalLessons} complete`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Teammates section */}
                  {teammates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Teammates
                      </p>
                      <ul className="space-y-1">
                        {teammates.map((t) =>
                          t.profiles ? (
                            <li
                              key={t.profiles.id}
                              className="flex items-center justify-between gap-4 py-1"
                            >
                              <span className="text-sm">
                                {displayName(t.profiles)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                0%
                              </span>
                            </li>
                          ) : null
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Course link */}
                  {course && (
                    <div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/catalog/${course.id}`}>Go to Course →</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}
    </main>
  )
}
