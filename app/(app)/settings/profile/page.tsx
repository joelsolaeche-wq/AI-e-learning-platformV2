import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile/ProfileForm'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email, role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { full_name: string | null; avatar_url: string | null; email: string; role: string } | null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Profile & settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and avatar. Your email ({profile?.email}) cannot be changed here.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <ProfileForm
          initialFullName={profile?.full_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-sm font-semibold">Password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          To change your password, use the password reset flow.
        </p>
        <a
          href="/auth/forgot-password"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Change password →
        </a>
      </div>
    </div>
  )
}
