'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { requestPasswordResetAction } from '@/lib/actions/profile.actions'

const initialState = { error: null }

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>

        {state?.success ? (
          <CardContent>
            <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
              Done! Check your inbox for the reset link.
            </div>
          </CardContent>
        ) : (
          <form action={formAction}>
            <CardContent className="space-y-4">
              {state?.error && (
                <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Sending…' : 'Send reset link'}
              </Button>
            </CardFooter>
          </form>
        )}

        <CardFooter>
          <p className="text-center text-sm text-muted-foreground w-full">
            <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
