import { CourseForm } from '@/components/admin/CourseForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function NewCoursePage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Courses
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New course</h1>
      </div>
      <CourseForm />
    </div>
  )
}
