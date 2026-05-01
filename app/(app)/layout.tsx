// app/(app)/layout.tsx
// Shared chrome (Sidebar + TopBar + TutorPanel) for both /dashboard/* and /catalog/*.
// (app) is a Next.js route group — directory name in parens does NOT appear in URLs.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { TutorPanel } from '@/components/TutorPanel'
import { getLearnerStats } from '@/lib/learner-stats'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const profileData = (profile as { full_name: string | null; email: string; avatar_url: string | null; role: string | null } | null)
  const sidebarUser = {
    email: profileData?.email ?? user.email ?? '',
    full_name: profileData?.full_name ?? null,
    avatar_url: profileData?.avatar_url ?? null,
    role: profileData?.role ?? null,
  }

  // Last-visited lesson for the Sidebar "Lesson" nav item
  const { data: lastProgress } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastLessonHref = (lastProgress as unknown as { lesson_id: string } | null)?.lesson_id
    ? `/dashboard/lesson/${(lastProgress as unknown as { lesson_id: string }).lesson_id}`
    : undefined

  // Real learner stats (XP, level, streak) — derived from lesson_progress + quiz_attempts
  const stats = await getLearnerStats(supabase, user.id)

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr]">
      <Sidebar
        user={sidebarUser}
        streakDays={stats.currentStreakDays}
        lastLessonHref={lastLessonHref}
      />
      <div className="flex min-w-0 flex-col">
        <TopBar
          level={stats.level}
          xp={stats.xp}
          xpToNext={stats.xpForNextLevel}
        />
        <div className="px-10 pb-20 pt-6">{children}</div>
      </div>
      {/* Floating AI tutor — global to all dashboard routes */}
      <TutorPanel />
    </div>
  )
}
