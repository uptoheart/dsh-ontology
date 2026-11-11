import type { IncomingMessage, ServerResponse } from 'node:http'
import { registerRoutes } from '../../kernel/route-registry.js'
import type { RouteDef } from '../../kernel/route-registry.js'
import { readJsonBody, sendJson } from '../../server-utils.js'
import type { SuiteData } from '../../shared-types.js'
import type { ImportKind } from './import.js'
import { importRows, parseCsv } from './import.js'
import { buildIndex } from './graph.js'
import { buildContexts } from './scoring/context.js'
import { evaluateRules } from './rules/evaluator.js'
import { assessSuite } from './scoring/index.js'
import { analyzeIncident } from './rca/engine.js'
import { ensureSafetySeed } from './seed.js'
import {
  SAFETY_DOMAIN, SAFETY_SUITE_ID, getAssessment, getIncident, getRca, getRules, getScoreModel,
  listAssessments, listIncidents, listRulePacks, loadSafetySuite, saveAssessment, saveImportReport,
  saveRca, saveRules, saveSafetySuite,
} from './store.js'

let seedPromise: Promise<void> | null = null
function ready(): Promise<void> {
  if (!seedPromise) seedPromise = ensureSafetySeed()
  return seedPromise
}

async function requireSuite(res: ServerResponse): Promise<SuiteData | null> {
  await ready()
  const suite = await loadSafetySuite()
  if (!suite) {
    sendJson(res, 404, { success: false, message: `安全套件 ${SAFETY_SUITE_ID} 不存在` })
    return null
  }
  return suite
}

const ok = (res: ServerResponse, data: unknown): void => sendJson(res, 200, { success: true, data })
const fail = (res: ServerResponse, code: number, message: string): void =>
  sendJson(res, code, { success: false, message })

// ─────────────── 总览 ───────────────

async function apiOverview(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const index = buildIndex(suite)
  const assessments = await listAssessments(SAFETY_SUITE_ID)
  const incidents = await listIncidents(SAFETY_SUITE_ID)
  const counts: Record<string, number> = {}
  for (const e of suite.entities) counts[e.kind] = (counts[e.kind] ?? 0) + 1

  ok(res, {
    suiteId: suite.meta.suiteId,
    domain: SAFETY_DOMAIN,
    project: suite.meta.project,
    counts,
    relationCount: suite.relations.length,
    latestAssessment: assessments[0] ?? null,
    incidents: incidents.slice(0, 10),
    pendingControls: index.ofKind('SAFETY_CONTROL')
      .filter(c => c.properties.implemented !== true)
      .map(c => ({ id: c.id, name: c.name, level: c.properties.level })),
  })
}

// ─────────────── 法规库 ───────────────

async function apiRegulations(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const index = buildIndex(suite)

  const regulations = index.ofKind('SAFETY_REGULATION').map(reg => {
    const clauses = index.targets(reg.id, 'SAFETY_REG_CONTAINS_CLAUSE').map(clauseId => {
      const clause = index.byId.get(clauseId)!
      const controls = index.targets(clauseId, 'SAFETY_CLAUSE_REQUIRES_CONTROL').map(id => {
        const c = index.byId.get(id)
        return { id, name: c?.name ?? id, implemented: c?.properties.implemented === true }
      })
      return {
        id: clauseId,
        name: clause.name,
        text: clause.properties.text,
        mandatory: clause.properties.mandatory === true,
        appliesTo: index.targets(clauseId, 'SAFETY_CLAUSE_APPLIES_TO'),
        controls,
      }
    })
    return {
      id: reg.id,
      code: reg.properties.code,
      name: reg.name,
      type: reg.properties.type,
      issuer: reg.properties.issuer,
      clauses,
    }
  })

  const checks = index.ofKind('SAFETY_CHECK_ITEM').map(c => ({
    id: c.id,
    name: c.name,
    frequency: c.properties.frequency,
    clauseIds: index.targets(c.id, 'SAFETY_CHECK_VERIFIES_CLAUSE'),
  }))

  ok(res, { regulations, checks })
}

// ─────────────── 资产台账 ───────────────

