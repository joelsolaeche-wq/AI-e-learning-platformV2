'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { updatePasswordAction } from '@/lib/actions/profile.actions'

const initialState = { error: null }

export default function UpdatePasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => router.push('/dashboard'), 2000)
      return () => clearTimeout(t)
    }
  }, [state?.success, router])

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Nueva contraseña</CardTitle>
          <CardDescription>Elegí una contraseña segura de al menos 8 caracteres.</CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="space-y-4">
            {state?.error && (
              <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}
            {state?.success && (
              <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
                ¡Contraseña actualizada! Redirigiendo…
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <PasswordInput
                id="confirm"
                name="confirm"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isPending || !!state?.success}>
              {isPending ? 'Guardando…' : 'Actualizar contraseña'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
