'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Beaker, GitBranch, FileText, FileType, Loader2, Star, AlertCircle, RotateCcw, Upload, CheckCircle2 } from 'lucide-react'
import { LAB_TEXT_MIN_CHARS, LAB_TEXT_MAX_CHARS } from '@/lib/constants/limits'

export type LabRubricItem = {
  id: string
  position: number
  criterion: string
  description: string
  weight: number
}

export type SubmissionType = 'github' | 'pdf' | 'text'

export type LabSubmission = {
  id: string
  status: 'pending' | 'evaluating' | 'scored' | 'failed'
  submission_type: SubmissionType
  github_url: string | null
  pdf_path: string | null
  text_content: string | null
  overall_stars: number | null
  total_score: number
  max_score: number
  summary_md: string | null
  error_message: string | null
  submitted_at: string
  scored_at: string | null
  scores: Array<{ rubric_item_id: string; stars: number; feedback_md: string }>
}

export type LabData = {
  id: string
  title: string
  brief_md: string
  rubric_items: LabRubricItem[]
}

interface Props {
  lessonId: string
  lab: LabData | null
  latestSubmission: LabSubmission | null
}

const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/

function describeSubmission(submission: LabSubmission): string {
  if (submission.submission_type === 'github') {
    return submission.github_url ?? '(repo url missing)'
  }
  if (submission.submission_type === 'pdf') {
    if (!submission.pdf_path) return '(pdf missing)'
    const filename = submission.pdf_path.split('/').pop() ?? submission.pdf_path
    return filename.replace(/^\d+-/, '')
  }
  // text
  if (!submission.text_content) return '(written response empty)'
  return submission.text_content.length > 80
    ? submission.text_content.slice(0, 77) + '…'
    : submission.text_content
}

