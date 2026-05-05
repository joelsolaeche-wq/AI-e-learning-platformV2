import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewUserForm } from '@/components/admin/NewUserForm'

export default function NewUserPage() {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Users
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New user</h1>
      </div>
      <NewUserForm />
    </div>
  )
}
