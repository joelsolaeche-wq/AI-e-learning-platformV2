'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MuxPlayer from '@mux/mux-player-react'

interface VideoPlayerProps {
  playbackId: string
  lessonId: string
  resumePosition: number
  duration: number
}

export function VideoPlayer({ playbackId, lessonId, resumePosition, duration }: VideoPlayerProps) {
  const lastSaveRef = useRef<number>(0)
  const completedRef = useRef<boolean>(false)
  const router = useRouter()

  const saveProgress = useCallback(async (position: number, completed: boolean) => {
    try {
      await fetch('/api/video/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, position, duration, completed }),
      })
    } catch {
      // progress save failures are non-fatal
    }
  }, [lessonId, duration])

  const handleTimeUpdate = useCallback((event: Event) => {
    const target = event.target as HTMLVideoElement
    const pos = Math.floor(target.currentTime)
    const now = Date.now()
    const pct = duration > 0 ? pos / duration : 0

    if (pct >= 0.9 && !completedRef.current) {
      completedRef.current = true
      saveProgress(pos, true).then(() => router.refresh())
      return
    }

    if (now - lastSaveRef.current >= 10_000) {
      lastSaveRef.current = now
      saveProgress(pos, false)
    }
  }, [duration, saveProgress, router])

  const handleEnded = useCallback(() => {
    saveProgress(duration, true).then(() => router.refresh())
  }, [duration, saveProgress, router])

  return (
    <MuxPlayer
      playbackId={playbackId}
      startTime={resumePosition}
      onTimeUpdate={handleTimeUpdate as unknown as () => void}
      onEnded={handleEnded}
      style={{ width: '100%', aspectRatio: '16/9' }}
      accentColor="#ffffff"
      defaultShowRemainingTime
      playbackRates={[0.75, 1, 1.25, 1.5, 2]}
    />
  )
}
