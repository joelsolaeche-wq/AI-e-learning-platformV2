import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 25 MB — also enforced at the storage bucket level.
const MAX_PDF_SIZE = 25 * 1024 * 1024

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
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_PDF_SIZE / (1024 * 1024)} MB.` },
      { status: 413 },
    )
  }

  // Slug the filename so paths stay predictable. Keep the original extension
  // (already validated as .pdf above).
  const safeName = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .slice(0, 80)
  const path = `${user.id}/${Date.now()}-${safeName || 'submission'}.pdf`

  // Use service role — the storage RLS policy permits inserts where the path
  // prefix matches auth.uid(), but the server route already enforces that
  // explicitly above. Service role keeps this resilient even if storage RLS
  // is later tightened.
  const admin = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error } = await admin.storage
    .from('lab-submissions')
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ path, sizeBytes: file.size, filename: file.name })
}
