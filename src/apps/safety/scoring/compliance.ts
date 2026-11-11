import type { RuleHit, ScoreComponentResult, ScorePenalty } from '../types.js'
import type { EntityContext } from './context.js'

/** C 层：双重预防合规度（法规符合 / 措施覆盖 / 隐患整改 / 票证合规） */
export function computeCompliance(
  ctx: EntityContext,
  hits: RuleHit[],
  weight: number,
): ScoreComponentResult {
  const clauses = ctx.applicableClauseIds
  if (clauses.length === 0) {
    return { id: 'compliance', label: '管控有效性（双重预防）', score: 0, weight, applicable: false, penalties: [] }
  }

  const violated = new Set(ctx.clauseViolations.map(v => v.clauseId))
  const clauseRate = ((clauses.length - violated.size) / clauses.length) * 100

  const required = ctx.requiredControlCodes.length
  const coverageRate = required > 0
    ? (ctx.implementedControlCodes.length / required) * 100
    : 100

  const permitRate = ctx.entity.kind === 'SAFETY_OPERATION'
    ? (ctx.permitViolation ? 0 : 100)
    : null

  const parts: { score: number; w: number }[] = [
    { score: clauseRate, w: 0.4 },
    { score: coverageRate, w: 0.3 },
  ]
  if (permitRate !== null) parts.push({ score: permitRate, w: 0.1 })

  const totalW = parts.reduce((s, p) => s + p.w, 0)
  const score = parts.reduce((s, p) => s + p.score * p.w, 0) / totalW

  const penalties: ScorePenalty[] = []
  for (const v of ctx.clauseViolations) {
    penalties.push({
      layer: 'C',
      refType: 'clause',
      refId: v.clauseId,
      delta: 10,
      message: `${v.clauseId} 要求的管控措施未落实：${v.missingControls.join('、')}`,
    })
  }
  if (ctx.permitViolation) {
    penalties.push({
      layer: 'C',
      refType: 'clause',
      refId: 'GB30871:6.3',
      delta: 20,
      message: ctx.permitViolation === 'MISSING' ? '缺少作业票' : '作业票已过期或未审批',
    })
  }
  for (const hit of hits) {
    penalties.push({
      layer: 'C',
      refType: 'rule',
      refId: hit.ruleId,
      delta: hit.riskDelta,
      message: hit.message,
    })
  }

  return {
    id: 'compliance',
    label: '管控有效性（双重预防）',
    score,
    weight,
    applicable: true,
    penalties,
  }
}
