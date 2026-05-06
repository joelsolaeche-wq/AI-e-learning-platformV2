import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Building2, Users, BookOpen, UsersRound } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'instructor', 'company_owner'].includes(profile?.role)) redirect('/dashboard')

  const role = profile?.role as string
  const fullNav = role === 'admin' || role === 'instructor'

  type NavItem = { href: string; label: string; Icon: React.ElementType }
  const NAV: NavItem[] = [
    ...(fullNav ? [{ href: '/admin/users', label: 'Users', Icon: Users }] : []),
    { href: '/admin/companies', label: 'Companies', Icon: Building2 },
    ...(fullNav ? [
      { href: '/admin/courses', label: 'Courses', Icon: BookOpen },
      { href: '/admin/cohorts', label: 'Cohorts', Icon: UsersRound },
    ] : []),
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 h-screen w-52 shrink-0 flex flex-col border-r border-border bg-card px-3 py-5">
        <div className="px-2 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin panel
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Icon size={15} strokeWidth={1.6} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <LayoutDashboard size={15} strokeWidth={1.6} />
            Back to dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
    </div>
  )
}
