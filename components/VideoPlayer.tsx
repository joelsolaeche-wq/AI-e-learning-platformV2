'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MuxPlayer from '@mux/mux-player-react'

interface VideoPlayerProps {
  playbackId: string
  lessonId: string
  resumePosition: number
  /** Lesson duration from DB (may be 0/null for un-encoded lessons). */
  duration: number
}

export function VideoPlayer({ playbackId, lessonId, resumePosition, duration }: VideoPlayerProps) {
  // Read currentTime/duration from the player itself, not from event.target — the
  // Mux Player's onTimeUpdate callback shape is unreliable and the cast hack
  // (`as unknown as () => void`) was masking it.
  const playerRef = useRef<HTMLElement & { currentTime?: number; duration?: number } | null>(null)
  const lastSaveRef = useRef<number>(0)
  const completedRef = useRef<boolean>(false)
  const router = useRouter()

  const saveProgress = useCallback(
    async (position: number, completed: boolean) => {
      try {
        const res = await fetch('/api/video/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, position, duration, completed }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    [lessonId, duration],
  )

  const handleTimeUpdate = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    const pos = Math.floor(player.currentTime ?? 0)
    // Trust the player's reported duration when it's finite; otherwise fall
    // back to the DB value. This prevents seed lessons with null duration_seconds
    // from blocking auto-completion forever.
    const actualDuration =
      typeof player.duration === 'number' && Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : duration
    const now = Date.now()
    const pct = actualDuration > 0 ? pos / actualDuration : 0

    // 85% — slightly more forgiving than 90%, fires before the credits roll
    if (pct >= 0.85 && !completedRef.current) {
      completedRef.current = true
      saveProgress(pos, true).then((ok) => {
        if (ok) router.refresh()
      })
      return
    }

    if (now - lastSaveRef.current >= 10_000) {
      lastSaveRef.current = now
      saveProgress(pos, false)
    }
  }, [duration, saveProgress, router])

  const handleEnded = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    const pos = Math.floor(playerRef.current?.currentTime ?? duration ?? 0)
    saveProgress(pos, true).then((ok) => {
      if (ok) router.refresh()
    })
  }, [duration, saveProgress, router])

  return (
    <MuxPlayer
      // Mux's React wrapper accepts any ref shape that points to the underlying
      // custom element; the `as never` is the established pattern in this repo
      // for forwarding refs to the player.
      ref={playerRef as never}
      playbackId={playbackId}
      startTime={resumePosition}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      style={{ width: '100%', aspectRatio: '16/9' }}
      accentColor="#A78BFA"
      defaultShowRemainingTime
      playbackRates={[0.75, 1, 1.25, 1.5, 2]}
    />
  )
}
