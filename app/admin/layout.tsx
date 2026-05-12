import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  type AdminProfileLookup = { role: string; full_name: string | null; avatar_url: string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single<AdminProfileLookup>()

  if (!profile || !['admin', 'instructor', 'company_owner'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const sidebarUser = {
    email: user.email ?? '',
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar user={sidebarUser} role={profile.role} />
      <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
    </div>
  )
}
