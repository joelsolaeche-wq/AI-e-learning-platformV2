'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Sparkles, Loader2, GripVertical } from 'lucide-react'
import { saveLabAction, deleteLabAction, type RubricItemInput } from '@/lib/actions/lab.actions'

type Props = {
  lessonId: string
  defaultTitle: string
  defaultBrief: string
  defaultItems: RubricItemInput[]
  canDraft: boolean
  existingLab: boolean
}

const EMPTY_ITEM: RubricItemInput = { criterion: '', description: '', weight: 1 }

export function LabEditorForm({
  lessonId,
  defaultTitle,
  defaultBrief,
  defaultItems,
  canDraft,
  existingLab,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [brief, setBrief] = useState(defaultBrief)
  const [items, setItems] = useState<RubricItemInput[]>(
    defaultItems.length > 0 ? defaultItems : [{ ...EMPTY_ITEM }],
  )
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)

  function updateItem(index: number, patch: Partial<RubricItemInput>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleDraft() {
    setDrafting(true)
    setDraftError(null)
    try {
      const res = await fetch('/api/admin/labs/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error ?? `Drafting failed (${res.status}).`)
      }
      const data = (await res.json()) as {
        title: string
        brief: string
        items: RubricItemInput[]
      }
      if (data.title) setTitle(data.title)
      if (data.brief) setBrief(data.brief)
      if (data.items && data.items.length > 0) setItems(data.items)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Drafting failed.')
    } finally {
      setDrafting(false)
    }
  }

  function handleSave() {
    setSaveError(null)
    setSaveSuccess(false)
    startTransition(async () => {
      const res = await saveLabAction(lessonId, title, brief, items)
      if (res.error) {
        setSaveError(res.error)
      } else {
        setSaveSuccess(true)
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    if (!existingLab) return
    if (!confirm('Delete this lab? Submissions and scores will be cascade-deleted.')) return
    setDeleting(true)
    setSaveError(null)
    const res = await deleteLabAction(lessonId)
    setDeleting(false)
    if (res.error) {
      setSaveError(res.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {saveError && (
        <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
          Lab saved.
        </div>
      )}

      {/* Draft with AI */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold">Draft with AI</p>
          <p className="text-[12.5px] text-muted-foreground">
            {canDraft
              ? 'Use the lesson transcript to suggest a brief and 4–6 rubric items. Always review and edit before saving.'
              : 'Ingest the lesson transcript first (admin endpoint) to enable AI drafting.'}
          </p>
          {draftError && (
            <p className="mt-1 text-[12px] text-destructive">{draftError}</p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleDraft}
          disabled={!canDraft || drafting}
          variant="outline"
          className="gap-2"
        >
          {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {drafting ? 'Drafting…' : 'Draft'}
        </Button>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="lab-title">Title</Label>
        <input
          id="lab-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-primary/60"
        />
      </div>

      {/* Brief */}
      <div className="space-y-2">
        <Label htmlFor="lab-brief">Brief (markdown)</Label>
        <textarea
          id="lab-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={8}
          placeholder="Describe what the learner will build. Use markdown for headings, lists, and code."
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
      </div>

      {/* Rubric items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Rubric items</Label>
          <span className="text-[11px] text-muted-foreground">
            {items.length} / 12 — shown to learner before they submit
          </span>
        </div>

        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <GripVertical size={12} />
                  </button>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground w-6">#{index + 1}</span>
                <input
                  value={item.criterion}
                  onChange={(e) => updateItem(index, { criterion: e.target.value })}
                  placeholder="Criterion (e.g. Code clarity)"
                  maxLength={200}
                  className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-primary/60"
                />
                <select
                  value={item.weight}
                  onChange={(e) => updateItem(index, { weight: Number(e.target.value) })}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus:border-primary/60"
                  aria-label="Weight"
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      ×{w}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length <= 1}
                  aria-label="Remove"
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                placeholder="What does excellent (3 stars) look like? What disqualifies it?"
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-primary/60"
              />
            </li>
          ))}
        </ul>

        <Button
          type="button"
          onClick={addItem}
          variant="outline"
          className="gap-2"
          disabled={items.length >= 12}
        >
          <Plus size={14} /> Add criterion
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        {existingLab ? (
          <Button
            type="button"
            onClick={handleDelete}
            variant="ghost"
            disabled={deleting || isPending}
            className="text-destructive hover:bg-destructive/15"
          >
            {deleting ? 'Deleting…' : 'Delete lab'}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : existingLab ? 'Save changes' : 'Create lab'}
        </Button>
      </div>
    </div>
  )
}
