export type CriterionEval = {
  criteria_id: string
  score: number
  weight: number
}

export function calculateWeightedScore(evaluations: CriterionEval[]): number {
  if (evaluations.length === 0) return 0
  const totalWeight = evaluations.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight === 0) return 0
  const weightedSum = evaluations.reduce((sum, e) => sum + e.score * e.weight, 0)
  return weightedSum / totalWeight
}

export function calculateStars(weightedScore: number): 1 | 2 | 3 {
  if (weightedScore >= 85) return 3
  if (weightedScore >= 60) return 2
  return 1
}
