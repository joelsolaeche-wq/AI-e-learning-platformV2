import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Plus } from 'lucide-react'
import { listAllCoursesForAdmin } from '@/lib/queries/admin/courses.queries'

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  archived: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

export default async function AdminCoursesPage() {
  const rows = await listAllCoursesForAdmin()
  if (rows === null) redirect('/admin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground">{rows.length} courses total</p>
        </div>
        <Link
          href="/admin/courses/new"
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New course
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Created</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((course) => {
                const status = course.status ?? 'draft'
                return (
                  <tr key={course.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium">{course.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? ''}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(course.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
