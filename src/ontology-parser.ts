import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import type {
  OntologyEntity, OntologyRelation, OntologySuiteMeta, OntologyAnnotations,
  EntityKind, RelationType, SuiteData,
} from './shared-types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─────────────── 内部工具 ───────────────

function buildEntity(
  suiteId: string,
  rawId: string,
  name: string,
  kind: EntityKind,
  domain: string,
  sourceFile: string,
  properties: Record<string, unknown>,
  alias?: string,
  description?: string,
): OntologyEntity {
  return {
    id: `${suiteId}:${kind}:${rawId}`,
    rawId,
    name,
    kind,
    domain,
    sourceFile,
    alias,
    description,
    properties,
  }
}

function buildRelation(
  from: string, to: string, type: RelationType, label?: string,
): OntologyRelation {
  return {
    id: `${from}::${type}::${to}`,
    from, to, type, label,
  }
}

// ─────────────── 主入口 ───────────────

export interface DiscoveredSuite {
  suiteId: string
  dir: string
  maxMtime: number
  fileCount: number
  manifest: Record<string, unknown>
}

export async function discoverSuites(sourceRoot: string): Promise<DiscoveredSuite[]> {
  const suites: DiscoveredSuite[] = []
  await walkForManifest(sourceRoot, suites)
  return suites
}

