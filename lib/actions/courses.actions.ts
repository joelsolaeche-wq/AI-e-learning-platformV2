'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { assertAdminOrInstructor } from '@/lib/auth/guards'

export type CourseActionResult = { error: string | null; success?: boolean; id?: string }

export async function createCourseAction(
  _prevState: CourseActionResult,
  formData: FormData,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const thumbnail_url = (formData.get('thumbnail_url') as string | null)?.trim() || null
  const status = (formData.get('status') as string) || 'draft'

  if (!title) return { error: 'Title is required.' }
  if (!['draft', 'published', 'archived'].includes(status)) return { error: 'Invalid status.' }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 7)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('courses')
    .insert({
      title,
      slug,
      description,
      thumbnail_url,
      status,
      is_published: status === 'published',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath('/catalog')
  return { error: null, success: true, id: data.id }
}

export async function updateCourseAction(
  _prevState: CourseActionResult,
  formData: FormData,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const courseId = formData.get('course_id') as string
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const thumbnail_url = (formData.get('thumbnail_url') as string | null)?.trim() || null
  const status = (formData.get('status') as string) || 'draft'

  if (!courseId) return { error: 'Course ID is required.' }
  if (!title) return { error: 'Title is required.' }
  if (!['draft', 'published', 'archived'].includes(status)) return { error: 'Invalid status.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('courses')
    .update({
      title,
      description,
      thumbnail_url,
      status,
      is_published: status === 'published',
    })
    .eq('id', courseId)

  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/catalog')
  return { error: null, success: true }
}

export async function duplicateCourseAction(courseId: string): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()

  // Fetch original course
  const { data: original, error: fetchErr } = await admin
    .from('courses')
    .select('title, description, thumbnail_url')
    .eq('id', courseId)
    .single()

  if (fetchErr || !original) return { error: 'Course not found.' }

  const newTitle = `${original.title} (Copy)`
  const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 7)

  const { data: newCourse, error: insertErr } = await admin
    .from('courses')
    .insert({
      title: newTitle,
      slug: newSlug,
      description: original.description,
      thumbnail_url: original.thumbnail_url,
      status: 'draft',
      is_published: false,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  // Duplicate modules and lessons
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, position')
    .eq('course_id', courseId)
    .order('position')

  for (const mod of modules ?? []) {
    const { data: newMod } = await admin
      .from('modules')
      .insert({ course_id: newCourse.id, title: mod.title, position: mod.position })
      .select('id')
      .single()

    if (!newMod) continue

    const { data: lessons } = await admin
      .from('lessons')
      .select('title, position, mux_playback_id, duration_seconds, transcript')
      .eq('module_id', mod.id)
      .order('position')

    for (const lesson of lessons ?? []) {
      await admin
        .from('lessons')
        .insert({
          module_id: newMod.id,
          title: lesson.title,
          position: lesson.position,
          mux_playback_id: lesson.mux_playback_id,
          duration_seconds: lesson.duration_seconds,
          transcript: lesson.transcript,
        })
    }
  }

  revalidatePath('/admin/courses')
  return { error: null, success: true, id: newCourse.id }
}

export async function createModuleAction(
  courseId: string,
  title: string,
  position: number,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('modules')
    .insert({ course_id: courseId, title: title.trim(), position })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true, id: data.id }
}

export async function updateModuleAction(
  moduleId: string,
  courseId: string,
  title: string,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('modules')
    .update({ title: title.trim() })
    .eq('id', moduleId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true }
}

export async function deleteModuleAction(moduleId: string, courseId: string): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('modules')
    .delete()
    .eq('id', moduleId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true }
}

export async function createLessonAction(
  moduleId: string,
  courseId: string,
  title: string,
  position: number,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lessons')
    .insert({ module_id: moduleId, title: title.trim(), position })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true, id: data.id }
}

export async function updateLessonAction(
  _prevState: CourseActionResult,
  formData: FormData,
): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const lessonId = formData.get('lesson_id') as string
  const courseId = formData.get('course_id') as string
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const mux_playback_id = (formData.get('mux_playback_id') as string | null)?.trim() || null
  const duration_seconds_raw = formData.get('duration_seconds') as string | null
  const duration_seconds = duration_seconds_raw ? parseInt(duration_seconds_raw, 10) : null
  const transcript = (formData.get('transcript') as string | null)?.trim() || null
  const content_type = (formData.get('content_type') as string | null) || 'video'
  const document_url = (formData.get('document_url') as string | null)?.trim() || null
  const slides_url = (formData.get('slides_url') as string | null)?.trim() || null
  const notebook_url = (formData.get('notebook_url') as string | null)?.trim() || null

  if (!lessonId) return { error: 'Lesson ID is required.' }
  if (!title) return { error: 'Title is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lessons')
    .update({ title, mux_playback_id, duration_seconds, transcript, content_type, document_url, slides_url, notebook_url })
    .eq('id', lessonId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true }
}

export async function deleteLessonAction(lessonId: string, courseId: string): Promise<CourseActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lessons')
    .delete()
    .eq('id', lessonId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/courses/${courseId}`)
  return { error: null, success: true }
}
