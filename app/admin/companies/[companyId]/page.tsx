import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { CompanyCourseAssignment } from '@/components/admin/CompanyCourseAssignment'
import { CompanyUsersPanel } from '@/components/admin/CompanyUsersPanel'

export default async function EditCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const admin = createAdminClient()

  const [companyRes, allCoursesRes, assignedRes, usersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('*').eq('id', companyId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title, slug').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('course_companies').select('course_id').eq('company_id', companyId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('org_id', companyId)
      .order('full_name'),
  ])

  if (!companyRes.data) notFound()

  const assignedCourseIds: string[] = (assignedRes.data ?? []).map((r: { course_id: string }) => r.course_id)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link
          href="/admin/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Companies
        </Link>
        <h1 className="mt-3 text-2xl font-bold">{companyRes.data.name}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h2>
        <CompanyForm company={companyRes.data} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Assigned courses</h2>
        <CompanyCourseAssignment
          companyId={companyId}
          allCourses={allCoursesRes.data ?? []}
          assignedCourseIds={assignedCourseIds}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Members ({(usersRes.data ?? []).length})
        </h2>
        <CompanyUsersPanel users={usersRes.data ?? []} companyId={companyId} />
      </section>
    </div>
  )
}