async function apiAssets(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const index = buildIndex(suite)

  const materials = index.ofKind('SAFETY_MATERIAL').map(m => ({
    id: m.id,
    name: m.name,
    cas: m.properties.cas,
    criticalQuantity: m.properties.criticalQuantity,
    hazardClass: m.properties.hazardClass,
  }))

  const areas = index.ofKind('SAFETY_AREA').map(area => ({
    id: area.id,
    name: area.name,
    riskLevel: area.properties.riskLevel,
    headcount: area.properties.headcount,
    stock: area.properties.stock,
    units: index.targets(area.id, 'SAFETY_AREA_CONTAINS_UNIT').map(unitId => {
      const unit = index.byId.get(unitId)!
      return {
        id: unitId,
        name: unit.name,
        process: unit.properties.process,
        headcount: unit.properties.headcount,
        stock: unit.properties.stock,
        equipments: index.targets(unitId, 'SAFETY_UNIT_CONTAINS_EQUIPMENT').map(eqId => {
          const eq = index.byId.get(eqId)!
          return {
            id: eqId,
            name: eq.name,
            equipmentClass: eq.properties.equipmentClass,
            status: eq.properties.status,
            inspectionValidUntil: eq.properties.inspectionValidUntil,
            stock: eq.properties.stock,
            materials: index.targets(eqId, 'SAFETY_EQUIPMENT_HANDLES_MATERIAL')
              .map(id => index.byId.get(id)?.name ?? id),
            hazards: index.targets(eqId, 'SAFETY_EQUIPMENT_HAS_HAZARD')
              .map(id => index.byId.get(id)?.name ?? id),
          }
        }),
      }
    }),
  }))

  const hazards = index.ofKind('SAFETY_HAZARD').map(h => ({
    id: h.id,
    name: h.name,
    category: h.properties.category,
    accidentType: h.properties.accidentType,
    controls: index
      .sources(h.id, 'SAFETY_CONTROL_MITIGATES_HAZARD')
      .map(id => index.byId.get(id)?.name ?? id),
  }))

  ok(res, { areas, materials, hazards })
}

// ─────────────── 作业分析 ───────────────

async function apiOperations(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const index = buildIndex(suite)
  const contexts = buildContexts(index, Date.now())

  const operations = index.ofKind('SAFETY_OPERATION').map(op => {
    const ctx = contexts.get(op.id)!
    const permits = index.targets(op.id, 'SAFETY_OPERATION_REQUIRES_PERMIT').map(id => {
      const p = index.byId.get(id)
      return { id, name: p?.name ?? id, valid: p?.properties.valid === true, status: p?.properties.status }
    })
    return {
      id: op.id,
      name: op.name,
      operationType: op.properties.operationType,
      areaCode: op.properties.areaCode,
      equipments: index.targets(op.id, 'SAFETY_OPERATION_ON_EQUIPMENT')
        .map(id => index.byId.get(id)?.name ?? id),
      hazards: index.targets(op.id, 'SAFETY_OPERATION_HAS_HAZARD')
        .map(id => index.byId.get(id)?.name ?? id),
      permits,
      permitViolation: ctx.permitViolation ?? null,
      requiredControlCodes: ctx.requiredControlCodes,
      missingControlCodes: ctx.missingControlCodes,
      clauseViolations: ctx.clauseViolations,
    }
  })

  ok(res, { operations })
}

// ─────────────── 规则与模型 ───────────────

async function apiRules(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready()
  const packs = await listRulePacks()
  const rules = await getRules('default')
  const model = await getScoreModel()
  ok(res, {
    packs: Object.keys(packs),
    activePack: 'default',
    rules,
    model,
  })
}

async function apiSaveRules(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready()
  let body: { packId?: string; rules?: unknown } = {}
  try { body = await readJsonBody(req) as typeof body } catch { /* ignore */ }
  if (!Array.isArray(body.rules)) { fail(res, 400, 'rules 必须为数组'); return }
  await saveRules(body.packId || 'default', body.rules as never[])
  ok(res, { packId: body.packId || 'default', count: body.rules.length })
}

// ─────────────── 规则评估 ───────────────

async function apiEvaluate(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const rules = await getRules('default')
  const index = buildIndex(suite)
  const contexts = buildContexts(index, Date.now())
  const hits = evaluateRules(rules, contexts, Date.now())
  const bySeverity = { general: 0, major: 0, fatal: 0 }
  for (const hit of hits) bySeverity[hit.severity] += 1
  ok(res, { hits, bySeverity, ruleCount: rules.length })
}

// ─────────────── 评级 ───────────────

