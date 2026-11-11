import type { EntityContext } from '../scoring/context.js'
import type { ConditionExpr, RuleHit, SafetyRule } from '../types.js'

function fieldValue(ctx: EntityContext, field: string): unknown {
  if (field in ctx.derived) return ctx.derived[field]
  return ctx.entity.properties[field]
}

function asNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function evaluateCondition(expr: ConditionExpr, ctx: EntityContext): boolean {
  switch (expr.op) {
    case 'and':
      return expr.items.every(item => evaluateCondition(item, ctx))
    case 'or':
      return expr.items.some(item => evaluateCondition(item, ctx))
    case 'not':
      return !evaluateCondition(expr.item, ctx)
    case 'exists': {
      const v = fieldValue(ctx, expr.field)
      return v !== undefined && v !== null && v !== ''
    }
    case 'eq':
      return fieldValue(ctx, expr.field) === expr.value
    case 'neq':
      return fieldValue(ctx, expr.field) !== expr.value
    case 'gt': {
      const a = asNumber(fieldValue(ctx, expr.field)); const b = asNumber(expr.value)
      return a !== null && b !== null && a > b
    }
    case 'gte': {
      const a = asNumber(fieldValue(ctx, expr.field)); const b = asNumber(expr.value)
      return a !== null && b !== null && a >= b
    }
    case 'lt': {
      const a = asNumber(fieldValue(ctx, expr.field)); const b = asNumber(expr.value)
      return a !== null && b !== null && a < b
    }
    case 'lte': {
      const a = asNumber(fieldValue(ctx, expr.field)); const b = asNumber(expr.value)
      return a !== null && b !== null && a <= b
    }
    case 'in': {
      const v = fieldValue(ctx, expr.field)
      return Array.isArray(expr.value) && expr.value.includes(v)
    }
    case 'contains': {
      const v = fieldValue(ctx, expr.field)
      if (Array.isArray(v)) return v.includes(expr.value)
      if (typeof v === 'string' && typeof expr.value === 'string') return v.includes(expr.value)
      return false
    }
    case 'related': {
      const targets = ctx.index.targets(ctx.entity.id, expr.relation)
      const filtered = expr.targetKind
        ? targets.filter(id => ctx.index.kindOf(id) === expr.targetKind)
        : targets
      return filtered.length >= (expr.minCount ?? 1)
    }
    case 'missingRelation': {
      const targets = ctx.index.targets(ctx.entity.id, expr.relation)
      const filtered = expr.targetKind
        ? targets.filter(id => ctx.index.kindOf(id) === expr.targetKind)
        : targets
      return filtered.length === 0
    }
    default:
      return false
  }
}

function inScope(rule: SafetyRule, ctx: EntityContext): boolean {
  if (!rule.scope.entityKinds.includes(ctx.entity.kind)) return false
  const opTypes = rule.scope.operationTypes
  if (opTypes && opTypes.length > 0) {
    const type = String(ctx.entity.properties.operationType ?? '')
    if (!opTypes.includes(type as never)) return false
  }
  return true
}

function effective(rule: SafetyRule, now: number): boolean {
  if (!rule.enabled) return false
  const from = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : null
  const to = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : null
  if (from !== null && now < from) return false
  if (to !== null && now > to) return false
  return true
}

export function evaluateRule(rule: SafetyRule, ctx: EntityContext, now: number = Date.now()): RuleHit | null {
  if (!effective(rule, now) || !inScope(rule, ctx)) return null
  if (!evaluateCondition(rule.condition, ctx)) return null
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    entityId: ctx.entity.id,
    severity: rule.effect.severity,
    effectKind: rule.effect.kind,
    riskDelta: (rule.effect.riskDelta ?? 0) * rule.weight,
    message: rule.effect.message,
    evidences: {
      clauseIds: rule.sourceClauseIds,
      relationIds: ctx.clauseViolations.flatMap(v =>
        v.clauseId ? [`clause:${v.clauseId}`] : [],
      ),
    },
  }
}

export function evaluateRules(
  rules: SafetyRule[],
  contexts: Map<string, EntityContext>,
  now: number = Date.now(),
): RuleHit[] {
  const hits: RuleHit[] = []
  for (const ctx of contexts.values()) {
    for (const rule of rules) {
      const hit = evaluateRule(rule, ctx, now)
      if (hit) hits.push(hit)
    }
  }
  return hits
}
