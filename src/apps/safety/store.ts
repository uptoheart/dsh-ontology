import { join } from 'node:path'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { getStorageRoot, loadSuite } from '../../datastore.js'
import type { OntologyAnnotations, OntologyEntity, OntologyRelation, SuiteData } from '../../shared-types.js'
import type { PlantAssessment, RcaResult, SafetyIncident, SafetyRule, ScoreModel } from './types.js'
import { DEFAULT_SCORE_MODEL } from './scoring/model.js'

export const SAFETY_SUITE_ID = 'chemical-safety-demo'
export const SAFETY_DOMAIN = '化工安全'

async function safetyDir(sub: string): Promise<string> {
  const root = await getStorageRoot()
  const dir = join(root, 'safety', sub)
  await mkdir(dir, { recursive: true })
  return dir
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

async function listJson<T>(sub: string): Promise<T[]> {
  const dir = await safetyDir(sub)
  let files: string[]
  try { files = await readdir(dir) } catch { return [] }
  const out: T[] = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    out.push(await readJson<T>(join(dir, f), null as unknown as T))
  }
  return out.filter(Boolean)
}

// ─────────────── 套件 ───────────────

export async function loadSafetySuite(): Promise<SuiteData | null> {
  return loadSuite(SAFETY_SUITE_ID)
}

export async function saveSafetySuite(data: SuiteData): Promise<void> {
  const root = await getStorageRoot()
  const dir = join(root, 'ontologies', SAFETY_SUITE_ID)
  await mkdir(dir, { recursive: true })
  await writeJson(join(dir, 'meta.json'), data.meta)
  await writeJson(join(dir, 'entities.json'), data.entities)
  await writeJson(join(dir, 'relations.json'), data.relations)
  await writeJson(join(dir, 'annotations.json'), data.annotations)
}

export function emptyAnnotations(): OntologyAnnotations {
  return { entityFrameMapping: {}, coverageMarks: {}, customRelations: [] }
}

// ─────────────── 规则包 ───────────────

export async function listRulePacks(): Promise<Record<string, SafetyRule[]>> {
  const dir = await safetyDir('rule-packs')
  let files: string[]
  try { files = await readdir(dir) } catch { return {} }
  const packs: Record<string, SafetyRule[]> = {}
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    const id = f.replace(/\.json$/, '')
    packs[id] = await readJson<SafetyRule[]>(join(dir, f), [])
  }
  return packs
}

export async function getRules(packId = 'default'): Promise<SafetyRule[]> {
  const dir = await safetyDir('rule-packs')
  return readJson<SafetyRule[]>(join(dir, `${packId}.json`), [])
}

export async function saveRules(packId: string, rules: SafetyRule[]): Promise<void> {
  const dir = await safetyDir('rule-packs')
  await writeJson(join(dir, `${packId}.json`), rules)
}

// ─────────────── 评分模型 ───────────────

export async function getScoreModel(): Promise<ScoreModel> {
  const dir = await safetyDir('scoring')
  return readJson<ScoreModel>(join(dir, 'model.json'), DEFAULT_SCORE_MODEL)
}

export async function saveScoreModel(model: ScoreModel): Promise<void> {
  const dir = await safetyDir('scoring')
  await writeJson(join(dir, 'model.json'), model)
}

// ─────────────── 评级快照 ───────────────

export async function listAssessments(suiteId?: string): Promise<PlantAssessment[]> {
  const all = await listJson<PlantAssessment>('assessments')
  const filtered = suiteId ? all.filter(a => a.suiteId === suiteId) : all
  return filtered.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAssessment(id: string): Promise<PlantAssessment | null> {
  const dir = await safetyDir('assessments')
  return readJson<PlantAssessment | null>(join(dir, `${id}.json`), null)
}

export async function saveAssessment(a: PlantAssessment): Promise<void> {
  const dir = await safetyDir('assessments')
  await writeJson(join(dir, `${a.id}.json`), a)
}

// ─────────────── 事件 ───────────────

export async function listIncidents(suiteId?: string): Promise<SafetyIncident[]> {
  const all = await listJson<SafetyIncident>('incidents')
  const filtered = suiteId ? all.filter(i => i.suiteId === suiteId) : all
  return filtered.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getIncident(id: string): Promise<SafetyIncident | null> {
  const dir = await safetyDir('incidents')
  return readJson<SafetyIncident | null>(join(dir, `${id}.json`), null)
}

export async function saveIncident(incident: SafetyIncident): Promise<void> {
  const dir = await safetyDir('incidents')
  await writeJson(join(dir, `${incident.id}.json`), incident)
}

// ─────────────── 根因结果 ───────────────

export async function getRca(incidentId: string): Promise<RcaResult | null> {
  const dir = await safetyDir('rca')
  return readJson<RcaResult | null>(join(dir, `${incidentId}.json`), null)
}

export async function saveRca(result: RcaResult): Promise<void> {
  const dir = await safetyDir('rca')
  await writeJson(join(dir, `${result.incidentId}.json`), result)
}

// ─────────────── 导入报告 ───────────────

export async function saveImportReport(report: unknown): Promise<void> {
  const dir = await safetyDir('imports')
  const id = (report as { batchId?: string }).batchId ?? `batch-${Date.now()}`
  await writeJson(join(dir, `${id}.json`), report)
}

export type { OntologyEntity, OntologyRelation }
