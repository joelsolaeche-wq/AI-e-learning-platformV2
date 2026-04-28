import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/database.types'

type CourseRow = Pick<
  Database['public']['Tables']['courses']['Row'],
  'id' | 'title' | 'slug' | 'description' | 'thumbnail_url'
>

export default async function CatalogPage() {
  const supabase = await createClient()

  // Belt-and-suspenders auth check (middleware already guards /catalog)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug, description, thumbnail_url')
    .eq('is_published', true)
    .order('created_at', { ascending: true })

  const courses: CourseRow[] = data ?? []

  return (
    <main className="mx-auto w-full max-w-[1280px] px-8 pt-12 pb-16">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          AI Course Catalog
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cohort-based AI learning for enterprise teams
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load courses. Refresh the page to try again.
        </div>
      )}

      {!error && courses.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-[20px] font-semibold">No courses available yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check back soon — courses are being added.
          </p>
        </div>
      )}

      {!error && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="overflow-hidden border-border bg-card transition-shadow hover:border-accent hover:shadow-sm"
            >
              {/* 16:9 thumbnail */}
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">No preview</span>
                  </div>
                )}
              </div>

              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug">{course.title}</h2>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    AI
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-2">
                <Button asChild className="w-full" size="sm">
                  <Link href={`/catalog/${course.id}`}>View Course</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
