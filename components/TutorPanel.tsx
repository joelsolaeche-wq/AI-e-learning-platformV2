'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import type { Message } from 'ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TutorPanelProps {
  lessonId: string
  initialMessages: Message[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TutorPanel({ lessonId, initialMessages }: TutorPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/tutor/chat',
    body: { lessonId },
    initialMessages,
  })

  // Auto-scroll to bottom when new messages arrive or streaming updates.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ---------------------------------------------------------------------------
  // Collapsed state — just the toggle button
  // ---------------------------------------------------------------------------
  if (!isOpen) {
    return (
      <section className="space-y-2">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full"
        >
          Ask AI Tutor
        </Button>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // Expanded panel
  // ---------------------------------------------------------------------------
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <span className="text-sm font-semibold">AI Tutor</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="text-xs text-muted-foreground h-auto py-1 px-2"
          >
            Close
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Message list — T-6-05: render as plain text only */}
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Ask a question about this lesson
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={[
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                ].join(' ')}
              >
                <div
                  className={[
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator while streaming */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  Thinking...
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about this lesson..."
              disabled={isLoading}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-full"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
