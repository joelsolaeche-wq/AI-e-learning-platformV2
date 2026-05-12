import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LAB_PDF_MAX_BYTES } from '@/lib/constants/limits'
import { uploadLabPdf } from '@/lib/storage/lab-uploads'

// POST /api/labs/upload — multipart form-data with a single `file` field.
// Verifies the caller is logged in, rejects non-PDFs, and stores the file at
// `lab-submissions/{userId}/{timestamp}-{slug}.pdf`. Returns the storage path
// the client can pass to /api/labs/submit.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing `file` field.' }, { status: 400 })
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF uploads are supported.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file.' }, { status: 400 })
  }
  if (file.size > LAB_PDF_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${LAB_PDF_MAX_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const result = await uploadLabPdf({
    userId: user.id,
    bytes: new Uint8Array(arrayBuffer),
    filename: file.name,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ path: result.path, sizeBytes: file.size, filename: file.name })
}
