import type { OntologyEntity } from '../../../shared-types.js'
import type { ScoreComponentResult, ScoreModel, ScorePenalty, ScoreResult } from '../types.js'

export function exposureWeight(entity: OntologyEntity | undefined, model: ScoreModel): number {
  if (!entity) return 1
  const headcount = Number(entity.properties.headcount ?? 0)
  const stock = Number(entity.properties.stock ?? 0)
  const output = Number(entity.properties.output ?? 0)
  const w = headcount * model.propagationWeights.headcount
    + stock * model.propagationWeights.stock
    + output * model.propagationWeights.output
  return w > 0 ? w : 1
}

export interface PropagationCap {
  max: number
  penalty: ScorePenalty
}

/** 短板封顶：子节点含红/橙时，父节点最终得分上限 */
export function propagationCap(children: ScoreResult[], model: ScoreModel): PropagationCap | null {
  if (children.length === 0) return null
  const worst = children.reduce((acc, c) => (c.score < acc.score ? c : acc), children[0])
  if (worst.grade === 'red') {
    return {
      max: model.caps.ifChildRed,
      penalty: {
        layer: 'D', refType: 'child', refId: worst.entityId,
        delta: 0, message: `子节点「${worst.entityName}」为红级，父级封顶 ${model.caps.ifChildRed}`,
      },
    }
  }
  if (worst.grade === 'orange') {
    return {
      max: model.caps.ifChildOrange,
      penalty: {
        layer: 'D', refType: 'child', refId: worst.entityId,
        delta: 0, message: `子节点「${worst.entityName}」为橙级，父级封顶 ${model.caps.ifChildOrange}`,
      },
    }
  }
  return null
}

/** D 层：子节点加权聚合 + 短板封顶 */
export function computePropagation(
  children: ScoreResult[],
  childEntities: Map<string, OntologyEntity>,
  weight: number,
  model: ScoreModel,
): ScoreComponentResult {
  if (children.length === 0) {
    return { id: 'propagation', label: '结构传播（D）', score: 0, weight, applicable: false, penalties: [] }
  }

  let num = 0
  let den = 0
  for (const child of children) {
    const w = exposureWeight(childEntities.get(child.entityId), model)
    num += child.score * w
    den += w
  }
  const raw = den > 0 ? num / den : 0

  const cap = propagationCap(children, model)
  const score = cap ? Math.min(raw, cap.max) : raw
  const penalties: ScorePenalty[] = cap && raw > cap.max
    ? [{ ...cap.penalty, delta: raw - score }]
    : []

  return { id: 'propagation', label: '结构传播（D）', score, weight, applicable: true, penalties }
}
