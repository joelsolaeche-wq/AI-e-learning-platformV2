// app/catalog/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, PlayCircle, ChevronRight, Star } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type CourseRow = Pick<
  Database['public']['Tables']['courses']['Row'],
  'id' | 'title' | 'slug' | 'description' | 'thumbnail_url'
>

const HUES: Array<{ from: string; to: string; icon: string }> = [
  { from: '#7C3AED', to: '#22D3EE', icon: '✦' },
  { from: '#06B6D4', to: '#10B981', icon: '◐' },
  { from: '#F472B6', to: '#FB923C', icon: '◇' },
  { from: '#FB7185', to: '#A78BFA', icon: '◎' },
  { from: '#34D399', to: '#60A5FA', icon: '△' },
  { from: '#FBBF24', to: '#F472B6', icon: '◈' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  const isAdminOrInstructor = profile?.role === 'admin' || profile?.role === 'instructor'

  let data: CourseRow[] | null = null
  let error = null

  if (isAdminOrInstructor) {
    // Admins and instructors see all published courses
    const res = await supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .eq('is_published', true)
      .order('created_at', { ascending: true })
    data = res.data
    error = res.error
  } else if (profile?.org_id) {
    // Learners see only courses assigned to their company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase as any)
      .from('course_companies')
      .select('courses!inner(id, title, slug, description, thumbnail_url)')
      .eq('company_id', profile.org_id)
    error = res.error
    if (res.data) {
      data = res.data.map((r: { courses: CourseRow }) => r.courses)
    }
  } else {
    // Learner with no company: fall back to all published (legacy behaviour)
    const res = await supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .eq('is_published', true)
      .order('created_at', { ascending: true })
    data = res.data
    error = res.error
  }

  const courses: CourseRow[] = data ?? []

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      {/* Head */}
      <header className="flex items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" /> Catalog
          </div>
          <h1 className="mt-2 text-[36px] font-bold leading-[1.05] tracking-[-0.02em]">
            Learn the AI stack, end to end.
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[15px] text-muted-foreground">
            Cohort-based courses taught by engineers shipping AI in production.
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-[28px] font-bold tracking-[-0.02em]">{courses.length}</div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Courses</div>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load courses. Refresh the page to try again.
        </div>
      )}

      {!error && courses.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-[20px] font-semibold">No courses available yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Check back soon — courses are being added.</p>
        </div>
      )}

      {!error && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const hue = hueFor(course.id)
            return (
              <Link
                key={course.id}
                href={`/catalog/${course.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_36px_rgba(0,0,0,0.4),0_0_0_1px_rgba(139,92,246,0.15)]"
              >
                <div
                  className="relative grid aspect-video place-items-center overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.4),transparent_60%)]" />
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="absolute inset-0 h-full w-full object-cover opacity-90" />
                  ) : (
                    <span className="relative z-10 font-mono text-[64px] font-bold text-white/95 drop-shadow-[0_0_32px_rgba(0,0,0,0.5)]">
                      {hue.icon}
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 z-10 flex gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white backdrop-blur-md">
                      <PlayCircle size={11} /> Course
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
                    <span>Self-paced</span>
                    <span className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-400">
                      <Star size={11} fill="currentColor" /> 4.9
                    </span>
                  </div>
                  <h3 className="text-[16px] font-semibold leading-[1.3] tracking-[-0.01em]">{course.title}</h3>
                  <p className="line-clamp-2 flex-1 text-[12.5px] leading-[1.55] text-muted-foreground">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between gap-2.5 border-t border-border pt-2.5">
                    <div className="text-[12px] font-semibold">View course</div>
                    <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-border bg-secondary text-muted-foreground transition-all group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