async function apiAssess(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  const rules = await getRules('default')
  const model = await getScoreModel()
  let body: { save?: boolean } = {}
  try { body = await readJsonBody(req) as typeof body } catch { /* ignore */ }

  const assessment = assessSuite(suite, rules, model)
  if (body.save !== false) await saveAssessment(assessment)
  ok(res, assessment)
}

async function apiListAssessments(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready()
  ok(res, await listAssessments(SAFETY_SUITE_ID))
}

async function apiGetAssessment(
  _req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
): Promise<void> {
  await ready()
  const assessment = await getAssessment(params.p1)
  if (!assessment) { fail(res, 404, `评级快照 ${params.p1} 不存在`); return }
  ok(res, assessment)
}

// ─────────────── 事件与根因 ───────────────

async function apiIncidents(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready()
  ok(res, await listIncidents(SAFETY_SUITE_ID))
}

async function apiRca(
  _req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
): Promise<void> {
  await ready()
  const incident = await getIncident(params.p1)
  if (!incident) { fail(res, 404, `事件 ${params.p1} 不存在`); return }
  const suite = await requireSuite(res)
  if (!suite) return
  const model = await getScoreModel()
  const result = analyzeIncident(suite, incident, model)
  await saveRca(result)
  ok(res, result)
}

async function apiChain(
  _req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  query: Record<string, string>,
): Promise<void> {
  await ready()
  const incident = await getIncident(params.p1)
  if (!incident) { fail(res, 404, `事件 ${params.p1} 不存在`); return }
  let result = await getRca(params.p1)
  if (!result || query.refresh === '1') {
    const suite = await requireSuite(res)
    if (!suite) return
    const model = await getScoreModel()
    result = analyzeIncident(suite, incident, model)
    await saveRca(result)
  }
  ok(res, result)
}

// ─────────────── 导入 ───────────────

async function apiImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suite = await requireSuite(res)
  if (!suite) return
  let body: { kind?: ImportKind; csv?: string; rows?: Record<string, string>[] } = {}
  try { body = await readJsonBody(req) as typeof body } catch { fail(res, 400, 'invalid JSON'); return }

  const kinds: ImportKind[] = ['regulation', 'clause', 'asset', 'operation']
  if (!body.kind || !kinds.includes(body.kind)) {
    fail(res, 400, `kind 必须为 ${kinds.join(' / ')}`)
    return
  }
  const rows = Array.isArray(body.rows) ? body.rows : parseCsv(String(body.csv ?? ''))
  if (rows.length === 0) { fail(res, 400, '没有可导入的数据行'); return }

  const { suite: next, report } = importRows(suite, body.kind, rows)
  await saveSafetySuite(next)
  await saveImportReport(report)
  ok(res, report)
}

// ─────────────── 路由表 ───────────────

export const SAFETY_ROUTES: RouteDef[] = [
  { method: 'GET', pattern: /^\/api\/safety\/overview$/, handler: apiOverview },
  { method: 'GET', pattern: /^\/api\/safety\/regulations$/, handler: apiRegulations },
  { method: 'GET', pattern: /^\/api\/safety\/assets$/, handler: apiAssets },
  { method: 'GET', pattern: /^\/api\/safety\/operations$/, handler: apiOperations },
  { method: 'GET', pattern: /^\/api\/safety\/rules$/, handler: apiRules },
  { method: 'POST', pattern: /^\/api\/safety\/rules$/, handler: apiSaveRules },
  { method: 'POST', pattern: /^\/api\/safety\/evaluate$/, handler: apiEvaluate },
  { method: 'POST', pattern: /^\/api\/safety\/assess$/, handler: apiAssess },
  { method: 'GET', pattern: /^\/api\/safety\/assessments$/, handler: apiListAssessments },
  { method: 'GET', pattern: /^\/api\/safety\/assessments\/([^/]+)$/, handler: apiGetAssessment },
  { method: 'GET', pattern: /^\/api\/safety\/incidents$/, handler: apiIncidents },
  { method: 'POST', pattern: /^\/api\/safety\/incidents\/([^/]+)\/rca$/, handler: apiRca },
  { method: 'GET', pattern: /^\/api\/safety\/incidents\/([^/]+)\/chain$/, handler: apiChain },
  { method: 'POST', pattern: /^\/api\/safety\/import$/, handler: apiImport },
]

registerRoutes(SAFETY_ROUTES)
