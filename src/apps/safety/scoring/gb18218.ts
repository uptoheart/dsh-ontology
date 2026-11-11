import type { ScoreComponentResult } from '../types.js'
import type { EntityContext } from './context.js'

export interface HazardGrade {
  label: string
  score: number
}

export function hazardGradeOf(Q: number): HazardGrade {
  if (Q < 1) return { label: '非重大危险源', score: 95 }
  if (Q >= 10) return { label: '一级重大危险源', score: 40 }
  if (Q >= 5) return { label: '二级重大危险源', score: 50 }
  if (Q >= 2) return { label: '三级重大危险源', score: 62 }
  return { label: '四级重大危险源', score: 78 }
}

export function computeHazard(ctx: EntityContext, weight: number): ScoreComponentResult {
  const applicable = ctx.entity.kind === 'SAFETY_EQUIPMENT' || ctx.entity.kind === 'SAFETY_UNIT'
  if (!applicable) {
    return { id: 'hazard', label: '危险源规模（GB18218）', score: 0, weight, applicable: false, penalties: [] }
  }
  const grade = hazardGradeOf(ctx.quantityQ)
  const penalties = ctx.isMajorHazardSource
    ? [{
        layer: 'B' as const,
        refType: 'clause' as const,
        refId: 'GB18218:4.1',
        delta: 95 - grade.score,
        message: `Q=${ctx.quantityQ.toFixed(2)}，判定为${grade.label}`,
      }]
    : []
  return {
    id: 'hazard',
    label: '危险源规模（GB18218）',
    score: grade.score,
    weight,
    applicable: true,
    penalties,
  }
}
