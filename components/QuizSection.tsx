'use client'

// Stub — full implementation in Task 2

type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

interface QuizSectionProps {
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  lessonId: string
}

export function QuizSection(_props: QuizSectionProps) {
  return null
}
