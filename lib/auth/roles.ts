// Role constants and labels.
//
// Source of truth is the CHECK constraint on profiles.role in
// supabase/migrations/20260506000001_company_workspace.sql. The TypeScript
// `Role` type narrows the `string` column to a discriminated union; if you
// add a new role to the DB constraint, add it here AND update assignable
// matrices in callers that touch role assignment (createUserAction, etc.).

export const ALL_ROLES = ['learner', 'instructor', 'admin', 'company_owner'] as const
export type Role = (typeof ALL_ROLES)[number]

// Pre-built subsets for the most common gates. Use these in guards and
// route handlers; do not inline `['admin', 'instructor', …]` arrays.
export const ADMIN_ONLY = ['admin'] as const satisfies readonly Role[]
export const ADMIN_OR_OWNER = ['admin', 'company_owner'] as const satisfies readonly Role[]
export const ADMIN_OR_INSTRUCTOR = ['admin', 'instructor'] as const satisfies readonly Role[]
export const ADMIN_OR_INSTRUCTOR_OR_OWNER = [
  'admin',
  'instructor',
  'company_owner',
] as const satisfies readonly Role[]

// Display strings for UI surfaces (forms, role chips). Keep in sync with ALL_ROLES.
export const ROLE_LABELS: Record<Role, string> = {
  learner: 'Learner',
  instructor: 'Instructor',
  admin: 'Admin',
  company_owner: 'Company Owner',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value)
}
