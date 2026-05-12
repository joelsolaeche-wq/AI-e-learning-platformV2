// Shared regex constants. Each pattern previously appeared inline in
// several files (UUID_RE in 6 route handlers, EMAIL_RE in 3 actions and
// the CSV import form). Importing from this module keeps the definitions
// in sync and reduces the chance of subtle divergence (e.g. case
// sensitivity flags drifting between callsites).

/** Matches a canonical UUID string (case-insensitive). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Permissive email pattern — `something@something.something` with no whitespace. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}
