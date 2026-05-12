import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_USER_SEARCH_LIMIT } from '@/lib/constants/limits'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'instructor'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const admin = createAdminClient()
  // Search by partial email or full_name match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('profiles')
    .select('id, email, full_name')
    .or(`email.ilike.%${email.toLowerCase().trim()}%,full_name.ilike.%${email.trim()}%`)
    .limit(ADMIN_USER_SEARCH_LIMIT)

  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ results: data })
}
