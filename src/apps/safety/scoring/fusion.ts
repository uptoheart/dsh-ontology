import type { SafetyGrade, ScoreComponentResult, ScoreEvidences, ScoreModel, ScorePenalty, ScoreResult } from '../types.js'

export interface ScoreSubject {
  id: string
  name: string
  kind: string
}

export function gradeOf(score: number, model: ScoreModel): SafetyGrade {
  if (score < model.grades.red) return 'red'
  if (score < model.grades.orange) return 'orange'
  if (score < model.grades.yellow) return 'yellow'
  return 'blue'
}

export interface FuseCap {
  max: number
  penalty: ScorePenalty
}

export function fuse(
  subject: ScoreSubject,
  components: ScoreComponentResult[],
  model: ScoreModel,
  cap?: FuseCap | null,
): ScoreResult {
  const applicable = components.filter(c => c.applicable)
  const totalWeight = applicable.reduce((s, c) => s + c.weight, 0)
  let score = totalWeight > 0
    ? applicable.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
    : 100

  const penalties: ScorePenalty[] = applicable.flatMap(c => c.penalties)
  if (cap && score > cap.max) {
    penalties.push({ ...cap.penalty, delta: score - cap.max })
    score = cap.max
  }

  const evidences: ScoreEvidences[] = penalties
    .filter(p => p.refType === 'clause' || p.refType === 'rule')
    .map(p => (p.refType === 'clause' ? { clauseId: p.refId } : { ruleId: p.refId }))

  return {
    entityId: subject.id,
    entityName: subject.name,
    kind: subject.kind,
    score: Math.round(score * 10) / 10,
    grade: gradeOf(score, model),
    components: applicable,
    penalties,
    evidences,
    modelVersion: model.version,
  }
}

export function notApplicable(id: string, label: string, weight: number): ScoreComponentResult {
  return { id, label, score: 0, weight, applicable: false, penalties: [] }
}
