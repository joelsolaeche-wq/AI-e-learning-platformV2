import { CSVImportForm } from '@/components/admin/CSVImportForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ImportUsersPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Import users</h1>
          <p className="text-sm text-muted-foreground">Bulk-create users from a CSV file</p>
        </div>
      </div>
      <CSVImportForm />
    </div>
  )
}
