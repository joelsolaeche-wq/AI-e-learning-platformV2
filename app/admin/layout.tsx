import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!['admin', 'instructor', 'company_owner'].includes(profile?.role)) redirect('/dashboard')

  const sidebarUser = {
    email: user.email ?? '',
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    role: profile?.role as string,
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar user={sidebarUser} role={profile?.role as string} />
      <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
    </div>
  )
}
