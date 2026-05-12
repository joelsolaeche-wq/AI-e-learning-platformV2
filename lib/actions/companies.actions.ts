'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/auth/guards'

export type CompanyActionResult = { error: string | null; success?: boolean; id?: string }

export async function createCompanyAction(
  _prevState: CompanyActionResult,
  formData: FormData,
): Promise<CompanyActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const logo_url = (formData.get('logo_url') as string | null)?.trim() || null
  const website = (formData.get('website') as string | null)?.trim() || null

  if (!name) return { error: 'Company name is required.' }
  if (name.length > 100) return { error: 'Name cannot exceed 100 characters.' }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('organizations')
    .insert({ name, slug, description, logo_url, website })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/companies')
  return { error: null, success: true, id: data.id }
}

export async function updateCompanyAction(
  _prevState: CompanyActionResult,
  formData: FormData,
): Promise<CompanyActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const companyId = formData.get('company_id') as string
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const logo_url = (formData.get('logo_url') as string | null)?.trim() || null
  const website = (formData.get('website') as string | null)?.trim() || null

  if (!companyId) return { error: 'Company ID is required.' }
  if (!name) return { error: 'Company name is required.' }
  if (name.length > 100) return { error: 'Name cannot exceed 100 characters.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('organizations')
    .update({ name, description, logo_url, website })
    .eq('id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${companyId}`)
  return { error: null, success: true }
}

export async function archiveCompanyAction(companyId: string): Promise<CompanyActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('organizations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${companyId}`)
  return { error: null, success: true }
}

export async function restoreCompanyAction(companyId: string): Promise<CompanyActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('organizations')
    .update({ deleted_at: null })
    .eq('id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${companyId}`)
  return { error: null, success: true }
}

async function assertAdminOrCompanyOwnerFor(companyId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles').select('role, org_id').eq('id', user.id).single()
  if (profile?.role === 'admin') return true
  if (profile?.role === 'company_owner' && profile?.org_id === companyId) return true
  return false
}

export async function assignCourseToCompanyAction(
  courseId: string,
  companyId: string,
): Promise<CompanyActionResult> {
  if (!(await assertAdminOrCompanyOwnerFor(companyId))) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('course_companies')
    .upsert({ course_id: courseId, company_id: companyId })

  if (error) return { error: error.message }
  revalidatePath(`/admin/companies/${companyId}`)
  revalidatePath('/catalog')
  return { error: null, success: true }
}

export async function unassignCourseFromCompanyAction(
  courseId: string,
  companyId: string,
): Promise<CompanyActionResult> {
  if (!(await assertAdminOrCompanyOwnerFor(companyId))) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('course_companies')
    .delete()
    .eq('course_id', courseId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/companies/${companyId}`)
  revalidatePath('/catalog')
  return { error: null, success: true }
}
