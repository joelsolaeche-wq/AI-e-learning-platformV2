'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { updateProfileAction } from '@/lib/actions/profile.actions'

const PRESET_AVATARS = [
  { id: 'violet-hex', bg: 'from-violet-500 to-purple-600', symbol: '✦' },
  { id: 'cyan-wave', bg: 'from-cyan-400 to-blue-500', symbol: '◈' },
  { id: 'rose-spark', bg: 'from-rose-400 to-pink-500', symbol: '❋' },
  { id: 'amber-sun', bg: 'from-amber-400 to-orange-500', symbol: '◉' },
  { id: 'emerald-leaf', bg: 'from-emerald-400 to-teal-500', symbol: '◆' },
  { id: 'indigo-star', bg: 'from-indigo-400 to-violet-500', symbol: '★' },
]

const isPreset = (val: string) => PRESET_AVATARS.some((a) => a.id === val)

interface ProfileFormProps {
  initialFullName: string | null
  initialAvatarUrl: string | null
}

const initialState = { error: null, success: false }

export function ProfileForm({ initialFullName, initialAvatarUrl }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState)
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [avatarValue, setAvatarValue] = useState(initialAvatarUrl ?? '')
  const [urlInput, setUrlInput] = useState(
    initialAvatarUrl && !isPreset(initialAvatarUrl) ? initialAvatarUrl : '',
  )

  const handlePresetClick = (id: string) => {
    setAvatarValue(id)
    setUrlInput('')
  }

  const handleUrlChange = (val: string) => {
    setUrlInput(val)
    setAvatarValue(val)
  }

  return (
    <form action={formAction} className="space-y-8">
      {/* Single hidden field carries the resolved avatar value to the server action */}
      <input type="hidden" name="avatar_url" value={avatarValue} />

      {state?.error && (
        <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
          Profile updated successfully.
        </div>
      )}

      {/* Avatar selection */}
      <div className="space-y-3">
        <Label>Avatar</Label>
        <div className="flex flex-wrap gap-3">
          {PRESET_AVATARS.map((av) => {
            const selected = avatarValue === av.id
            return (
              <button
                key={av.id}
                type="button"
                onClick={() => handlePresetClick(av.id)}
                aria-label={`Avatar ${av.id}`}
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-lg text-white ring-2 transition-all',
                  av.bg,
                  selected
                    ? 'ring-primary ring-offset-2 ring-offset-background scale-110'
                    : 'ring-transparent hover:scale-105',
                )}
              >
                {av.symbol}
              </button>
            )
          })}
        </div>

        {/* Native input to avoid Base UI controlled/uncontrolled conflict */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Or paste an image URL…"
            className="h-8 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {urlInput && !isPreset(urlInput) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlInput}
              alt="preview"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pick a preset avatar or paste an image URL.
        </p>
      </div>

      {/* Full name — native input to avoid Base UI uncontrolled warning on re-render */}
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          placeholder="Your name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          className="h-8 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
