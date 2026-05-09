// app/(app)/dashboard/company/[companyId]/page.tsx
//
// Tier 2 of the Mati drilldown: company → cohorts → courses.
// Shows the cohorts within a single company that the learner is enrolled in.
// Click a cohort card → /dashboard/cohort/[cohortId] (tier 3, courses).

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ChevronRight, Building2, Users } from 'lucide-react'
import { CohortCard } from '@/components/cohorts/CohortCard'

type CohortRow = {
  id: string
  title: string
  status: string
  starts_at: string
  ends_at: string | null
  course_id: string
  company_id: string | null
  image_url: string | null
}

export default async function DashboardCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1. Pull the user's active enrollments. Filter to cohorts in THIS company.
  const { data: enrollmentsRaw } = await supabase
    .from('enrollments')
    .select('id, cohort_id, enrolled_at')
    .eq('user_id', user.id)
    .eq('status', 'active')

  type EnrollmentRow = { id: string; cohort_id: string; enrolled_at: string }
  const enrollments = (enrollmentsRaw ?? []) as EnrollmentRow[]
  const cohortIds = enrollments.map((e) => e.cohort_id)

  // 2. Hydrate cohorts. Filter to those in this company.
  const cohortsInCompany: CohortRow[] = []
  if (cohortIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cohortRes = await (supabase as any)
      .from('cohorts')
      .select('id, title, status, starts_at, ends_at, course_id, company_id, image_url')
      .in('id', cohortIds)
      .eq('company_id', companyId)
    if (cohortRes.error) {
      // Schema-cache fallback (image_url just added).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (supabase as any)
        .from('cohorts')
        .select('id, title, status, starts_at, ends_at, course_id, company_id')
        .in('id', cohortIds)
        .eq('company_id', companyId)
      cohortRes = {
        data: ((fallback.data ?? []) as Array<Omit<CohortRow, 'image_url'>>).map(
          (c) => ({ ...c, image_url: null }) as CohortRow,
        ),
        error: null,
      }
    }
    cohortsInCompany.push(...(cohortRes.data as CohortRow[]))
  }

  // No matching cohorts → either the user isn't actually in this company or
  // the URL was tampered with. Show a not-found rather than leak existence.
  if (cohortsInCompany.length === 0) notFound()

  // 3. Fetch the organization (for header). RLS already restricts to allowed
  //    rows — if hidden, fall back to a generic header.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgData } = await (supabase as any)
    .from('organizations')
    .select('id, name, logo_url, description')
    .eq('id', companyId)
    .maybeSingle()
  const company = orgData as
    | { id: string; name: string; logo_url: string | null; description: string | null }
    | null

  // 4. Active member count per cohort (single query, then group).
  const memberCount = new Map<string, number>()
  if (cohortsInCompany.length > 0) {
    const { data: memberRows } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', cohortsInCompany.map((c) => c.id))
      .eq('status', 'active')
    for (const r of (memberRows ?? []) as { cohort_id: string }[]) {
      memberCount.set(r.cohort_id, (memberCount.get(r.cohort_id) ?? 0) + 1)
    }
  }

  const enrollmentByCohort = new Map(enrollments.map((e) => [e.cohort_id, e]))

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      {/* Back link + company header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ChevronLeft size={14} /> Your companies
        </Link>

        <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(139,92,246,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-10 py-8">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_rgba(139,92,246,0.45)]">
                  <Building2 size={26} className="text-white" />
                </div>
              )}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                  <Building2 size={12} /> Company
                </div>
                <h1 className="my-2 text-[30px] font-bold leading-[1.08] tracking-[-0.02em]">
                  {company?.name ?? 'Your company'}
                </h1>
                {company?.description && (
                  <p className="max-w-[640px] text-[13.5px] text-muted-foreground">{company.description}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
              <div className="text-[10.5px] uppercase tracking-[0.07em] text-cyan-400">Your cohorts</div>
              <div className="mt-1 font-mono text-[20px] font-bold tabular-nums">
                {cohortsInCompany.length}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Cohort grid */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[18px] font-bold tracking-tight">Cohorts you&apos;re in</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohortsInCompany.map((cohort) => {
            const enrollment = enrollmentByCohort.get(cohort.id)
            const isNew = enrollment
              ? Date.now() - new Date(enrollment.enrolled_at).getTime() < 48 * 60 * 60 * 1000
              : false
            return (
              <CohortCard
                key={cohort.id}
                variant="admin"
                cohort={{
                  id: cohort.id,
                  title: cohort.title,
                  status: cohort.status,
                  starts_at: cohort.starts_at,
                  ends_at: cohort.ends_at,
                  image_url: cohort.image_url,
                }}
                memberCount={memberCount.get(cohort.id) ?? 0}
                isNew={isNew}
                primaryHref={`/dashboard/cohort/${cohort.id}`}
              />
            )
          })}
        </div>

        {cohortsInCompany.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center">
            <Users size={32} className="text-muted-foreground/40" />
            <div className="text-[14px] font-semibold">No cohorts yet</div>
            <div className="text-[12.5px] text-muted-foreground">
              You&apos;re not in any cohort with this company yet.
            </div>
            <Link
              href="/catalog"
              className="mt-2 inline-flex items-center gap-1 rounded-[10px] border border-border bg-card px-4 py-2 text-[12.5px] font-semibold hover:bg-secondary"
            >
              Browse catalog <ChevronRight size={12} />
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
