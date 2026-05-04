import { CompanyForm } from '@/components/admin/CompanyForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function NewCompanyPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Companies
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New company</h1>
      </div>
      <CompanyForm />
    </div>
  )
}
