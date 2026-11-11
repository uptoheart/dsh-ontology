import type { SuiteData } from '../../../shared-types.js'
import type {
  PlantAssessment, RuleHit, SafetyRule, ScoreComponentResult, ScoreModel, ScoreResult,
} from '../types.js'
import { buildIndex, type SuiteIndex } from '../graph.js'
import { buildContexts, type EntityContext } from './context.js'
import { evaluateRules } from '../rules/evaluator.js'
import { computeLec } from './lec.js'
import { computeHazard } from './gb18218.js'
import { computeCompliance } from './compliance.js'
import { computePropagation, propagationCap } from './propagation.js'
import { fuse, notApplicable, type FuseCap } from './fusion.js'
import { SAFETY_SUITE_ID } from '../store.js'

function groupHits(hits: RuleHit[]): Map<string, RuleHit[]> {
  const map = new Map<string, RuleHit[]>()
  for (const hit of hits) {
    if (!map.has(hit.entityId)) map.set(hit.entityId, [])
    map.get(hit.entityId)!.push(hit)
  }
  return map
}

function scoreEntity(
  ctx: EntityContext,
  hits: RuleHit[],
  model: ScoreModel,
  extra: ScoreComponentResult[] = [],
  cap?: FuseCap | null,
): ScoreResult {
  const components: ScoreComponentResult[] = [
    computeLec(ctx, model.weights.lec),
    computeHazard(ctx, model.weights.hazard),
    computeCompliance(ctx, hits, model.weights.compliance),
    notApplicable('indicator', '自定义指标', model.weights.indicator),
    ...extra,
  ]
  return fuse({ id: ctx.entity.id, name: ctx.entity.name, kind: ctx.entity.kind }, components, model, cap)
}

function childrenOfUnit(unitId: string, index: SuiteIndex, equipments: ScoreResult[], operations: ScoreResult[]): ScoreResult[] {
  const eqIds = index.targets(unitId, 'SAFETY_UNIT_CONTAINS_EQUIPMENT')
  const eqSet = new Set(eqIds)
  const eqScores = equipments.filter(s => eqSet.has(s.entityId))
  const opScores = operations.filter(op => {
    const targets = index.targets(op.entityId, 'SAFETY_OPERATION_ON_EQUIPMENT')
    return targets.some(t => eqSet.has(t))
  })
  return [...eqScores, ...opScores]
}

function plantCompliance(areas: ScoreResult[], model: ScoreModel): ScoreComponentResult {
  const comps = areas
    .flatMap(a => a.components.filter(c => c.id === 'compliance'))
  if (comps.length === 0) return notApplicable('compliance', '管控有效性（双重预防）', model.weights.compliance)
  const score = comps.reduce((s, c) => s + c.score, 0) / comps.length
  return {
    id: 'compliance',
    label: '管控有效性（双重预防）',
    score,
    weight: model.weights.compliance,
    applicable: true,
    penalties: comps.flatMap(c => c.penalties).slice(0, 20),
  }
}

export interface AssessOptions {
  now?: number
  assessmentId?: string
}

export function assessSuite(
  suite: SuiteData,
  rules: SafetyRule[],
  model: ScoreModel,
  options: AssessOptions = {},
): PlantAssessment {
  const now = options.now ?? Date.now()
  const index = buildIndex(suite)
  const contexts = buildContexts(index, now)
  const hits = evaluateRules(rules, contexts, now)
  const hitsByEntity = groupHits(hits)

  const equipments = index.ofKind('SAFETY_EQUIPMENT').map(e => {
    const ctx = contexts.get(e.id)!
    return scoreEntity(ctx, hitsByEntity.get(e.id) ?? [], model)
  })
  const operations = index.ofKind('SAFETY_OPERATION').map(e => {
    const ctx = contexts.get(e.id)!
    return scoreEntity(ctx, hitsByEntity.get(e.id) ?? [], model)
  })
  const units = index.ofKind('SAFETY_UNIT').map(e => {
    const ctx = contexts.get(e.id)!
    const children = childrenOfUnit(e.id, index, equipments, operations)
    const propagation = computePropagation(children, index.byId, model.weights.propagation, model)
    return scoreEntity(ctx, hitsByEntity.get(e.id) ?? [], model, [propagation], propagationCap(children, model))
  })
  const areas = index.ofKind('SAFETY_AREA').map(e => {
    const ctx = contexts.get(e.id)!
    const unitIds = index.targets(e.id, 'SAFETY_AREA_CONTAINS_UNIT')
    const children = units.filter(u => unitIds.includes(u.entityId))
    const propagation = computePropagation(children, index.byId, model.weights.propagation, model)
    return scoreEntity(ctx, hitsByEntity.get(e.id) ?? [], model, [propagation], propagationCap(children, model))
  })
  const plant = fuse(
    { id: 'plant', name: String(suite.meta.project ?? '厂区'), kind: 'PLANT' },
    [
      plantCompliance(areas, model),
      computePropagation(areas, index.byId, model.weights.propagation, model),
      notApplicable('indicator', '自定义指标', model.weights.indicator),
    ],
    model,
    propagationCap(areas, model),
  )

  const summary = { red: 0, orange: 0, yellow: 0, blue: 0, total: units.length }
  for (const u of units) summary[u.grade] += 1

  return {
    id: options.assessmentId ?? `AS-${Date.now()}`,
    suiteId: suite.meta.suiteId || SAFETY_SUITE_ID,
    createdAt: now,
    modelVersion: model.version,
    plant,
    areas,
    units,
    equipments,
    operations,
    ruleHits: hits,
    summary,
  }
}