async function walkForManifest(dir: string, out: DiscoveredSuite[]): Promise<void> {
  let entries: string[]
  try { entries = await readdir(dir) } catch { return }

  let hasManifest = false
  let manifestPath = ''
  for (const e of entries) {
    if (e === 'manifest.json') { hasManifest = true; manifestPath = join(dir, e); break }
  }

  if (hasManifest) {
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestContent) as Record<string, unknown>

    let maxMtime = 0
    let fileCount = 0
    try {
      const st = await stat(manifestPath); maxMtime = st.mtimeMs; fileCount++
      const yamlEntries = entries.filter(e => e.endsWith('.yaml') || e.endsWith('.yml'))
      for (const y of yamlEntries) {
        const yp = join(dir, y)
        try {
          const yst = await stat(yp)
          if (yst.mtimeMs > maxMtime) maxMtime = yst.mtimeMs
          fileCount++
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    out.push({
      suiteId: basename(dir),
      dir,
      maxMtime,
      fileCount,
      manifest,
    })
  }

  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const full = join(dir, e)
    let s: any = null
    try { s = await stat(full) } catch { continue }
    if (s.isDirectory()) await walkForManifest(full, out)
  }
}

export async function parseSuite(disc: DiscoveredSuite): Promise<SuiteData> {
  const { suiteId, dir, manifest, maxMtime, fileCount } = disc
  const domain = String(manifest.domain ?? '')
  const sourceFileList = (manifest.model_files ?? []) as string[]

  const entities: OntologyEntity[] = []
  const relations: OntologyRelation[] = []

  for (const file of sourceFileList) {
    const yamlPath = join(dir, file)
    let content: string
    try { content = await readFile(yamlPath, 'utf-8') } catch { continue }
    const raw = yaml.load(content) as Record<string, unknown>
    if (!raw || typeof raw !== 'object') continue
    const modelType = String(raw.model_type ?? '')
    const fileDomain = String(raw.domain ?? domain)

    switch (modelType.toUpperCase()) {
      case 'OBJECT':   parseM1(raw, suiteId, file, fileDomain, entities, relations); break
      case 'BEHAVIOR': parseM2(raw, suiteId, file, fileDomain, entities, relations); break
      case 'RULE':     parseM3(raw, suiteId, file, fileDomain, entities, relations); break
      case 'ACTOR':    parseM5(raw, suiteId, file, fileDomain, entities, relations); break
      case 'FLOW':     parseM6(raw, suiteId, file, fileDomain, entities, relations); break
      case 'REPORT':   parseM7(raw, suiteId, file, fileDomain, entities, relations); break
      case 'UI':       parseMU(raw, suiteId, file, fileDomain, entities, relations); break
    }
  }

  resolveDanglingRefs(entities, relations, suiteId)

  const meta: OntologySuiteMeta = {
    suiteId,
    domain,
    project: manifest.project as string | undefined,
    sourceRequirements: manifest.source_requirements as string | undefined,
    sourceDir: relPath(dir, resolveDatasourceRootSync()),
    importTime: Date.now(),
    sourceMtime: maxMtime,
    sourceFileCount: fileCount,
    entityCount: entities.length,
    relationCount: relations.length,
  }

  const annotations: OntologyAnnotations = {
    entityFrameMapping: {},
    coverageMarks: {},
    customRelations: [],
  }

  return { entities, relations, meta, annotations }
}

// ─────────────── M1 对象模型 ───────────────

function parseM1(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const aggs = (raw.aggregates as any[]) ?? []
  for (const agg of aggs) {
    if (!agg?.id) continue
    const e = buildEntity(suiteId, agg.id, agg.name, 'AGGREGATE_ROOT', domain, sourceFile, agg, agg.alias, agg.description)
    entities.push(e)

    const subEnts = (agg.entities as any[]) ?? []
    for (const sub of subEnts) {
      if (!sub?.name) continue
      const subRawId = `${agg.id}::${sub.name}`
      const subE = buildEntity(suiteId, subRawId, sub.name, 'ENTITY', domain, sourceFile, sub, sub.alias, sub.description)
      entities.push(subE)
      relations.push(buildRelation(subE.id, e.id, 'AGGREGATE_OWN_ENTITY', '属于'))
    }
  }

  const dicts = (raw.data_dictionaries as any[]) ?? []
  for (const d of dicts) {
    if (!d?.id) continue
    const de = buildEntity(suiteId, d.id, d.name, 'DATA_DICTIONARY', domain, sourceFile, d)
    entities.push(de)
  }

  const assoc = (raw.aggregate_associations as any[]) ?? []
  for (const a of assoc) {
    if (!a?.sourceAggregate || !a?.targetAggregate) continue
    const fromRaw = `${suiteId}:AGGREGATE_ROOT:${a.sourceAggregate}`
    const toRaw = `${suiteId}:AGGREGATE_ROOT:${a.targetAggregate}`
    const label = a.sourceRole ?? a.associationType
    relations.push(buildRelation(fromRaw, toRaw, 'REFERENCE', label))
  }
}

// ─────────────── M2 行为模型 ───────────────

function parseM2(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const behaviors = (raw.behaviors as any[]) ?? []
  for (const b of behaviors) {
    if (!b?.id) continue
    const e = buildEntity(suiteId, b.id, b.name, 'BEHAVIOR', domain, sourceFile, b)
    entities.push(e)

    if (b.ownerEntity) {
      const aggId = `${suiteId}:AGGREGATE_ROOT:${b.ownerEntity}`
      relations.push(buildRelation(e.id, aggId, 'OWNED_BY', '归属'))
    }

    const rules = (b.appliedRules as string[]) ?? []
    for (const r of rules) {
      const rid = `${suiteId}:RULE:${r}`
      relations.push(buildRelation(e.id, rid, 'USES_RULE', '使用'))
    }

    const syncs = (b.syncTriggers as any[]) ?? []
    for (const s of syncs) {
      if (s.behaviorRef) {
        const tid = `${suiteId}:BEHAVIOR:${s.behaviorRef}`
        relations.push(buildRelation(e.id, tid, 'TRIGGERS_BEHAVIOR', s.description ?? '同步触发'))
      }
    }

    if (b.queryReportRef) {
      const rid = `${suiteId}:REPORT:${b.queryReportRef}`
      relations.push(buildRelation(e.id, rid, 'REPORT_BEHAVIOR', '对应查询'))
    }
  }
}

// ─────────────── M3 规则模型 ───────────────

function parseM3(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const rules = (raw.rules as any[]) ?? []
  for (const r of rules) {
    if (!r?.id) continue
    const e = buildEntity(suiteId, r.id, r.name, 'RULE', domain, sourceFile, r)
    entities.push(e)

    const reused = (r.reusedBy as string[]) ?? []
    for (const b of reused) {
      const bid = `${suiteId}:BEHAVIOR:${b}`
      relations.push(buildRelation(e.id, bid, 'RULE_USED_BY', '被使用'))
    }
  }
}

// ─────────────── M5 主体模型 ───────────────

function parseM5(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const actors = (raw.actors as any[]) ?? []
  for (const a of actors) {
    if (!a?.actorId) continue
    const e = buildEntity(suiteId, a.actorId, a.name, 'ACTOR', domain, sourceFile, a)
    entities.push(e)

    const roles = (a.roles as string[]) ?? []
    for (const roleId of roles) {
      const rid = `${suiteId}:ROLE:${roleId}`
      relations.push(buildRelation(e.id, rid, 'HAS_ROLE', '拥有角色'))
    }
  }

  const roles = (raw.roles as any[]) ?? []
  for (const r of roles) {
    if (!r?.roleId) continue
    const e = buildEntity(suiteId, r.roleId, r.name, 'ROLE', domain, sourceFile, r)
    entities.push(e)

    const perms = (r.permissions as string[]) ?? []
    for (const p of perms) {
      const pid = `${suiteId}:PERMISSION:${p}`
      relations.push(buildRelation(e.id, pid, 'HAS_PERMISSION', '拥有权限'))
    }
  }

  const perms = (raw.permissions as any[]) ?? []
  for (const p of perms) {
    if (!p?.permissionId) continue
    const e = buildEntity(suiteId, p.permissionId, p.permissionId, 'PERMISSION', domain, sourceFile, p)
    entities.push(e)

    if (p.targetRef) {
      const ttype = String(p.targetType ?? '').toUpperCase()
      let targetKind: EntityKind = 'BEHAVIOR'
      if (ttype === 'REPORT') targetKind = 'REPORT'
      const tid = `${suiteId}:${targetKind}:${p.targetRef}`
      relations.push(buildRelation(e.id, tid, 'PERMISSION_TARGET', '授权目标'))
    }
  }
}

// ─────────────── M6 流程模型 ───────────────

function parseM6(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const flows = (raw.flows as any[]) ?? []
  for (const f of flows) {
    if (!f?.id) continue
    const flowE = buildEntity(suiteId, f.id, f.name, 'FLOW', domain, sourceFile, f)
    entities.push(flowE)

    const bos = (f.businessObjectRefs as string[]) ?? []
    for (const bo of bos) {
      const aid = `${suiteId}:AGGREGATE_ROOT:${bo}`
      relations.push(buildRelation(flowE.id, aid, 'FLOW_BUSINESS_OBJECT', '操作对象'))
    }

    const roles = (f.roleRefs as string[]) ?? []
    for (const roleId of roles) {
      const rid = `${suiteId}:ROLE:${roleId}`
      relations.push(buildRelation(flowE.id, rid, 'FLOW_ROLE', '涉及角色'))
    }

    const acts = (f.activities as any[]) ?? []
    for (const act of acts) {
      if (!act?.activityId) continue
      const ae = buildEntity(suiteId, act.activityId, act.name, 'ACTIVITY', domain, sourceFile, act)
      entities.push(ae)
      relations.push(buildRelation(flowE.id, ae.id, 'FLOW_CONTAINS_ACTIVITY', '包含活动'))

      if (act.behaviorRef) {
        const bid = `${suiteId}:BEHAVIOR:${act.behaviorRef}`
        relations.push(buildRelation(ae.id, bid, 'ACTIVITY_CALLS_BEHAVIOR', '执行行为'))
      }

      if (act.roleRef) {
        const rid = `${suiteId}:ROLE:${act.roleRef}`
        relations.push(buildRelation(ae.id, rid, 'ACTIVITY_ROLE', '参与角色'))
      }

      const next = (act.nextActivities as string[]) ?? []
      for (const n of next) {
        const nid = `${suiteId}:ACTIVITY:${n}`
        relations.push(buildRelation(ae.id, nid, 'ACTIVITY_NEXT', '下一步'))
      }

      if (act.branches) {
        for (const br of act.branches as any[]) {
          if (br.targetActivity) {
            const tid = `${suiteId}:ACTIVITY:${br.targetActivity}`
            relations.push(buildRelation(ae.id, tid, 'ACTIVITY_NEXT', br.branchName ?? '分支'))
          }
        }
      }
    }
  }
}

// ─────────────── M7 报表模型 ───────────────

function parseM7(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const reports = (raw.query_reports as any[]) ?? []
  for (const rep of reports) {
    if (!rep?.id) continue
    const e = buildEntity(suiteId, rep.id, rep.name, 'REPORT', domain, sourceFile, rep, rep.alias)
    entities.push(e)

    if (rep.behaviorRef) {
      const bid = `${suiteId}:BEHAVIOR:${rep.behaviorRef}`
      relations.push(buildRelation(e.id, bid, 'REPORT_BEHAVIOR', '对应行为'))
    }

    const srcs = (rep.sourceObjects as any[]) ?? []
    for (const s of srcs) {
      if (s.objectRef) {
        const sid = `${suiteId}:AGGREGATE_ROOT:${s.objectRef}`
        relations.push(buildRelation(e.id, sid, 'REPORT_SOURCE_OBJECT', s.alias ?? '查询对象'))
      }
    }
  }
}

// ─────────────── MU UI 模型 ───────────────

function parseMU(
  raw: Record<string, unknown>,
  suiteId: string, sourceFile: string, domain: string,
  entities: OntologyEntity[], relations: OntologyRelation[],
): void {
  const app = (raw.application ?? {}) as Record<string, unknown>
  const menus = (app.menus as any[]) ?? []

  function walkMenu(menu: any, parentMenuId?: string): void {
    if (!menu?.menuId) return
    const menuEntity = buildEntity(suiteId, menu.menuId, menu.name, 'UI_MENU', domain, sourceFile, menu)
    entities.push(menuEntity)

    if (parentMenuId) {
      const pid = `${suiteId}:UI_MENU:${parentMenuId}`
      relations.push(buildRelation(menuEntity.id, pid, 'MENU_CONTAINS_MENU', '子菜单'))
    }

    if (menu.screenRef) {
      const sid = `${suiteId}:UI_SCREEN:${menu.screenRef}`
      relations.push(buildRelation(menuEntity.id, sid, 'MENU_SCREEN', '对应页面'))
    }

    const children = (menu.children as any[]) ?? []
    for (const c of children) walkMenu(c, menu.menuId)
  }
  for (const m of menus) walkMenu(m)

  const screens = (raw.screens as any[]) ?? (app.screens as any[]) ?? []
  for (const s of screens) {
    if (!s?.screenId) continue
    const e = buildEntity(suiteId, s.screenId, s.name ?? s.screenId, 'UI_SCREEN', domain, sourceFile, s)
    entities.push(e)
  }
}

// ─────────────── 悬空引用处理 ───────────────

function resolveDanglingRefs(
  entities: OntologyEntity[], relations: OntologyRelation[], _suiteId: string,
): void {
  const existing = new Set(entities.map(e => e.id))

  const danglingIds = new Set<string>()
  for (const r of relations) {
    if (!existing.has(r.from)) danglingIds.add(r.from)
    if (!existing.has(r.to)) danglingIds.add(r.to)
  }

  for (const did of danglingIds) {
    if (existing.has(did)) continue
    const parts = did.split(':')
    const rawId = parts.pop() ?? did
    entities.push({
      id: did,
      rawId,
      name: `[未解析] ${rawId}`,
      kind: 'DANGLING_REF',
      domain: '未知',
      sourceFile: '',
      properties: { dangling: true },
    })
  }

  const seenRels = new Set<string>()
  const deduped: OntologyRelation[] = []
  for (const r of relations) {
    const key = `${r.from}|${r.type}|${r.to}`
    if (seenRels.has(key)) continue
    seenRels.add(key)
    deduped.push(r)
  }
  relations.length = 0
  relations.push(...deduped)
}

// ─────────────── 路径工具 ───────────────

function relPath(p: string, base: string): string {
  try { return p.replace(base, '').replace(/^\\/, '').replace(/^\//, '') } catch { return p }
}

import { statSync } from 'node:fs'

/** 同步版本，避免 parseSuite 里 await 异步调用 */
export function resolveDatasourceRootSync(): string {
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    try {
      const st = statSync(join(dir, 'package.json'))
      if (st.isFile()) return join(dir, 'src', 'datasource')
    } catch { /* ignore */ }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return join(__dirname, 'datasource')
}

/** 异步版本，供 server.ts / datastore.ts 使用 */
export function resolveDatasourceRoot(): string {
  return resolveDatasourceRootSync()
}