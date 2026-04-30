'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfileAction } from '@/lib/actions/profile.actions'
import { cn } from '@/lib/utils'

const PRESET_AVATARS = [
  { id: 'violet-hex', bg: 'from-violet-500 to-purple-600', initials: '✦' },
  { id: 'cyan-wave', bg: 'from-cyan-400 to-blue-500', initials: '◈' },
  { id: 'rose-spark', bg: 'from-rose-400 to-pink-500', initials: '❋' },
  { id: 'amber-sun', bg: 'from-amber-400 to-orange-500', initials: '◉' },
  { id: 'emerald-leaf', bg: 'from-emerald-400 to-teal-500', initials: '◆' },
  { id: 'indigo-star', bg: 'from-indigo-400 to-violet-500', initials: '★' },
]

interface ProfileFormProps {
  initialFullName: string | null
  initialAvatarUrl: string | null
}

const initialState = { error: null, success: false }

export function ProfileForm({ initialFullName, initialAvatarUrl }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState)

  const selectedAvatar = initialAvatarUrl ?? ''

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
          Perfil actualizado correctamente.
        </div>
      )}

      {/* Avatar selection */}
      <div className="space-y-3">
        <Label>Avatar</Label>
        <div className="flex flex-wrap gap-3">
          {PRESET_AVATARS.map((av) => (
            <label key={av.id} className="cursor-pointer">
              <input
                type="radio"
                name="avatar_url"
                value={av.id}
                defaultChecked={selectedAvatar === av.id}
                className="sr-only"
              />
              <div
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-lg text-white ring-2 ring-transparent transition-all',
                  av.bg,
                  selectedAvatar === av.id && 'ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                {av.initials}
              </div>
            </label>
          ))}
          {/* Custom URL option */}
          <label className="cursor-pointer">
            <input
              type="radio"
              name="avatar_url"
              value={!PRESET_AVATARS.some(a => a.id === selectedAvatar) ? selectedAvatar : ''}
              defaultChecked={!PRESET_AVATARS.some(a => a.id === selectedAvatar) && !!selectedAvatar}
              className="sr-only"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Input
            name="avatar_url"
            placeholder="O pegá una URL de imagen…"
            defaultValue={!PRESET_AVATARS.some(a => a.id === selectedAvatar) ? selectedAvatar : ''}
            className="max-w-sm text-sm"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Seleccioná un avatar predefinido o pegá una URL de imagen.
        </p>
      </div>

      {/* Full name */}
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          placeholder="Tu nombre"
          defaultValue={initialFullName ?? ''}
          maxLength={100}
          className="max-w-sm"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
