// app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { TutorPanel } from '@/components/TutorPanel'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const profileData = (profile as { full_name: string | null; email: string } | null)
  const sidebarUser = {
    email: profileData?.email ?? user.email ?? '',
    full_name: profileData?.full_name ?? null,
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

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr]">
      <Sidebar user={sidebarUser} streakDays={7} lastLessonHref={lastLessonHref} />
      <div className="flex min-w-0 flex-col">
        <TopBar level={7} xp={2340} xpToNext={3800} notificationCount={3} />
        <div className="px-10 pb-20 pt-6">{children}</div>
      </div>
      {/* Floating AI tutor — global to all dashboard routes */}
      <TutorPanel />
    </div>
  )
}