export function LabSection({ lessonId, lab, latestSubmission }: Props) {
  const router = useRouter()
  const [submissionType, setSubmissionType] = useState<SubmissionType>('github')
  const [githubUrl, setGitBranchUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  if (!lab) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Lab
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
          No lab for this lesson yet.
        </div>
      </section>
    )
  }

  async function handleSubmit() {
    setError(null)

    // Build the submission body based on the active type.
    const body: Record<string, unknown> = { lessonId, submissionType }

    if (submissionType === 'github') {
      const trimmed = githubUrl.trim()
      if (!GITHUB_URL_RE.test(trimmed)) {
        setError('Enter a valid public GitHub repo URL (https://github.com/owner/repo).')
        return
      }
      body.githubUrl = trimmed
    } else if (submissionType === 'text') {
      const trimmed = textContent.trim()
      if (trimmed.length < LAB_TEXT_MIN_CHARS) {
        setError(`Written response must be at least ${LAB_TEXT_MIN_CHARS} characters.`)
        return
      }
      if (trimmed.length > LAB_TEXT_MAX_CHARS) {
        setError(`Written response too long (max ${LAB_TEXT_MAX_CHARS} characters).`)
        return
      }
      body.textContent = trimmed
    } else {
      // pdf
      if (!pdfFile) {
        setError('Pick a PDF to upload.')
        return
      }
    }

    setSubmitting(true)
    try {
      // Step 1 (PDF only): upload the file, then pass the path along.
      if (submissionType === 'pdf' && pdfFile) {
        const form = new FormData()
        form.append('file', pdfFile)
        const uploadRes = await fetch('/api/labs/upload', { method: 'POST', body: form })
        if (!uploadRes.ok) {
          const errBody = (await uploadRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(errBody.error ?? `Upload failed (${uploadRes.status}).`)
        }
        const uploadData = (await uploadRes.json()) as { path: string }
        body.pdfPath = uploadData.path
      }

      // Step 2: submit and let the evaluator run (synchronous, ~30–90s).
      const res = await fetch('/api/labs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error ?? `Submission failed (${res.status}).`)
      }
      setGitBranchUrl('')
      setTextContent('')
      setPdfFile(null)
      setResetting(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const showResultUi = latestSubmission && latestSubmission.status === 'scored'
  const showPendingUi =
    latestSubmission &&
    (latestSubmission.status === 'pending' || latestSubmission.status === 'evaluating')
  const showFailedUi = latestSubmission && latestSubmission.status === 'failed'
  const showSubmitForm = !latestSubmission || resetting
  const hasStateBlock = showResultUi || showPendingUi || showFailedUi

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Lab
      </h2>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Beaker size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold truncate">{lab.title}</p>
            <p className="text-[12px] text-muted-foreground">
              {lab.rubric_items.length} criteria · graded by AI on submit
            </p>
          </div>
        </div>

        {/* Brief */}
        {lab.brief_md && (
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Brief
            </h3>
            <div className="text-[13.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {lab.brief_md}
            </div>
          </div>
        )}

        {/* State block — only when a submission exists */}
        {hasStateBlock && latestSubmission && (
          <div className="border-b border-border bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent px-5 py-5">
            {showResultUi && (
              <ResultBlock
                submission={latestSubmission}
                rubric={lab.rubric_items}
                onRetry={() => setResetting(true)}
              />
            )}
            {showPendingUi && <PendingBlock submission={latestSubmission} />}
            {showFailedUi && (
              <FailedBlock submission={latestSubmission} onRetry={() => setResetting(true)} />
            )}
          </div>
        )}

        {/* Rubric — always visible reference */}
        <div className={'px-5 py-4 ' + (showSubmitForm ? 'pb-6' : '')}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            How you&apos;ll be graded
          </h3>
          <ul className="space-y-2">
            {lab.rubric_items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-secondary/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13.5px] font-semibold">
                    <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                      #{item.position}
                    </span>
                    {item.criterion}
                  </p>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] text-muted-foreground">
                    weight ×{item.weight}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky submit footer — pinned to viewport while reading brief + rubric */}
      {showSubmitForm && (
        <div className="sticky bottom-4 z-20 mt-2">
          <div className="rounded-2xl border border-primary/40 bg-card/85 backdrop-blur-md p-4 sm:p-5 ring-1 ring-primary/20 shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
                  {submissionType === 'github' ? <GitBranch size={15} /> : submissionType === 'pdf' ? <FileType size={15} /> : <FileText size={15} />}
                </div>
                <h3 className="text-[15.5px] font-semibold tracking-tight">
                  {submissionType === 'github' ? 'Submit your repository' : submissionType === 'pdf' ? 'Submit a PDF' : 'Write your response'}
                </h3>
              </div>
              {/* Segmented control */}
              <div className="inline-flex shrink-0 rounded-xl border border-border bg-secondary/40 p-1">
                {(['github', 'pdf', 'text'] as const).map((t) => {
                  const active = submissionType === t
                  const Icon = t === 'github' ? GitBranch : t === 'pdf' ? FileType : FileText
                  const label = t === 'github' ? 'Repo' : t === 'pdf' ? 'PDF' : 'Written'
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setSubmissionType(t); setError(null) }}
                      className={
                        'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-colors ' +
                        (active
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                          : 'text-muted-foreground hover:text-foreground')
                      }
                    >
                      <Icon size={12} /> {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="mt-3 mb-3 text-[12.5px] text-muted-foreground">
              {submissionType === 'github' && 'Paste a public GitHub URL — the AI grades it against the rubric above.'}
              {submissionType === 'pdf' && 'Upload a PDF — the AI reads it directly and grades against the rubric above.'}
              {submissionType === 'text' && `Write 200–${LAB_TEXT_MAX_CHARS.toLocaleString()} characters — the AI grades the response against the rubric above.`}
            </p>

            {submissionType === 'github' && (
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGitBranchUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="h-11 flex-1 rounded-xl border border-input bg-background/60 px-4 text-[14px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <SubmitButton submitting={submitting} onClick={handleSubmit} label="Submit repository" />
              </div>
            )}

            {submissionType === 'pdf' && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-background/60 px-4 py-3 cursor-pointer hover:border-primary/60 transition-colors">
                  <div className="flex min-w-0 items-center gap-2">
                    {pdfFile ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Upload size={16} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate text-[13.5px]">
                      {pdfFile ? pdfFile.name : 'Choose a PDF…'}
                    </span>
                    {pdfFile && (
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">
                        {(pdfFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <span className="shrink-0 rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-[11.5px] text-muted-foreground">
                    Browse
                  </span>
                </label>
                <div className="flex justify-end">
                  <SubmitButton submitting={submitting} onClick={handleSubmit} label="Submit PDF" />
                </div>
              </div>
            )}

            {submissionType === 'text' && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type your response here…"
                  rows={5}
                  className="resize-y rounded-xl border border-input bg-background/60 px-4 py-3 text-[14px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span className={textContent.length > 0 && textContent.length < LAB_TEXT_MIN_CHARS ? 'text-amber-400' : ''}>
                    {textContent.length.toLocaleString()} / {LAB_TEXT_MAX_CHARS.toLocaleString()} chars
                    {textContent.length > 0 && textContent.length < LAB_TEXT_MIN_CHARS && ` · ${LAB_TEXT_MIN_CHARS - textContent.length} more to submit`}
                  </span>
                  <SubmitButton submitting={submitting} onClick={handleSubmit} label="Submit response" />
                </div>
              </div>
            )}

            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-destructive">
                <AlertCircle size={12} />
                {error}
              </p>
            )}
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Evaluation takes 30–90 seconds.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

// -----------------------------------------------------------------------------
// Sub-blocks
// -----------------------------------------------------------------------------

function StarRow({ stars, size = 14 }: { stars: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

function SubmitButton({
  submitting,
  onClick,
  label,
}: {
  submitting: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/75 px-6 text-[14px] font-semibold text-primary-foreground glow-primary shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
      {submitting ? 'Submitting…' : label}
    </button>
  )
}

function PendingBlock({ submission }: { submission: LabSubmission }) {
  const isEvaluating = submission.status === 'evaluating'
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
      <Loader2 size={18} className="animate-spin text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold">
          {isEvaluating ? 'Evaluating your submission…' : 'Submission queued'}
        </p>
        <p className="text-[12px] text-muted-foreground truncate">{describeSubmission(submission)}</p>
      </div>
    </div>
  )
}

function FailedBlock({
  submission,
  onRetry,
}: {
  submission: LabSubmission
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-destructive" />
        <p className="text-[13.5px] font-semibold">Evaluation failed</p>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        {submission.error_message ?? 'Something went wrong. Try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-white/5"
      >
        <RotateCcw size={12} /> Retry submission
      </button>
    </div>
  )
}

function ResultBlock({
  submission,
  rubric,
  onRetry,
}: {
  submission: LabSubmission
  rubric: LabRubricItem[]
  onRetry: () => void
}) {
  const stars = submission.overall_stars ?? 0
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.14] to-accent/[0.06] p-6 text-center">
        <StarRow stars={stars} size={28} />
        <div className="mt-2 text-[20px] font-bold">
          {stars} / 3 stars
        </div>
        <div className="text-[12px] text-muted-foreground">
          {submission.total_score} / {submission.max_score} weighted points
        </div>
      </div>

      {submission.summary_md && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
            Summary
          </h4>
          <p className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed">
            {submission.summary_md}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Per-criterion feedback
        </h4>
        {rubric.map((item) => {
          const score = submission.scores.find((s) => s.rubric_item_id === item.id)
          if (!score) return null
          const lowScore = score.stars < 3
          return (
            <div
              key={item.id}
              className={
                'rounded-xl border px-4 py-3 ' +
                (lowScore
                  ? 'border-amber-400/40 bg-amber-400/10'
                  : 'border-emerald-400/40 bg-emerald-400/10')
              }
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13.5px] font-semibold">{item.criterion}</p>
                <StarRow stars={score.stars} />
              </div>
              {score.feedback_md && (
                <p className="mt-1 text-[12.5px] text-foreground/80 whitespace-pre-wrap">
                  {score.feedback_md}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-white/5"
        >
          <RotateCcw size={12} /> Submit again
        </button>
      </div>
    </div>
  )
}
