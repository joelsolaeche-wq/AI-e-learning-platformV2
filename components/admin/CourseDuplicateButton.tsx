'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { duplicateCourseAction } from '@/lib/actions/courses.actions'

export function CourseDuplicateButton({ courseId }: { courseId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateCourseAction(courseId)
      if (result.id) router.push(`/admin/courses/${result.id}`)
    })
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={isPending}
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50 transition-colors"
    >
      <Copy size={13} />
      {isPending ? 'Duplicating…' : 'Duplicate'}
    </button>
  )
}
