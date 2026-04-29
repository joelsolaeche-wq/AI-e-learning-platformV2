import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ConfirmEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to your inbox.
            Click it to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            After confirming, you&apos;ll be redirected to your dashboard automatically.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
