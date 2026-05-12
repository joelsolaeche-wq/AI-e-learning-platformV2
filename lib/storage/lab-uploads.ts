// lib/storage/lab-uploads.ts
//
// Storage helpers for lab PDF submissions. Keeps `createAdminClient` out of
// route handlers so CLAUDE.md layer rule #1 ("service-role isolation") is
// observed strictly.
//
// Service-role is used so the upload stays working even if the bucket's
// RLS policy is later tightened (e.g. requiring `auth.uid()` to match the
// path prefix exactly). The CALLER is responsible for verifying that
// `userId` belongs to the authenticated session before invoking this —
// otherwise one user could write to another user's path prefix.

import { createAdminClient } from '@/lib/supabase/admin'

export type LabPdfUploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

/**
 * Uploads a PDF to the `lab-submissions` storage bucket under
 * `{userId}/{timestamp}-{slug}.pdf`. Returns the storage path on success.
 *
 * Caller MUST verify the userId belongs to the authenticated session
 * before invoking — this helper trusts its input.
 */
export async function uploadLabPdf(opts: {
  userId: string
  bytes: Uint8Array
  /** Original filename from the upload form. Will be slug'd before use. */
  filename: string
}): Promise<LabPdfUploadResult> {
  // Slug the filename so storage paths stay predictable. Keep the .pdf
  // extension; the route handler already validated the content type.
  const safeName = opts.filename
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .slice(0, 80)
  const path = `${opts.userId}/${Date.now()}-${safeName || 'submission'}.pdf`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('lab-submissions')
    .upload(path, opts.bytes, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}
