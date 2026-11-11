import type { OntologyEntity } from '../../../shared-types.js'
import type { SuiteIndex } from '../graph.js'

export interface ClauseViolation {
  clauseId: string
  missingControls: string[]
}

export interface EntityContext {
  entity: OntologyEntity
  index: SuiteIndex
  applicableClauseIds: string[]
  requiredControlCodes: string[]
  implementedControlCodes: string[]
  missingControlCodes: string[]
  clauseViolations: ClauseViolation[]
  permitViolation?: 'MISSING' | 'INVALID'
  inspectionOverdue: boolean
  quantityQ: number
  isMajorHazardSource: boolean
  derived: Record<string, unknown>
}

const CLOSED_KINDS = new Set(['SAFETY_EQUIPMENT', 'SAFETY_UNIT'])

function controlCode(index: SuiteIndex, controlId: string): string {
  const e = index.byId.get(controlId)
  return String(e?.properties.controlCode ?? controlId.replace(/^control:/, ''))
}

function isImplemented(index: SuiteIndex, controlId: string): boolean {
  return index.byId.get(controlId)?.properties.implemented === true
}

function computeQ(entity: OntologyEntity, index: SuiteIndex): number {
  if (entity.kind === 'SAFETY_EQUIPMENT') {
    const stock = Number(entity.properties.stock ?? 0)
    const materials = index.targets(entity.id, 'SAFETY_EQUIPMENT_HANDLES_MATERIAL')
    let q = 0
    for (const m of materials) {
      const critical = Number(index.byId.get(m)?.properties.criticalQuantity ?? 0)
      if (stock > 0 && critical > 0) q += stock / critical
    }
    return q
  }
  if (entity.kind === 'SAFETY_UNIT') {
    const children = index.targets(entity.id, 'SAFETY_UNIT_CONTAINS_EQUIPMENT')
    return children.reduce((sum, id) => {
      const child = index.byId.get(id)
      return child ? sum + computeQ(child, index) : sum
    }, 0)
  }
  return 0
}

export function buildContext(
  entity: OntologyEntity,
  index: SuiteIndex,
  now: number = Date.now(),
): EntityContext {
  const applicableClauseIds = index.sources(entity.id, 'SAFETY_CLAUSE_APPLIES_TO')
  const requiredControlCodes: string[] = []
  const implementedControlCodes: string[] = []
  const missingControlCodes: string[] = []
  const clauseViolations: ClauseViolation[] = []

  for (const clauseId of applicableClauseIds) {
    const controlIds = index.targets(clauseId, 'SAFETY_CLAUSE_REQUIRES_CONTROL')
    const missing: string[] = []
    for (const controlId of controlIds) {
      const code = controlCode(index, controlId)
      if (!requiredControlCodes.includes(code)) requiredControlCodes.push(code)
      const ok = isImplemented(index, controlId)
      const bucket = ok ? implementedControlCodes : missingControlCodes
      if (!bucket.includes(code)) bucket.push(code)
      if (!ok && !missing.includes(code)) missing.push(code)
    }
    if (missing.length > 0) clauseViolations.push({ clauseId, missingControls: missing })
  }

  let permitViolation: 'MISSING' | 'INVALID' | undefined
  if (entity.kind === 'SAFETY_OPERATION') {
    const permits = index.targets(entity.id, 'SAFETY_OPERATION_REQUIRES_PERMIT')
    if (permits.length === 0) permitViolation = 'MISSING'
    else if (permits.some(id => index.byId.get(id)?.properties.valid === false)) permitViolation = 'INVALID'
  }

  let inspectionOverdue = false
  if (entity.kind === 'SAFETY_EQUIPMENT') {
    const until = String(entity.properties.inspectionValidUntil ?? '')
    if (until) inspectionOverdue = new Date(until).getTime() < now
  }

  const quantityQ = computeQ(entity, index)

  const derived: Record<string, unknown> = {
    ...entity.properties,
    applicableClauseIds,
    requiredControlCodes,
    implementedControlCodes,
    missingControlCodes,
    permitViolation,
    inspectionOverdue,
    quantityQ,
    isMajorHazardSource: quantityQ >= 1,
  }

  return {
    entity,
    index,
    applicableClauseIds,
    requiredControlCodes,
    implementedControlCodes,
    missingControlCodes,
    clauseViolations,
    permitViolation,
    inspectionOverdue,
    quantityQ,
    isMajorHazardSource: quantityQ >= 1,
    derived,
  }
}

export function buildContexts(index: SuiteIndex, now: number = Date.now()): Map<string, EntityContext> {
  const map = new Map<string, EntityContext>()
  for (const e of index.suite.entities) map.set(e.id, buildContext(e, index, now))
  return map
}

export { CLOSED_KINDS }
