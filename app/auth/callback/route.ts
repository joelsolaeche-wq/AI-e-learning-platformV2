import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Restrict the `next` query param to a same-origin relative path. Without
// this check, a payload like `next=@evil.tld/phish` produces a Location
// header of `https://<app>@evil.tld/phish` — the WHATWG URL parser treats
// `<app>` as userinfo and `evil.tld` as host, so the user authenticates on
// our domain and then lands cross-origin on a credential-harvesting clone.
// The pattern requires:
//   - leading `/`           (relative path)
//   - second char NOT `/`   (blocks `//evil.tld/...` protocol-relative)
//   - no `\`                (blocks browsers that normalize `\` to `/`)
const SAFE_NEXT_PATH = /^\/(?!\/)[^\\]*$/

function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard'
  return SAFE_NEXT_PATH.test(raw) ? raw : '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=auth_callback_failed`
  )
}
