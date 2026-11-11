import type { ScoreComponentResult } from '../types.js'
import type { EntityContext } from './context.js'
import { LEC_TABLE } from './model.js'

/** D 值 → 安全指数（分段线性） */
export function mapDtoScore(D: number): number {
  if (D > 320) return Math.max(0, 40 - ((D - 320) / 320) * 40)
  if (D > 160) return 60 - ((D - 160) / 160) * 20
  if (D > 70) return 80 - ((D - 70) / 90) * 20
  return Math.max(0, 100 - (D / 70) * 20)
}

export function lecKeyOf(ctx: EntityContext): string | undefined {
  if (ctx.entity.kind === 'SAFETY_OPERATION') return String(ctx.entity.properties.operationType ?? '')
  if (ctx.entity.kind === 'SAFETY_EQUIPMENT') return String(ctx.entity.properties.equipmentClass ?? '')
  return undefined
}

export function computeLec(ctx: EntityContext, weight: number): ScoreComponentResult {
  const key = lecKeyOf(ctx)
  const entry = key ? LEC_TABLE.find(e => e.key === key) : undefined
  if (!entry) {
    return { id: 'lec', label: '固有风险（LEC）', score: 0, weight, applicable: false, penalties: [] }
  }
  const D = entry.L * entry.E * entry.C
  return {
    id: 'lec',
    label: '固有风险（LEC）',
    score: mapDtoScore(D),
    weight,
    applicable: true,
    penalties: [],
  }
}

export function lecDetail(ctx: EntityContext): { L: number; E: number; C: number; D: number } | null {
  const key = lecKeyOf(ctx)
  const entry = key ? LEC_TABLE.find(e => e.key === key) : undefined
  if (!entry) return null
  return { L: entry.L, E: entry.E, C: entry.C, D: entry.L * entry.E * entry.C }
}
