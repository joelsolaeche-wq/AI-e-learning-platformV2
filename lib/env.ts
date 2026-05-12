// Centralized environment-variable access. This is the single import point
// for env values across the codebase — do not read `process.env.X` directly
// from feature modules. The boundary lives here so a missing or misnamed
// var fails loudly at app startup instead of in a downstream callsite at
// request time, and so future migration to a typed loader (zod, t3-env)
// is a one-file change.
//
// Notes:
//   - `required` keys throw on module load if any are missing.
//   - Server-only keys (service role, AI provider keys, github token) are
//     left as `string | undefined`. Each consumer module is expected to
//     throw or no-op if its required key isn't set; see lib/ai/model.ts
//     for the pattern.
//   - `NEXT_PUBLIC_*` keys are inlined by Next.js at build time and are
//     safe to read from client components.

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
] as const

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

type AiProvider = 'anthropic' | 'openrouter'

function resolveAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? 'openrouter').toLowerCase().trim()
  if (raw === 'anthropic' || raw === 'openrouter') return raw
  throw new Error(
    `[env] Unknown AI_PROVIDER="${raw}". Use "anthropic" or "openrouter".`,
  )
}

export const env = {
  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // App
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL!,

  // AI provider (server-only)
  aiProvider: resolveAiProvider(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,

  // GitHub (server-only, optional — used by the lab evaluator to raise the
  // unauthenticated rate-limit ceiling from ~60/hr to ~5000/hr.)
  githubToken: process.env.GITHUB_TOKEN,
} as const
