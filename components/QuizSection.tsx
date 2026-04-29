'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuizState = 'LOCKED' | 'ACTIVE' | 'SUBMITTED' | 'RESULTS'

type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

type QuestionBreakdown = {
  questionId: string
  question: string
  options: string[]
  selectedAnswer: string | null
  correctAnswer: string
  correct: boolean
}

type QuizResults = {
  score: number
  total: number
  pct: number
  breakdown: QuestionBreakdown[]
}

interface QuizSectionProps {
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  lessonId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuizSection({ isLessonComplete, clientQuestions, lessonId }: QuizSectionProps) {
  // Always start at LOCKED — user explicitly clicks "Take Quiz" to begin.
  // When isLessonComplete=true, the button renders enabled but questions are not shown yet.
  // Pitfall 3 from RESEARCH.md: do NOT initialize to ACTIVE when lesson is complete.
  const [quizState, setQuizState] = useState<QuizState>('LOCKED')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<QuizResults | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const allAnswered =
    clientQuestions.length > 0 && clientQuestions.every((q) => answers[q.id])

  const handleStart = () => {
    if (!isLessonComplete) return
    setQuizState('ACTIVE')
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (!allAnswered) return
    setQuizState('SUBMITTED')
    setSubmitError(null)
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, answers }),
      })
      if (!res.ok) throw new Error('submit failed')
      const data: QuizResults = await res.json()
      setResults(data)
      setQuizState('RESULTS')
    } catch {
      setSubmitError("Couldn't submit quiz — try again")
      setQuizState('ACTIVE')
    }
  }

  const handleRetake = () => {
    setAnswers({})
    setResults(null)
    setSubmitError(null)
    setQuizState('ACTIVE')
  }

  // ---------------------------------------------------------------------------
  // LOCKED state
  // ---------------------------------------------------------------------------
  if (quizState === 'LOCKED') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Post-Lesson Quiz</h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock size={16} />
              <span className="text-sm">Complete the lesson to unlock the quiz</span>
            </div>
            <Button
              onClick={handleStart}
              disabled={!isLessonComplete}
            >
              Take Quiz
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // ACTIVE state
  // ---------------------------------------------------------------------------
  if (quizState === 'ACTIVE') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Post-Lesson Quiz</h2>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-lg font-semibold">Questions</span>
            <span className="text-xs text-muted-foreground">
              {Object.keys(answers).length} of {clientQuestions.length} answered
            </span>
          </CardHeader>
          <CardContent className="space-y-6">
            {clientQuestions.map((q, idx) => (
              <div key={q.id} className="space-y-3">
                <p className="text-xs text-muted-foreground">Question {idx + 1} of {clientQuestions.length}</p>
                <p className="text-lg font-semibold">{q.question}</p>
                <RadioGroup
                  value={answers[q.id] ?? ''}
                  onValueChange={(val: string) => handleAnswerChange(q.id, val)}
                  className="flex flex-col gap-2"
                >
                  {q.options.map((option) => (
                    <label
                      key={option}
                      className={[
                        'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                        answers[q.id] === option
                          ? 'border-primary ring-1 ring-primary/30 bg-card'
                          : 'border-border bg-card hover:bg-muted',
                      ].join(' ')}
                    >
                      <RadioGroupItem value={option} />
                      <span className="text-sm flex-1">{option}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            ))}

            {!allAnswered && (
              <p className="text-xs text-muted-foreground mt-1">Answer all questions to submit</p>
            )}
            {submitError && (
              <p className="text-xs text-destructive mb-1">{submitError}</p>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!allAnswered}
            >
              Submit Quiz
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // SUBMITTED state (optimistic loading)
  // ---------------------------------------------------------------------------
  if (quizState === 'SUBMITTED') {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Post-Lesson Quiz</h2>
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Button disabled className="w-full">Submitting...</Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // RESULTS state
  // ---------------------------------------------------------------------------
  if (quizState === 'RESULTS' && results) {
    const passed = results.pct >= 70
    return (
      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Post-Lesson Quiz</h2>

        {/* Score banner */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-2xl font-semibold">Quiz Results</span>
            <Badge variant={passed ? 'secondary' : 'outline'}>
              {passed ? 'Passed' : 'Review required'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={passed ? 'text-2xl font-semibold text-primary' : 'text-2xl font-semibold text-muted-foreground'}>
              {results.score} / {results.total} — {results.pct}%
            </p>
            <Progress value={results.pct} className="h-2 mt-2" />
          </CardContent>
        </Card>

        {/* Per-question review */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            {results.breakdown.map((item, idx) => (
              <div key={item.questionId} className="space-y-3">
                <p className="text-xs text-muted-foreground">Question {idx + 1} of {results.total}</p>
                <p className="text-lg font-semibold">{item.question}</p>
                <RadioGroup
                  value={item.selectedAnswer ?? ''}
                  disabled
                  className="flex flex-col gap-2"
                >
                  {item.options.map((option) => {
                    const isSelected = option === item.selectedAnswer
                    const isCorrect = option === item.correctAnswer

                    let rowClass = 'flex items-center gap-3 p-3 rounded-md border'
                    if (isSelected && item.correct) {
                      // User selected correct answer
                      rowClass += ' text-green-400 border-green-500/50 bg-green-950/30'
                    } else if (isSelected && !item.correct) {
                      // User selected wrong answer
                      rowClass += ' text-destructive border-destructive/50 bg-destructive/10'
                    } else {
                      rowClass += ' border-border bg-card opacity-60'
                    }

                    return (
                      <div key={option}>
                        <label className={rowClass}>
                          <RadioGroupItem value={option} disabled />
                          <span className="text-sm flex-1">{option}</span>
                          {isSelected && (
                            <span className={item.correct ? 'text-green-400 text-xs' : 'text-destructive text-xs'}>
                              {item.correct ? 'Correct' : 'Incorrect'}
                            </span>
                          )}
                        </label>
                        {/* Reveal correct answer below user's wrong selection */}
                        {isSelected && !item.correct && isCorrect && (
                          <p className="text-green-400 text-xs mt-1 ml-8">
                            Correct answer: {item.correctAnswer}
                          </p>
                        )}
                        {/* Also show correct answer label on the correct option when user got it wrong */}
                        {!isSelected && isCorrect && !item.correct && (
                          <p className="text-green-400 text-xs mt-1 ml-8">
                            Correct answer: {option}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </RadioGroup>
              </div>
            ))}

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleRetake}>
                Retake Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  // Fallback (should not be reachable)
  return null
}
