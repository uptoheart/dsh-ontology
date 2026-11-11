import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type {
  SuiteData, OntologySuiteMeta, OntologyAnnotations, OntologyEntity, OntologyRelation,
  GraphData, GraphNode, GraphEdge, CoverageMatrix, CoverageCell, CoverageNodeInfo,
  DatastorageConfig, FrameworkDefinition, FrameworkNode, FrameworkDomain, FrameworkLevel,
  FlowchartData, FlowchartMeta, ViolatedMapping, EntityKind, ProcessCoverageMatrix,
  InterviewRecord, CrudMatrix, FlowOp, FrameMappingEntry, FrameMappingOld,
} from './shared-types.js'
import { mappingAxisOfKind, levelNumOfCode } from './shared-types.js'
import { discoverSuites, parseSuite, resolveDatasourceRoot as resolveDatasourceRootAsync } from './ontology-parser.js'
import {
  getBuiltinFramework, parseApqcCode, listBuiltinFrameworks, DEFAULT_NEW_SUITE_FW,
  registerFramework, validateFrameworkDefinition,
} from './builtin-frameworks.js'

/* FrameworkNode 运行时会挂 path（祖先链）和 node（父引用），类型声明补齐 */
declare module './shared-types.js' {
  interface FrameworkNode {
    path?: FrameworkNode[]
    node?: FrameworkNode | null
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function projRoot(): string {
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    try {
      const st = statSync(join(dir, 'package.json'))
      if (st.isFile()) return dir
    } catch { /* ignore */ }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return dirname(__dirname)
}

const DEFAULT_DATASTORAGE_PATH = 'src/datastorage'

/**
 * 数据存储根目录（datastorage）解析优先级：
 * 1. 环境变量 DSH_ONTOLOGY_DATA —— 部署/宿主环境显式指定
 * 2. config.json 显式配置的 datastoragePath —— 相对项目根
 * 3. 开发环境（项目根下存在 src/datastorage）—— 本地仓库开发体验不变
 * 4. 兜底 ~/.dsh-ontology/data —— 发布安装后的用户数据目录，跨插件升级持久、必定可写
 *
 * 发布包不含 src/（package.json files 白名单仅 dist），若写入安装目录，
 * 插件升级/重装时用户数据会整体丢失，故发布环境必须落到用户目录。
 */
export function resolveDatastorageRoot(cfg: DatastorageConfig): string {
  const env = process.env.DSH_ONTOLOGY_DATA?.trim()
  if (env) return resolve(env)
  const root = projRoot()
  if (cfg.datastoragePath && cfg.datastoragePath !== DEFAULT_DATASTORAGE_PATH) {
    return join(root, cfg.datastoragePath)
  }
  if (existsSync(join(root, 'src', 'datastorage'))) return join(root, 'src', 'datastorage')
  return join(homedir(), '.dsh-ontology', 'data')
}

/** 供其他应用复用同一存储根（安全域规则/评级/事件） */
export async function getStorageRoot(): Promise<string> {
  const cfg = await getConfig()
  return resolveDatastorageRoot(cfg)
}

let _configCache: DatastorageConfig | null = null

async function getConfig(): Promise<DatastorageConfig> {
  if (_configCache) return _configCache
  const root = projRoot()
  const dsRoot = join(root, 'src', 'datastorage')
  const cfPath = join(dsRoot, 'config.json')
  try {
    const raw = await readFile(cfPath, 'utf-8')
    _configCache = JSON.parse(raw) as DatastorageConfig
  } catch {
    _configCache = {
      datasourcePath: 'src/datasource',
      datastoragePath: DEFAULT_DATASTORAGE_PATH,
      defaultFramework: 'apqc-process',
      ontologyCodePattern: 'ONT-{L1}-{L2}-{L3}',
    }
  }
  return _configCache
}

async function ensureDir(path: string): Promise<void> {
  try { await mkdir(path, { recursive: true }) } catch { /* exists */ }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir(dirname(path))
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch { return fallback }
}

function suiteDir(storageRoot: string, suiteId: string): string {
  return join(storageRoot, 'ontologies', suiteId)
}

// ─────────────── 套件级读写 ───────────────

export async function listImportedSuites(appId?: string): Promise<OntologySuiteMeta[]> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  const suitesDir = join(storageRoot, 'ontologies')
  let entries: string[]
  try { entries = await readdir(suitesDir) } catch { return [] }

  const metas: OntologySuiteMeta[] = []
  for (const e of entries) {
    const metaPath = join(suitesDir, e, 'meta.json')
    const meta = await readJsonSafe<OntologySuiteMeta | null>(metaPath, null)
    if (!meta) continue
    if (appId && (meta.appId ?? 'pcf') !== appId) continue
    metas.push(meta)
  }
  return metas.sort((a, b) => b.importTime - a.importTime)
}

/**
 * 实体→框架映射 旧格式 → 新格式 迁移
 *
 * 旧：entityId → { frameworkId, apqcCode, note, mappedAt }  单条，框架信息在 value 里
 * 新：entityId → { frameworkId: { apqcCode, note, mappedAt } }  多条，frameworkId 在 key 里
 *
 * 自动迁移策略：
 *   1) 每条旧记录原样塞进新结构的旧 frameworkId 下
 *   2) 对每个已挂载的 apqcCode，遍历当前所有已注册框架（listBuiltinFrameworks）
 *      若 code 在另一个框架里也有效（findNodeByCode != null），则视为「编号同形、框架不同」的
 *      多框架共享位置，自动复制一份进去（note 追加提示）——这是**语义级**迁移，不是盲目复制
 *   3) 迁移后触发 saveSuite 写回磁盘（幂等，启动时跑一次）
 *
 * 返回值：迁移完成的 annotations，以及一个 warnings 列表（可用于前端弹窗提示人工确认的部分）
 */
function findNodeByCode(fw: FrameworkDefinition, code: string): FrameworkNode | null {
  if (!fw || !code) return null
  // 复用 builtin-frameworks 导出的同函数（避免 import 声明在文件中间），这里用 inline walk
  const walk = (list: FrameworkNode[] | undefined): FrameworkNode | null => {
    if (!list) return null
    for (const n of list) {
      if (n.code === code) return n
      const r = walk(n.children)
      if (r) return r
    }
    return null
  }
  for (const d of fw.domains || []) {
    const r = walk(d.children)
    if (r) return r
  }
  return null
}

interface MigrationResult {
  annotations: OntologyAnnotations
  migrated: number       // 旧记录数
  propagated: number     // 跨框架同形 code 自动复制的条目数
  warnings: string[]     // 需要人工关注的模糊或缺失项（当前仅输出）
}

export function detectAndMigrateEntityFrameMapping(
  annotations: OntologyAnnotations,
): MigrationResult {
  const mapping = annotations.entityFrameMapping
  if (!mapping) return { annotations, migrated: 0, propagated: 0, warnings: [] }

  const first = Object.values(mapping).find(v => v)
  if (!first) return { annotations, migrated: 0, propagated: 0, warnings: [] }

  // 旧格式检测：首条 value 有 frameworkId 字段
  const isOld = Object.prototype.hasOwnProperty.call(first, 'frameworkId')

  // 新格式检测：首条 value 是 Object，但无 frameworkId，且 value 里 value 也是 Object
  const isNew = !isOld && typeof first === 'object' &&
    Object.values(first as object).some(v => v && typeof v === 'object' && !('frameworkId' in v))

  if (isNew) return { annotations, migrated: 0, propagated: 0, warnings: [] }

  // 迁移
  const result: Record<string, Record<string, FrameMappingEntry>> = {}
  let migrated = 0
  const warnings: string[] = []

  for (const [entityId, oldRec] of Object.entries(mapping)) {
    const rec = oldRec as FrameMappingOld
    if (!rec || !rec.frameworkId) { warnings.push(`${entityId} 缺少 frameworkId，跳过`); continue }
    migrated++
    const entry: FrameMappingEntry = { apqcCode: rec.apqcCode, domainCode: rec.domainCode, levelCode: rec.levelCode, note: rec.note, mappedAt: (rec as any).mappedAt }
    if (!result[entityId]) result[entityId] = {}
    result[entityId][rec.frameworkId] = entry
  }

  // 跨框架同形 code 语义级复制
  let propagated = 0
  const allFwIds = listBuiltinFrameworks().map(f => f.frameworkId)
  for (const [entityId, fwMap] of Object.entries(result)) {
    for (const [fwId, entry] of Object.entries(fwMap)) {
      if (!entry.apqcCode) continue
      const thisFw = getBuiltinFramework(fwId)
      if (!thisFw) continue
      for (const otherId of allFwIds) {
        if (otherId === fwId) continue
        if (result[entityId]?.[otherId]) continue // 已经挂过了，尊重原数据
        const otherFw = getBuiltinFramework(otherId)
        if (!otherFw) continue
        if (findNodeByCode(otherFw, entry.apqcCode)) {
          result[entityId][otherId] = {
            apqcCode: entry.apqcCode,
            note: (entry.note ? entry.note + ' · ' : '') + `语义迁移：与 ${fwId} 编号同形（自动）`,
            mappedAt: Date.now(),
          }
          propagated++
        }
      }
    }
  }

  annotations.entityFrameMapping = result
  return { annotations, migrated, propagated, warnings }
}

/** 从 entityFrameMapping（旧/新双格式）取指定框架的映射条目，统一入口 */
function fwEntryOf(
  mapping: OntologyAnnotations['entityFrameMapping'] | undefined,
  entityId: string,
  fwId: string,
): FrameMappingEntry | null {
  if (!mapping) return null
  const v = (mapping as any)[entityId]
  if (!v) return null
  // 旧格式：{ frameworkId, apqcCode, ... }
  if (typeof v === 'object' && 'frameworkId' in v) {
    return v.frameworkId === fwId ? { apqcCode: v.apqcCode, domainCode: v.domainCode, levelCode: v.levelCode, note: v.note, mappedAt: (v as any).mappedAt } : null
  }
  // 新格式：{ [fwId]: Entry }
  const entry = (v as Record<string, FrameMappingEntry>)[fwId]
  return entry || null
}

/** 列出 entityFrameMapping 里某实体在所有框架下的映射（新格式），旧格式只返回单条 */
function allFwEntries(mapping: OntologyAnnotations['entityFrameMapping'] | undefined, entityId: string): Array<[string, FrameMappingEntry]> {
  if (!mapping) return []
  const v = (mapping as any)[entityId]
  if (!v) return []
  if (typeof v === 'object' && 'frameworkId' in v) {
    return [[(v as FrameMappingOld).frameworkId, { apqcCode: (v as FrameMappingOld).apqcCode, note: (v as FrameMappingOld).note, mappedAt: (v as any).mappedAt }]]
  }
  return Object.entries(v as Record<string, FrameMappingEntry>)
}

export async function loadSuite(suiteId: string): Promise<SuiteData | null> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  const dir = suiteDir(storageRoot, suiteId)

  let meta = await readJsonSafe<OntologySuiteMeta | null>(join(dir, 'meta.json'), null)
  if (!meta) return null

  // meta 迁移层：旧单框架 → 多框架清单（零破坏，迁移后回写）
  let metaMigrated = false
  if (!meta.frameworks || !meta.frameworks.length) {
    const old = meta.frameworkId || 'apqc-process'
    // 只有在旧 frameworkId 有效且存在时才保留；否则用默认
    meta.frameworks = [old]
    meta.activeFrameworkId = old
    metaMigrated = true
  }
  if (!meta.activeFrameworkId || !meta.frameworks.includes(meta.activeFrameworkId)) {
    meta.activeFrameworkId = meta.frameworks[0]
    metaMigrated = true
  }
  if (metaMigrated) {
    try { await writeJson(join(dir, 'meta.json'), meta) } catch { /* ignore */ }
  }

  const entities = await readJsonSafe<OntologyEntity[]>(join(dir, 'entities.json'), [])
  const relations = await readJsonSafe<OntologyRelation[]>(join(dir, 'relations.json'), [])
  let annotations = await readJsonSafe<OntologyAnnotations>(join(dir, 'annotations.json'), {
    entityFrameMapping: {}, coverageMarks: {}, customRelations: [],
  })

  // 迁移层：旧格式 → 新格式，并尝试跨框架同形 code 语义级复制；迁移后自动回写磁盘
  const migration = detectAndMigrateEntityFrameMapping(annotations)
  annotations = migration.annotations
  if (migration.migrated > 0 || migration.propagated > 0) {
    try { await saveAnnotations(suiteId, annotations as OntologyAnnotations) } catch { /* ignore 磁盘写失败，内存里已经是新格式了 */ }
  }

  return { entities, relations, meta, annotations }
}

export async function saveSuite(suiteId: string, data: SuiteData): Promise<void> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  const dir = suiteDir(storageRoot, suiteId)
  await writeJson(join(dir, 'meta.json'), data.meta)
  await writeJson(join(dir, 'entities.json'), data.entities)
  await writeJson(join(dir, 'relations.json'), data.relations)
  await writeJson(join(dir, 'annotations.json'), data.annotations)
}

export async function saveAnnotations(suiteId: string, annotations: OntologyAnnotations): Promise<void> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  await writeJson(join(suiteDir(storageRoot, suiteId), 'annotations.json'), annotations)
}

/** 设置套件多框架清单 + 当前激活框架（写入 meta.json；frameworks 可空，空则 activeFrameworkId 被设为唯一框架） */
export async function setSuiteFrameworks(
  suiteId: string,
  frameworks: string[],
  activeFrameworkId?: string,
): Promise<OntologySuiteMeta | null> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  const metaPath = join(suiteDir(storageRoot, suiteId), 'meta.json')
  const meta = await readJsonSafe<OntologySuiteMeta | null>(metaPath, null)
  if (!meta) return null

  const list = frameworks && frameworks.length ? [...new Set(frameworks)] : (meta.frameworks?.length ? meta.frameworks : [meta.frameworkId || 'apqc-process'])
  meta.frameworks = list
  meta.activeFrameworkId = activeFrameworkId && list.includes(activeFrameworkId) ? activeFrameworkId : list[0]
  // 同步写回旧字段（保持向后兼容，读取代码迟早全部切 activeFrameworkId）
  meta.frameworkId = meta.activeFrameworkId
  await writeJson(metaPath, meta)
  return meta
}

/** 旧接口：单框架锁定 → 内部转调 setSuiteFrameworks 作为唯一框架 */
export async function setSuiteFramework(suiteId: string, frameworkId: string): Promise<OntologySuiteMeta | null> {
  return setSuiteFrameworks(suiteId, [frameworkId], frameworkId)
}

// ─────────────── Import (datasource → datastorage) ───────────────

export async function importFromDatasource(
  force = false,
  defaultFw?: string,
): Promise<{ updated: string[]; skipped: string[] }> {
  const cfg = await getConfig()
  const storageRoot = resolveDatastorageRoot(cfg)
  const sourceRoot = join(projRoot(), cfg.datasourcePath)
  await ensureDir(storageRoot)

  const discSuites = await discoverSuites(sourceRoot)
  const existingMetas = new Map<string, OntologySuiteMeta>()
  for (const m of await listImportedSuites()) existingMetas.set(m.suiteId, m)

  const updated: string[] = []
  const skipped: string[] = []

  for (const disc of discSuites) {
    const existing = existingMetas.get(disc.suiteId)
    const needsImport = force || !existing || existing.sourceMtime < disc.maxMtime
    if (!needsImport) { skipped.push(disc.suiteId); continue }

    const parsed = await parseSuite(disc)
    if (existing) {
      // 重新导入保留现场标注（实体 ID 确定性生成：suiteId:kind:rawId，映射在重导入后依然有效）
      const prev = await loadSuite(disc.suiteId)
      if (prev) parsed.annotations = prev.annotations
    }
    // 框架项目级锁定：已有套件保留原 frameworkId（可为 undefined = 旧套件按 apqc-process 兼容）；
    // 新套件使用 defaultFw（调用方选择），未指定时缺省 DEFAULT_NEW_SUITE_FW（hw-style-pcf）
    parsed.meta.frameworkId = existing ? existing.frameworkId : (defaultFw ?? DEFAULT_NEW_SUITE_FW)
    await saveSuite(disc.suiteId, parsed)
    updated.push(disc.suiteId)
  }

  return { updated, skipped }
}

// ─────────────── 图数据组装 ───────────────

export function assembleGraph(suite: SuiteData): GraphData {
  const nodes: GraphNode[] = suite.entities.map(e => ({
    id: e.id,
    rawId: e.rawId,
    name: e.name,
    kind: e.kind,
    domain: e.domain,
    group: e.kind,
  }))
  const edges: GraphEdge[] = suite.relations.map(r => ({
    id: r.id,
    source: r.from,
    target: r.to,
    type: r.type,
    label: r.label,
  }))
  return { nodes, edges }
}

// ─────────────── 覆盖度计算 ───────────────
// 注：findNodeByCode 在顶部已定义（迁移函数用的 inline walk），不再二次 import

function calcRollupStatus(counts: { covered: number; partial: number; gap: number; unset: number; total: number }): import('./shared-types.js').CoverageStatus {
  if (counts.covered === counts.total && counts.total > 0) return 'covered'
  if (counts.covered > 0 && counts.gap === 0) return 'partial'
  if (counts.gap > 0 && counts.covered === 0 && counts.partial === 0) return 'gap'
  if (counts.total === 0) return 'unset'
  // 全部为未标注（无任何显式状态）时不误报为部分覆盖
  if (counts.unset === counts.total) return 'unset'
  return 'partial'
}

type CoverageEntry = { entityId: string; status: import('./shared-types.js').CoverageStatus }

export function computeCoverage(suite: SuiteData, frameworkId: string): CoverageMatrix {
  const fw = getBuiltinFramework(frameworkId)
  if (!fw) {
    return {
      frameworkId,
      suiteId: suite.meta.suiteId,
      domains: [], levels: [], cells: [],
      totalEntities: suite.entities.length,
      leafTotal: 0, leafCovered: 0, leafPartial: 0, leafGap: 0, leafUnset: 0,
      tree: [],
      domainEntityCount: 0, fullTree: [], violatedMappings: [],
    }
  }

  // ── 1. 按 kind 分流：域轴（L1/L2）与流程轴（L3+）分桶，违规映射只标记不删除 ──
  const domainNodeMap = new Map<string, CoverageEntry[]>()
  const processNodeMap = new Map<string, CoverageEntry[]>()
  const violatedMappings: ViolatedMapping[] = []
  const domainEntityIds = new Set<string>()

  // 遍历所有实体，每个实体在所有框架下的映射条目中，只处理当前 frameworkId 匹配的那一条
  for (const entityId of Object.keys(suite.annotations.entityFrameMapping || {})) {
    const pairs = allFwEntries(suite.annotations.entityFrameMapping, entityId)
    for (const [fwId, frameMapping] of pairs) {
      if (fwId !== frameworkId || !frameMapping.apqcCode) continue
      const entity = suite.entities.find(e => e.id === entityId)
      if (!entity) continue
      const mark = suite.annotations.coverageMarks[entityId]
      const status = mark?.status ?? 'unset'
      const axis = mappingAxisOfKind(entity.kind)
      const lvl = levelNumOfCode(frameMapping.apqcCode)
      const levelId = `L${Math.min(Math.max(lvl, 1), 5)}`

      if (axis === 'none') {
        violatedMappings.push({
          entityId, entityName: entity.name, kind: entity.kind,
          apqcCode: frameMapping.apqcCode, levelId,
          reason: `${entity.kind} 类型暂不参与框架映射`,
        })
        continue
      }
      if (axis === 'domain' && lvl > 2) {
        violatedMappings.push({
          entityId, entityName: entity.name, kind: entity.kind,
          apqcCode: frameMapping.apqcCode, levelId,
          reason: '实体类（名词轴）仅允许映射到 L1/L2，L3+ 属流程轴',
        })
        continue
      }
      if (axis === 'process' && lvl < 3) {
        violatedMappings.push({
          entityId, entityName: entity.name, kind: entity.kind,
          apqcCode: frameMapping.apqcCode, levelId,
          reason: '流程类（动词轴）仅允许映射到 L3-L5',
        })
        continue
      }

      // 只登记到同轴层级的祖先节点：域轴仅 L1/L2，流程轴仅 L3+
      const target = axis === 'domain' ? domainNodeMap : processNodeMap
      if (axis === 'domain') domainEntityIds.add(entityId)
      for (const code of collectAncestorCodes(fw, frameMapping.apqcCode)) {
        const ancestorLvl = levelNumOfCode(code)
        if (axis === 'domain' && ancestorLvl > 2) continue
        if (axis === 'process' && ancestorLvl < 3) continue
        const list = target.get(code) ?? []
        list.push({ entityId, status })
        target.set(code, list)
      }
    }
  }

  // ── 2. 域覆盖树（截断到 L2，仅统计名词轴实体）──
  const truncated = truncateFrameworkToL2(fw)
  const tree: CoverageNodeInfo[] = truncated.map(node => buildCoverageForNode(node, domainNodeMap))
  const leafStats = computeLeafStatsFromTree(tree)
  const cells = computeLevelAggregation(fw, domainNodeMap)

  // ── 3. 全深度树（APQC 地图页导航用，按节点层级取对应轴的数据）──
  const fullTree: CoverageNodeInfo[] = fw.domains.map(domain => buildAxisAwareNode(
    { code: domain.code, name: domain.name, label: domain.label, levelId: 'L1', pcfId: domain.pcfId, definition: domain.definition, children: domain.children },
    domainNodeMap, processNodeMap,
  ))

  return {
    frameworkId,
    suiteId: suite.meta.suiteId,
    domains: fw.domains,
    levels: fw.levels,
    cells,
    totalEntities: suite.entities.length,
    domainEntityCount: domainEntityIds.size,
    leafTotal: leafStats.total,
    leafCovered: leafStats.covered,
    leafPartial: leafStats.partial,
    leafGap: leafStats.gap,
    leafUnset: leafStats.unset,
    tree,
    fullTree,
    violatedMappings,
  }
}

/** 域覆盖树：L1（domain）→ L2 截断（丢弃 L2 的 children） */
function truncateFrameworkToL2(fw: FrameworkDefinition): FrameworkNode[] {
  return fw.domains.map(domain => ({
    code: domain.code, name: domain.name, label: domain.label,
    levelId: 'L1', pcfId: domain.pcfId, definition: domain.definition,
    children: (domain.children ?? []).map(c => ({
      code: c.code, name: c.name, label: c.label, levelId: c.levelId,
      pcfId: c.pcfId, definition: c.definition, children: undefined,
    })),
  }))
}

function computeLeafStatsFromTree(tree: CoverageNodeInfo[]): { total: number; covered: number; partial: number; gap: number; unset: number } {
  const stats = { total: 0, covered: 0, partial: 0, gap: 0, unset: 0 }
  const walk = (n: CoverageNodeInfo): void => {
    if (n.children && n.children.length > 0) { n.children.forEach(walk); return }
    stats.total++
    stats[n.status]++
  }
  tree.forEach(walk)
  return stats
}

/**
 * 全深度树构建：节点取数按自身层级分轴——L1/L2 读域轴桶，L3+ 读流程轴桶；
 * rollup 只聚合同轴子节点（L1←L2、L3←L4←L5），不跨轴汇总。
 */
function buildAxisAwareNode(
  node: FrameworkNode,
  domainMap: Map<string, CoverageEntry[]>,
  processMap: Map<string, CoverageEntry[]>,
): CoverageNodeInfo {
  const lvl = levelNumOfCode(node.code)
  const isDomainLevel = lvl <= 2
  const map = isDomainLevel ? domainMap : processMap

  const childNodes = node.children && node.children.length > 0
    ? node.children.map(c => buildAxisAwareNode(c, domainMap, processMap))
    : undefined

  const direct = map.get(node.code) ?? []
  let coveredCount = 0
  let partialCount = 0
  let gapCount = 0
  let entityCount = direct.length
  const entities = new Set<string>()
  for (const e of direct) {
    entities.add(e.entityId)
    if (e.status === 'covered') coveredCount++
    else if (e.status === 'partial') partialCount++
    else if (e.status === 'gap') gapCount++
  }

  // 仅聚合同轴子节点
  const sameAxisKids = (childNodes ?? []).filter(c => (levelNumOfCode(c.code) <= 2) === isDomainLevel)
  for (const c of sameAxisKids) {
    entityCount += c.entityCount
    for (const eid of c.entities) entities.add(eid)
    coveredCount += c.coveredCount
    partialCount += c.partialCount
    gapCount += c.gapCount
  }

  let status: import('./shared-types.js').CoverageStatus
  if (sameAxisKids.length > 0) {
    status = calcRollupStatus({
      covered: coveredCount, partial: partialCount, gap: gapCount,
      unset: entityCount - coveredCount - partialCount - gapCount,
      total: entityCount,
    })
  } else {
    status = direct.length === 0 ? 'unset' : calcRollupStatus({
      covered: coveredCount, partial: partialCount, gap: gapCount,
      unset: direct.length - coveredCount - partialCount - gapCount,
      total: direct.length,
    })
  }

  return {
    code: node.code,
    name: node.name,
    label: node.label,
    levelId: node.levelId,
    entityCount,
    coveredCount,
    partialCount,
    gapCount,
    status,
    entities: Array.from(entities),
    children: childNodes,
  }
}

function collectAncestorCodes(fw: ReturnType<typeof getBuiltinFramework> & {}, codeOrPath: string): string[] {
  const result: string[] = []
  const parts = codeOrPath.split('.').filter(Boolean)
  for (let i = 1; i <= parts.length; i++) {
    result.push(parts.slice(0, i).join('.'))
  }
  const info = findNodeByCode(fw as any, codeOrPath)
  if (!info) return result
  for (const anc of info.path || []) {
    if (!result.includes(anc.code)) result.push(anc.code)
  }
  return result
}

function buildCoverageForNode(
  node: FrameworkNode,
  nodeEntityMap: Map<string, { entityId: string; status: import('./shared-types.js').CoverageStatus }[]>,
): CoverageNodeInfo {
  const childNodes: CoverageNodeInfo[] | undefined = node.children && node.children.length > 0
    ? node.children.map(c => buildCoverageForNode(c, nodeEntityMap))
    : undefined

  const direct = nodeEntityMap.get(node.code) ?? []

  let entityCount = direct.length
  let coveredCount = 0
  let partialCount = 0
  let gapCount = 0
  const entities = new Set<string>()
  for (const e of direct) {
    entities.add(e.entityId)
    if (e.status === 'covered') coveredCount++
    else if (e.status === 'partial') partialCount++
    else if (e.status === 'gap') gapCount++
  }

  let status: import('./shared-types.js').CoverageStatus
  if (childNodes && childNodes.length > 0) {
    for (const c of childNodes) {
      entityCount += c.entityCount
      for (const eid of c.entities) entities.add(eid)
      coveredCount += c.coveredCount
      partialCount += c.partialCount
      gapCount += c.gapCount
    }
    status = calcRollupStatus({
      covered: coveredCount, partial: partialCount, gap: gapCount,
      unset: entityCount - coveredCount - partialCount - gapCount,
      total: entityCount,
    })
  } else {
    status = direct.length === 0 ? 'unset' : calcRollupStatus({
      covered: coveredCount, partial: partialCount, gap: gapCount,
      unset: direct.length - coveredCount - partialCount - gapCount,
      total: direct.length,
    })
  }

  return {
    code: node.code,
    name: node.name,
    label: node.label,
    levelId: node.levelId,
    entityCount,
    coveredCount,
    partialCount,
    gapCount,
    status,
    entities: Array.from(entities),
    children: childNodes,
  }
}

function computeLevelAggregation(
  fw: FrameworkDefinition,
  nodeEntityMap: Map<string, { entityId: string; status: import('./shared-types.js').CoverageStatus }[]>,
): CoverageCell[] {
  const cellsMap = new Map<string, CoverageCell>()

  const flattenAll = flattenFrameworkForAgg(fw)
  for (const node of flattenAll) {
    const list = nodeEntityMap.get(node.code) ?? []
    if (list.length === 0) continue
    const parts = node.code.split('.')
    const domainCode = `${parts[0]}.0`
    const domain = fw.domains.find(d => d.code === domainCode)
    const lvl = fw.levels.find(l => l.id === node.levelId)

    const key = `${domainCode}|${node.levelId}`
    let cell = cellsMap.get(key)
    if (!cell) {
      cell = {
        domainId: domain?.id ?? domainCode,
        domainName: domain?.label ?? domain?.name ?? domainCode,
        levelId: node.levelId,
        levelLabel: lvl?.label ?? lvl?.name ?? node.levelId,
        entityCount: 0, coveredCount: 0, partialCount: 0, gapCount: 0,
        entities: [],
      }
      cellsMap.set(key, cell)
    }
    const eids = new Set(cell.entities)
    for (const e of list) {
      if (eids.has(e.entityId)) continue
      eids.add(e.entityId)
      cell.entityCount++
      cell.entities.push(e.entityId)
      if (e.status === 'covered') cell.coveredCount++
      else if (e.status === 'partial') cell.partialCount++
      else if (e.status === 'gap') cell.gapCount++
    }
  }

  return Array.from(cellsMap.values())
}

function flattenFrameworkForAgg(fw: FrameworkDefinition): FrameworkNode[] {
  const all: FrameworkNode[] = []
  for (const domain of fw.domains) {
    all.push({
      code: domain.code, name: domain.name, label: domain.label,
      levelId: 'L1', pcfId: domain.pcfId, definition: domain.definition,
      children: domain.children,
    })
    collectFrameworkChildren(domain.children, all)
  }
  return all
}

function collectFrameworkChildren(nodes: FrameworkNode[], bucket: FrameworkNode[]): void {
  for (const n of nodes) {
    bucket.push(n)
    if (n.children) collectFrameworkChildren(n.children, bucket)
  }
}

// ─────────────── 流程图存取 ───────────────

function flowchartsDir(storageRoot: string): string {
  return join(storageRoot, 'flowcharts')
}

function isFlowchartData(v: unknown): v is FlowchartData {
  if (!v || typeof v !== 'object') return false
  const d = v as Partial<FlowchartData>
  return typeof d.id === 'string' && typeof d.name === 'string'
    && Array.isArray(d.nodes) && Array.isArray(d.edges)
}

export async function listFlowcharts(): Promise<FlowchartMeta[]> {
  const cfg = await getConfig()
  const dir = flowchartsDir(resolveDatastorageRoot(cfg))
  let entries: string[]
  try { entries = (await readdir(dir)).filter(f => f.endsWith('.json')) } catch { return [] }

  const metas: FlowchartMeta[] = []
  for (const f of entries) {
    const data = await readJsonSafe<FlowchartData | null>(join(dir, f), null)
    if (!isFlowchartData(data)) continue
    metas.push({
      id: data.id, name: data.name,
      suiteId: data.suiteId, apqcCode: data.apqcCode,
      nodeCount: data.nodes.length, edgeCount: data.edges.length,
      participationCount: data.semantics?.participations?.length ?? 0,
      createdAt: data.createdAt ?? 0, updatedAt: data.updatedAt ?? 0,
    })
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getFlowchart(id: string): Promise<FlowchartData | null> {
  const cfg = await getConfig()
  // id 仅允许字母数字下划线连字符，防止路径穿越
  if (!/^[\w-]+$/.test(id)) return null
  const dir = flowchartsDir(resolveDatastorageRoot(cfg))
  const data = await readJsonSafe<FlowchartData | null>(join(dir, `${id}.json`), null)
  return isFlowchartData(data) ? data : null
}

export async function saveFlowchart(input: {
  id?: string; name: string
  suiteId?: string; apqcCode?: string
  nodes: FlowchartData['nodes']; edges: FlowchartData['edges']
  semantics?: FlowchartData['semantics']
}): Promise<FlowchartData> {
  const cfg = await getConfig()
  const dir = flowchartsDir(resolveDatastorageRoot(cfg))
  const existing = input.id ? await getFlowchart(input.id) : null
  const now = Date.now()
  const data: FlowchartData = {
    id: existing?.id ?? `flow-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    suiteId: input.suiteId || existing?.suiteId,
    apqcCode: input.apqcCode || undefined,
    nodes: input.nodes,
    edges: input.edges,
    semantics: input.semantics,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await writeJson(join(dir, `${data.id}.json`), data)
  return data
}

/** 读取某套件下的全部流程图（含语义层；旧数据无 suiteId 不计入） */
export async function listFlowchartsForSuite(suiteId: string): Promise<FlowchartData[]> {
  const cfg = await getConfig()
  const dir = flowchartsDir(resolveDatastorageRoot(cfg))
  let entries: string[]
  try { entries = (await readdir(dir)).filter(f => f.endsWith('.json')) } catch { return [] }
  const out: FlowchartData[] = []
  for (const f of entries) {
    const data = await readJsonSafe<FlowchartData | null>(join(dir, f), null)
    if (isFlowchartData(data) && data.suiteId === suiteId) out.push(data)
  }
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

/**
 * 语义投影（读取时推导）：将流程图 participations 投影为 ACTIVITY_OPERATES_OBJECT 派生关系。
 * - 活动端：优先取 participation 节点 APQC 编号所映射的流程类实体（kind ∈ PROCESS_KINDS）
 * - 无可解析活动实体时不产出关系（参与关系仍计入流程覆盖度）
 * - 幂等且重导入安全：不落库，suite.relations 保持纯净；删除流程图后派生关系自动消失
 */
export function deriveFlowRelations(suite: SuiteData, flows: FlowchartData[]): OntologyRelation[] {
  const kindOf = new Map(suite.entities.map(e => [e.id, e.kind]))
  const activityByCode = new Map<string, string[]>()
  // 遍历所有实体×所有框架的映射条目，累积「编号 → 流程类实体」索引（跨框架同形编号自然合并）
  for (const entityId of Object.keys(suite.annotations.entityFrameMapping || {})) {
    const kind = kindOf.get(entityId)
    if (!kind || mappingAxisOfKind(kind) !== 'process') continue
    for (const [, entry] of allFwEntries(suite.annotations.entityFrameMapping, entityId)) {
      if (!entry.apqcCode) continue
      const list = activityByCode.get(entry.apqcCode) ?? []
      list.push(entityId)
      activityByCode.set(entry.apqcCode, list)
    }
  }

  const out: OntologyRelation[] = []
  for (const flow of flows) {
    for (const p of flow.semantics?.participations ?? []) {
      const node = flow.nodes.find(n => n.id === p.nodeId)
      const actId = node?.code ? activityByCode.get(node.code)?.[0] : undefined
      if (!actId || !p.entityId) continue
      out.push({
        id: `flow-${flow.id}-${p.nodeId}-${p.entityId}-${p.op}`,
        from: actId,
        to: p.entityId,
        type: 'ACTIVITY_OPERATES_OBJECT',
        label: p.op,
        properties: {
          op: p.op,
          derivedFrom: `flow:${flow.id}`,
          flowName: flow.name,
          nodeId: p.nodeId,
        },
      })
    }
  }
  return out
}

/** 套件数据 + 派生关系合并视图（图谱/覆盖度使用；原 loadSuite 保持纯净） */
export async function loadSuiteWithDerived(suiteId: string): Promise<(SuiteData & { derivedRelations: OntologyRelation[] }) | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const flows = await listFlowchartsForSuite(suiteId)
  const interviews = await listInterviews(suiteId)
  const derivedRelations = [
    ...deriveFlowRelations(suite, flows),
    ...deriveInterviewRelations(suite, interviews),
  ]
  return { ...suite, relations: [...suite.relations, ...derivedRelations], derivedRelations }
}

/**
 * 流程覆盖度（动词轴，自动推导，只读）：
 * - L3 covered ⇔ 存在挂载 FlowDoc 且 participations 非空；partial ⇔ 挂载但无参与；否则未挂载
 * - L4/L5 covered ⇔ 画板节点（该编号）有 op 且有角色；partial ⇔ 仅其一；无画板活动时回看 ACTIVITY 实体映射
 * - rollup 沿用 calcRollupStatus，L3 状态由子树/自身推导
 */
export function computeProcessCoverage(
  suite: SuiteData,
  flows: FlowchartData[],
  frameworkId: string,
  interviews: InterviewRecord[] = [],
): ProcessCoverageMatrix {
  const fw = getBuiltinFramework(frameworkId)
  if (!fw) {
    return { frameworkId, suiteId: suite.meta.suiteId, tree: [], l3Total: 0, l3Covered: 0, l3Partial: 0, l3Unmounted: 0, mountedFlows: [], gapList: [] }
  }

  // L3 挂载表
  const mountByCode = new Map<string, { flowIds: string[]; hasParts: boolean }>()
  for (const f of flows) {
    if (!f.apqcCode || levelNumOfCode(f.apqcCode) !== 3) continue
    const hasParts = (f.semantics?.participations ?? []).length > 0
    const cur = mountByCode.get(f.apqcCode) ?? { flowIds: [], hasParts: false }
    cur.flowIds.push(f.id)
    cur.hasParts = cur.hasParts || hasParts
    mountByCode.set(f.apqcCode, cur)
  }

  // L4/L5 画板活动表：编号 → { hasOp, hasRole }
  const actByCode = new Map<string, { hasOp: boolean; hasRole: boolean }>()
  for (const f of flows) {
    for (const n of f.nodes) {
      if (!n.code || levelNumOfCode(n.code) < 4) continue
      const parts = (f.semantics?.participations ?? []).filter(p => p.nodeId === n.id)
      const roleRef = f.semantics?.activities?.[n.id]?.roleRef
      const cur = actByCode.get(n.code) ?? { hasOp: false, hasRole: false }
      if (parts.length > 0) cur.hasOp = true
      if (roleRef) cur.hasRole = true
      actByCode.set(n.code, cur)
    }
  }

  // ACTIVITY 实体映射回退：L4+ 编号 → 实体标注状态
  const entityMarkByCode = new Map<string, import('./shared-types.js').CoverageStatus[]>()
  for (const entityId of Object.keys(suite.annotations.entityFrameMapping || {})) {
    const e = suite.entities.find(x => x.id === entityId)
    if (!e || mappingAxisOfKind(e.kind) !== 'process') continue
    const mark = suite.annotations.coverageMarks[entityId]
    const status = mark?.status ?? 'unset'
    for (const [, entry] of allFwEntries(suite.annotations.entityFrameMapping, entityId)) {
      if (!entry.apqcCode || levelNumOfCode(entry.apqcCode) < 4) continue
      const list = entityMarkByCode.get(entry.apqcCode) ?? []
      list.push(status)
      entityMarkByCode.set(entry.apqcCode, list)
    }
  }

  // 访谈记录：L4/L5 编号 → 四问信号（有对象=op，有角色=role）
  for (const itv of interviews) {
    if (!itv.apqcCode || levelNumOfCode(itv.apqcCode) < 4) continue
    const cur = actByCode.get(itv.apqcCode) ?? { hasOp: false, hasRole: false }
    const a = itv.answers ?? {}
    if (a.hasObject?.value && a.hasObject.entityId && a.hasObject.op) cur.hasOp = true
    if (a.hasRole?.value && a.hasRole.roleRef) cur.hasRole = true
    actByCode.set(itv.apqcCode, cur)
  }

  const statusOfL4 = (code: string): import('./shared-types.js').CoverageStatus => {
    const c = actByCode.get(code)
    if (c) {
      if (c.hasOp && c.hasRole) return 'covered'
      if (c.hasOp || c.hasRole) return 'partial'
    }
    const marks = entityMarkByCode.get(code)
    if (marks && marks.length) {
      return calcRollupStatus({
        covered: marks.filter(s => s === 'covered').length,
        partial: marks.filter(s => s === 'partial').length,
        gap: marks.filter(s => s === 'gap').length,
        unset: marks.filter(s => s === 'unset').length,
        total: marks.length,
      })
    }
    return 'unset'
  }

  // 构建裁剪树：L3 仅保留挂载/有子活动的分支；L4/L5 保留有状态的分支
  const l3Total = { n: 0 }
  const counters = { covered: 0, partial: 0, unmounted: 0 }
  const gapList: ProcessCoverageMatrix['gapList'] = []
  const classify = (st: import('./shared-types.js').CoverageStatus): void => {
    if (st === 'covered') counters.covered++
    else if (st === 'partial') counters.partial++
    else counters.unmounted++
  }

  /** L4/L5 子树：叶子状态查表，非叶子递归 + 自身状态合并 */
  const buildSub = (node: FrameworkNode): CoverageNodeInfo | null => {
    const lvl = levelNumOfCode(node.code)
    if (lvl < 4) return null
    const selfSt = statusOfL4(node.code)
    const kids = (node.children ?? []).map(buildSub).filter(Boolean) as CoverageNodeInfo[]
    if (!kids.length) return selfSt === 'unset' ? null : leafInfo(node, selfSt, 1)
    const info = rollupInfo(node, kids)
    if (selfSt !== 'unset') {
      const total = 1 + info.entityCount
      const covered = (selfSt === 'covered' ? 1 : 0) + info.coveredCount
      const partial = (selfSt === 'partial' ? 1 : 0) + info.partialCount
      const gap = (selfSt === 'gap' ? 1 : 0) + info.gapCount
      info.entityCount = total
      info.coveredCount = covered
      info.partialCount = partial
      info.gapCount = gap
      info.status = calcRollupStatus({ covered, partial, gap, unset: total - covered - partial - gap, total })
    }
    return info
  }

  const buildL3 = (node: FrameworkNode): CoverageNodeInfo | null => {
    l3Total.n++
    const mount = mountByCode.get(node.code)
    const kids = (node.children ?? []).map(buildSub).filter(Boolean) as CoverageNodeInfo[]
    if (!mount && !kids.length) {
      gapList.push({ code: node.code, label: node.label, path: pathOf(fw, node.code) })
      counters.unmounted++ // 未挂载且无子活动：只进 gapList，不进树
      return null
    }
    if (!mount) {
      const info = rollupInfo(node, kids)
      classify(info.status)
      return info
    }
    // 有挂载：自身（1 个单元）+ 子树合并
    const selfCovered = mount.hasParts ? 1 : 0
    const selfPartial = mount.hasParts ? 0 : 1
    const total = 1 + kids.reduce((a, c) => a + c.entityCount, 0)
    const covered = selfCovered + kids.reduce((a, c) => a + c.coveredCount, 0)
    const partial = selfPartial + kids.reduce((a, c) => a + c.partialCount, 0)
    const gap = kids.reduce((a, c) => a + c.gapCount, 0)
    const info = leafInfo(node, 'unset', total)
    info.coveredCount = covered
    info.partialCount = partial
    info.gapCount = gap
    info.status = calcRollupStatus({ covered, partial, gap, unset: total - covered - partial - gap, total })
    info.children = kids.length ? kids : undefined
    classify(info.status)
    return info
  }

  // L1/L2 结构容器（不直接参与状态，仅承载子树）
  const tree: CoverageNodeInfo[] = fw.domains.map(domain => {
    const l3Kids = (domain.children ?? []).flatMap(l2 => (l2.children ?? []).map(buildL3)).filter(Boolean) as CoverageNodeInfo[]
    if (!l3Kids.length) return null
    const container = leafInfo(
      { code: domain.code, name: domain.name, label: domain.label, levelId: 'L1' },
      'unset', l3Kids.length,
    )
    container.children = l3Kids
    return container
  }).filter(Boolean) as CoverageNodeInfo[]

  return {
    frameworkId,
    suiteId: suite.meta.suiteId,
    tree,
    l3Total: l3Total.n,
    l3Covered: counters.covered,
    l3Partial: counters.partial,
    l3Unmounted: counters.unmounted,
    mountedFlows: flows.filter(f => f.apqcCode).map(f => ({
      flowId: f.id, name: f.name, apqcCode: f.apqcCode!,
      nodeCount: f.nodes.length,
      participationCount: (f.semantics?.participations ?? []).length,
      updatedAt: f.updatedAt ?? 0,
    })),
    gapList,
  }
}

function leafInfo(node: Pick<FrameworkNode, 'code' | 'name' | 'label'> & { levelId?: string }, status: import('./shared-types.js').CoverageStatus, entityCount: number): CoverageNodeInfo {
  return {
    code: node.code, name: node.name, label: node.label,
    levelId: node.levelId ?? `L${Math.min(Math.max(levelNumOfCode(node.code), 1), 5)}`,
    entityCount, coveredCount: status === 'covered' ? entityCount : 0,
    partialCount: status === 'partial' ? entityCount : 0,
    gapCount: status === 'gap' ? entityCount : 0,
    status, entities: [],
  }
}

function rollupInfo(node: Pick<FrameworkNode, 'code' | 'name' | 'label'> & { levelId?: string }, kids: CoverageNodeInfo[]): CoverageNodeInfo {
  const covered = kids.reduce((a, c) => a + c.coveredCount, 0)
  const partial = kids.reduce((a, c) => a + c.partialCount, 0)
  const gap = kids.reduce((a, c) => a + c.gapCount, 0)
  const total = kids.reduce((a, c) => a + c.entityCount, 0)
  return {
    code: node.code, name: node.name, label: node.label,
    levelId: node.levelId ?? `L${Math.min(Math.max(levelNumOfCode(node.code), 1), 5)}`,
    entityCount: total, coveredCount: covered, partialCount: partial, gapCount: gap,
    status: calcRollupStatus({ covered, partial, gap, unset: total - covered - partial - gap, total }),
    entities: [],
    children: kids,
  }
}

function pathOf(fw: FrameworkDefinition, code: string): string[] {
  const parts = code.split('.')
  const out: string[] = []
  for (let i = 1; i <= parts.length; i++) {
    const c = parts.slice(0, i).join('.')
    const hit = findNodeByCode(fw, c)
    if (hit) out.push(hit?.node?.label ?? '')
  }
  return out
}

export async function deleteFlowchart(id: string): Promise<boolean> {
  const cfg = await getConfig()
  if (!/^[\w-]+$/.test(id)) return false
  const path = join(flowchartsDir(resolveDatastorageRoot(cfg)), `${id}.json`)
  try {
    await unlink(path)
    return true
  } catch { return false }
}

// ─────────────── 访谈记录存取（datastorage/interviews/<suiteId>.json） ───────────────

function interviewsFile(root: string, suiteId: string): string {
  const safe = suiteId.replace(/[^\w.-]/g, '_')
  return join(root, 'interviews', `${safe}.json`)
}

export async function listInterviews(suiteId: string): Promise<InterviewRecord[]> {
  const cfg = await getConfig()
  const data = await readJsonSafe<InterviewRecord[] | null>(interviewsFile(resolveDatastorageRoot(cfg), suiteId), null)
  if (!Array.isArray(data)) return []
  return data.filter(r => r && r.id && r.apqcCode)
}

export async function saveInterview(suiteId: string, input: {
  id?: string; apqcCode: string
  answers: InterviewRecord['answers']
  note?: string
}): Promise<InterviewRecord> {
  const cfg = await getConfig()
  const file = interviewsFile(resolveDatastorageRoot(cfg), suiteId)
  const list = await readJsonSafe<InterviewRecord[]>(file, [])
  const now = Date.now()
  const existing = input.id ? list.find(r => r.id === input.id) : null
  const record: InterviewRecord = {
    id: existing?.id ?? `itv-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    suiteId,
    apqcCode: input.apqcCode,
    answers: input.answers ?? {},
    note: typeof input.note === 'string' && input.note.trim() ? input.note : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const next = existing
    ? list.map(r => (r.id === record.id ? record : r))
    : [...list, record]
  await writeJson(file, next)
  return record
}

export async function deleteInterview(suiteId: string, id: string): Promise<boolean> {
  const cfg = await getConfig()
  const file = interviewsFile(resolveDatastorageRoot(cfg), suiteId)
  const list = await readJsonSafe<InterviewRecord[]>(file, [])
  const next = list.filter(r => r.id !== id)
  if (next.length === list.length) return false
  await writeJson(file, next)
  return true
}

/**
 * 访谈派生关系：hasObject（对象 + op）的记录投影为 ACTIVITY_OPERATES_OBJECT，
 * derivedFrom = interview:<id>。与流程画板同桥，读取时推导、不落库。
 */
export function deriveInterviewRelations(suite: SuiteData, interviews: InterviewRecord[]): OntologyRelation[] {
  const kindOf = new Map(suite.entities.map(e => [e.id, e.kind]))
  const activityByCode = new Map<string, string[]>()
  for (const entityId of Object.keys(suite.annotations.entityFrameMapping || {})) {
    const kind = kindOf.get(entityId)
    if (!kind || mappingAxisOfKind(kind) !== 'process') continue
    for (const [, entry] of allFwEntries(suite.annotations.entityFrameMapping, entityId)) {
      if (!entry.apqcCode) continue
      const list = activityByCode.get(entry.apqcCode) ?? []
      list.push(entityId)
      activityByCode.set(entry.apqcCode, list)
    }
  }

  const out: OntologyRelation[] = []
  for (const itv of interviews) {
    const a = itv.answers?.hasObject
    if (!a?.value || !a.entityId || !a.op) continue
    const actId = activityByCode.get(itv.apqcCode)?.[0]
    if (!actId) continue
    out.push({
      id: `interview-${itv.id}-${a.entityId}-${a.op}`,
      from: actId,
      to: a.entityId,
      type: 'ACTIVITY_OPERATES_OBJECT',
      label: a.op,
      properties: { op: a.op, derivedFrom: `interview:${itv.id}`, nodeId: undefined },
    })
  }
  return out
}

// ─────────────── CRUD 矩阵（实体 × 流程，交付物视图） ───────────────

/**
 * CRUD 矩阵（实体 × 来源，交付物视图）。
 * 数据源 = 派生关系（画板参与 + 访谈投影）而非原始 participations，
 * 保证矩阵与 derived-relations / 覆盖度口径一致：
 * 活动端无法解析的参与不进矩阵（与「不产出关系」规则相同）。
 * 列键为派生来源：flow:<id> | interview:<id>。
 */
export function computeCrudMatrix(suite: SuiteData, flows: FlowchartData[], interviews: InterviewRecord[] = []): CrudMatrix {
  const derived = [...deriveFlowRelations(suite, flows), ...deriveInterviewRelations(suite, interviews)]
  const flowById = new Map(flows.map(f => [f.id, f]))
  const itvById = new Map(interviews.map(i => [i.id, i]))
  const colMap = new Map<string, CrudMatrix['columns'][number]>()
  const rowMap = new Map<string, CrudMatrix['rows'][number]>()
  for (const r of derived) {
    const src = String(r.properties?.derivedFrom ?? '')
    if (!colMap.has(src)) {
      if (src.startsWith('flow:')) {
        const f = flowById.get(src.slice(5))
        if (f) colMap.set(src, { flowId: src, name: f.name, apqcCode: f.apqcCode })
      } else if (src.startsWith('interview:')) {
        const itv = itvById.get(src.slice(10))
        if (itv) colMap.set(src, { flowId: src, name: `访谈 · ${itv.apqcCode}`, apqcCode: itv.apqcCode })
      }
    }
    if (!colMap.has(src)) continue
    const ent = suite.entities.find(e => e.id === r.to)
    if (!ent) continue
    let row = rowMap.get(ent.id)
    if (!row) {
      row = { entityId: ent.id, entityName: ent.name, kind: ent.kind, cells: {}, opCount: 0 }
      rowMap.set(ent.id, row)
    }
    const op = (r.properties?.op as FlowOp) ?? 'read'
    const cell = row.cells[src] ?? []
    if (!cell.includes(op)) cell.push(op)
    row.cells[src] = cell
    row.opCount++
  }
  const cols = [...colMap.values()]
  const flowCols = cols.filter(c => c.flowId.startsWith('flow:'))
    .sort((a, b) => (a.apqcCode ?? '').localeCompare(b.apqcCode ?? '') || a.name.localeCompare(b.name, 'zh'))
  const itvCols = cols.filter(c => c.flowId.startsWith('interview:'))
    .sort((a, b) => (a.apqcCode ?? '').localeCompare(b.apqcCode ?? ''))
  return {
    suiteId: suite.meta.suiteId,
    columns: [...flowCols, ...itvCols],
    rows: [...rowMap.values()].sort((a, b) => a.entityName.localeCompare(b.entityName, 'zh')),
  }
}

// ─────────────── 实体批量导入（P5-1 表证单书清单） ───────────────

export interface BatchEntityInput {
  name: string
  kind?: string
  /** 命中域词典的 L1/L2 编号（客户端建议、人工确认后传入） */
  domain?: string
  /** 是否同时写入 L1/L2 锚定映射 */
  anchor?: boolean
}

/**
 * 批量创建实体（现场单据清单粘贴入库）：
 * - 按名称去重（与现有实体及本批内重复均跳过）
 * - kind 非法时回退 ENTITY；id/rawId 与 datasource 解析格式同构（suiteId:kind:rawId）
 * - anchor=true 且 domain 为该框架 L1/L2 有效编号时，写入 entityFrameMapping（不设置覆盖状态）
 */
export async function createEntitiesBatch(
  suiteId: string,
  items: BatchEntityInput[],
  frameworkId: string,
): Promise<{ created: OntologyEntity[]; anchored: number; skipped: { name: string; reason: string }[] } | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null

  const fw = getBuiltinFramework(frameworkId)
  const validKinds = new Set<string>([
    'AGGREGATE_ROOT', 'ENTITY', 'DATA_DICTIONARY', 'BEHAVIOR', 'RULE', 'ACTOR', 'ROLE', 'PERMISSION',
    'FLOW', 'ACTIVITY', 'REPORT', 'UI_MENU', 'UI_SCREEN',
  ])
  const nameSet = new Set(suite.entities.map(e => e.name))
  const idSet = new Set(suite.entities.map(e => e.id))
  const created: OntologyEntity[] = []
  const skipped: { name: string; reason: string }[] = []
  let anchored = 0
  const now = Date.now()

  for (const item of items) {
    const name = String(item?.name ?? '').trim()
    if (!name) { skipped.push({ name: String(item?.name ?? ''), reason: '空名称' }); continue }
    if (nameSet.has(name)) { skipped.push({ name, reason: '已存在同名实体' }); continue }
    const kind = (item.kind && validKinds.has(item.kind) ? item.kind : 'ENTITY') as EntityKind
    const id = `${suiteId}:${kind}:${name}`
    if (idSet.has(id)) { skipped.push({ name, reason: '已存在（同类型同名）' }); continue }

    const domain = String(item.domain ?? '').trim()
    const ent: OntologyEntity = {
      id, rawId: name, name, kind,
      domain: domain || '未知',
      sourceFile: 'manual:batch',
      properties: { batchImportedAt: now },
    }
    created.push(ent)
    nameSet.add(name)
    idSet.add(id)

    if (item.anchor && domain && fw) {
      const hit = findNodeByCode(fw, domain)
      const lvl = hit ? levelNumOfCode(domain) : 0
      if (hit && lvl >= 1 && lvl <= 2) {
        // 新格式：entityId → { [fwId]: Entry }，保留已有其他框架的条目
        const cur = suite.annotations.entityFrameMapping[id]
        const isNewFmt = cur && typeof cur === 'object' && !('frameworkId' in cur)
        const base = isNewFmt ? cur as Record<string, FrameMappingEntry> : {}
        base[frameworkId] = { apqcCode: domain, note: '批量导入自动锚定', mappedAt: Date.now() }
        suite.annotations.entityFrameMapping[id] = base
        anchored++
      }
    }
  }

  if (created.length) {
    suite.entities.push(...created)
    suite.meta.entityCount = suite.entities.length
    await saveSuite(suiteId, suite)
  }
  return { created, anchored, skipped }
}

// ─────────────── 访谈 → 画板草稿（P5-2） ───────────────

/**
 * 将套件访谈记录一键生成为画板草稿（独立成图，不并入已有流程）：
 * - 每条有效访谈 → 一个 task 节点（code = apqcCode，label = 框架节点名），纵列自动排布
 * - 语义预填：activities.roleRef ← 四问①；guardRules ← 四问③；participations ← 四问②
 * - 冲突跳过：L3 编号已被挂载流程占用、清单内重复编号
 */
export async function buildFlowDraftFromInterviews(
  suiteId: string,
  frameworkId: string,
  interviewIds?: string[],
): Promise<{ draft: FlowchartData; skipped: { code: string; reason: string }[] } | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const fw = getBuiltinFramework(frameworkId)
  const all = await listInterviews(suiteId)
  const wanted = interviewIds && interviewIds.length ? new Set(interviewIds) : null
  const interviews = all.filter(r => !wanted || wanted.has(r.id))
  const flows = await listFlowchartsForSuite(suiteId)
  const mountedL3 = new Set(flows.filter(f => f.apqcCode && levelNumOfCode(f.apqcCode) === 3).map(f => f.apqcCode!))

  const skipped: { code: string; reason: string }[] = []
  const usedCodes = new Set<string>()
  const nodes: FlowchartData['nodes'] = []
  const edges: FlowchartData['edges'] = []
  const activities: NonNullable<FlowchartData['semantics']>['activities'] = {}
  const participations: NonNullable<FlowchartData['semantics']>['participations'] = []

  for (const itv of interviews) {
    const code = itv.apqcCode
    if (usedCodes.has(code)) { skipped.push({ code, reason: '草稿内编号重复' }); continue }
    if (levelNumOfCode(code) === 3 && mountedL3.has(code)) { skipped.push({ code, reason: '该 L3 已有挂载流程' }); continue }
    usedCodes.add(code)

    const hit = fw ? findNodeByCode(fw, code) : null
    const nodeId = `n-${code.replace(/\./g, '-')}`
    nodes.push({
      id: nodeId, type: 'task', code,
      label: hit?.node?.label ?? code,
      x: 220, y: 80 + nodes.length * 96,
    })
    const a = itv.answers ?? {}
    const act: typeof activities[string] = {}
    if (a.hasRole?.value && a.hasRole.roleRef) act.roleRef = a.hasRole.roleRef
    if (a.hasRule?.value && a.hasRule.ruleRef) act.guardRules = [a.hasRule.ruleRef]
    if (a.hasBehavior?.value && a.hasBehavior.behaviorRef) act.behaviorRefs = [a.hasBehavior.behaviorRef]
    if (Object.keys(act).length) activities[nodeId] = act
    if (a.hasObject?.value && a.hasObject.entityId && a.hasObject.op) {
      participations.push({ nodeId, entityId: a.hasObject.entityId, op: a.hasObject.op })
    }
  }

  if (!nodes.length) {
    // 无有效访谈也可返回（前端提示）；仍生成仅含开始/结束的空草稿没有意义
    return { draft: null as unknown as FlowchartData, skipped }
  }

  // 纵列链：start → tasks → end
  nodes.unshift({ id: 'n-start', type: 'start', label: '开始', x: 220, y: 16 })
  nodes.push({ id: 'n-end', type: 'end', label: '结束', x: 220, y: 80 + nodes.length * 96 })
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `e-${i}`, source: nodes[i].id, target: nodes[i + 1].id })
  }

  const now = Date.now()
  const draft = await saveFlowchart({
    name: `访谈草稿 · ${new Date(now).toLocaleDateString('zh-CN')} · ${nodes.length - 2} 活动`,
    suiteId,
    nodes, edges,
    semantics: { activities, participations },
  })
  return { draft, skipped }
}

// ─────────────── 框架查询 ───────────────

export async function listFrameworks(): Promise<ReturnType<typeof listBuiltinFrameworks>> {
  return listBuiltinFrameworks()
}

// ─────────────── 用户自定义框架（P4-3） ───────────────

const BUILTIN_FW_IDS = new Set(['apqc-process', 'hw-style-pcf'])

function userFrameworksDir(root: string): string {
  return join(root, 'frameworks')
}

/**
 * 启动扫描：datastorage/frameworks/*.json → 校验通过则注册进运行时注册表。
 * 与内置框架同 ID 的文件视为「内置框架项目级定制」（流程地图编辑落盘），注册后遮蔽内置定义；
 * 校验失败的文件跳过（console.warn），不阻塞启动。
 */
export async function loadUserFrameworksIntoRegistry(): Promise<string[]> {
  const cfg = await getConfig()
  const dir = userFrameworksDir(resolveDatastorageRoot(cfg))
  let entries: string[]
  try { entries = await readdir(dir) } catch { return [] }
  const loaded: string[] = []
  for (const f of entries.filter(e => e.endsWith('.json'))) {
    try {
      const fw = await readJsonSafe<unknown>(join(dir, f), null)
      const fwId = (fw as { frameworkId?: string })?.frameworkId
      if (typeof fwId === 'string' && BUILTIN_FW_IDS.has(fwId)) {
        console.warn(`[dsh-ontology] builtin framework override loaded: ${f} → ${fwId}（遮蔽内置定义）`)
      }
      const { errors, stats } = validateFrameworkDefinition(fw)
      if (errors.length) {
        console.warn(`[dsh-ontology] user framework ${f} invalid, skipped: ${errors.slice(0, 5).join('；')}`)
        continue
      }
      registerFramework(fw as FrameworkDefinition)
      loaded.push(fwId!)
      console.log(`[dsh-ontology] user framework registered: ${fwId}（${stats.domains} L1 / ${stats.nodes} 节点）`)
    } catch (err) {
      console.warn(`[dsh-ontology] user framework ${f} load failed:`, err)
    }
  }
  return loaded
}

/** 用户框架落盘：datastorage/frameworks/<frameworkId>.json（重启后由启动扫描重新注册） */
export async function saveUserFramework(fw: FrameworkDefinition): Promise<void> {
  const cfg = await getConfig()
  const dir = userFrameworksDir(resolveDatastorageRoot(cfg))
  await ensureDir(dir)
  await writeFile(join(dir, `${fw.frameworkId}.json`), JSON.stringify(fw, null, 2), 'utf-8')
}

// ─────────────── 现场交付物导出（P5-3） ───────────────

export type ExportKind = 'minutes' | 'crud' | 'gap' | 'domain'

export interface ExportPayload { filename: string; mime: string; content: string }

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(rows: unknown[][]): string {
  // BOM：保证 Excel 直接打开中文不乱码
  return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')
}

function fmtTs(ts: number): string {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return String(ts) }
}

function safeFileId(suiteId: string): string {
  return suiteId.replace(/[^\w.-]/g, '_')
}

/** 访谈答案 → 纪要文案（「客户未提」明确标注为 gap，与「未问」区分） */
function answerLine(a: InterviewRecord['answers']['hasRole'] | undefined, refKey: 'roleRef' | 'entityId' | 'ruleRef' | 'behaviorRef', entityName?: string): string {
  if (!a) return '— 未回答'
  if (!a.value) return '⚠️ 客户未提（gap）'
  const ref = refKey === 'entityId'
    ? `${entityName ?? a.entityId ?? ''}${a.op ? ` × ${a.op}` : ''}`
    : (a as { [k in typeof refKey]?: string })[refKey]
  return ref ? `✅ ${ref}` : '✅ 是（未细化）'
}

export async function buildExport(suiteId: string, kind: ExportKind, frameworkId: string): Promise<ExportPayload | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const fw = getBuiltinFramework(frameworkId)
  const now = fmtTs(Date.now())

  if (kind === 'minutes') {
    const interviews = (await listInterviews(suiteId)).slice().sort((a, b) => a.apqcCode.localeCompare(b.apqcCode, undefined, { numeric: true }))
    const entName = (id?: string) => suite.entities.find(e => e.id === id)?.name ?? id
    const sections = interviews.map(itv => {
      const hit = fw ? findNodeByCode(fw, itv.apqcCode) : null
      const pathStr = (hit?.path ?? []).map(p => p.label).join(' › ')
      const a = itv.answers ?? {}
      const lines = [
        `## ${itv.apqcCode} ${hit?.node?.label ?? ''}`,
        pathStr ? `> 路径：${pathStr} · 记录时间：${fmtTs(itv.updatedAt)}` : `> 记录时间：${fmtTs(itv.updatedAt)}`,
        '',
        `- ① 谁做：${answerLine(a.hasRole, 'roleRef')}`,
        `- ② 动哪些单据：${answerLine(a.hasObject, 'entityId', entName(a.hasObject?.entityId))}`,
        `- ③ 什么规矩：${answerLine(a.hasRule, 'ruleRef')}`,
        `- ④ 怎么处理：${answerLine(a.hasBehavior, 'behaviorRef')}`,
      ]
      if (itv.note) lines.push(`- 备注：${itv.note}`)
      return lines.join('\n')
    })

    // 未访谈 L3 清单（现场跟进入口）
    const interviewed = new Set(interviews.map(i => i.apqcCode))
    const allL3: string[] = []
    if (fw) {
      const walk = (n: FrameworkNode): void => {
        if (levelNumOfCode(n.code) === 3) { allL3.push(n.code); return }
        for (const c of n.children ?? []) walk(c)
      }
      for (const d of fw.domains) for (const l2 of d.children) for (const l3 of (l2.children ?? [])) walk(l3)
    }
    const unvisited = allL3.filter(c => !interviewed.has(c))
    const tail = unvisited.length
      ? `\n\n---\n\n## 未访谈 L3 节点（${unvisited.length}/${allL3.length}）\n\n${unvisited.slice(0, 100).join('、')}${unvisited.length > 100 ? ' …' : ''}`
      : ''

    const md = [
      `# 访谈纪要 · ${suiteId}`,
      '',
      `- 框架：${fw?.name ?? frameworkId}（${frameworkId}）`,
      `- 生成时间：${now}`,
      `- 访谈记录：${interviews.length} 条`,
      '',
      ...sections,
    ].join('\n') + tail
    return { filename: `${safeFileId(suiteId)}-minutes.md`, mime: 'text/markdown; charset=utf-8', content: md }
  }

  if (kind === 'crud') {
    const flows = await listFlowchartsForSuite(suiteId)
    const interviews = await listInterviews(suiteId)
    const m = computeCrudMatrix(suite, flows, interviews)
    const header = ['实体名称', '类型', ...m.columns.map(c => `${c.name}${c.apqcCode ? ` [${c.apqcCode}]` : ''}`)]
    const rows = m.rows.map(r => [
      r.entityName, r.kind,
      ...m.columns.map(c => (r.cells[c.flowId] ?? []).join('/')),
    ])
    return {
      filename: `${safeFileId(suiteId)}-crud.csv`,
      mime: 'text/csv; charset=utf-8',
      content: csv([header, ...rows]),
    }
  }

  if (kind === 'gap') {
    const flows = await listFlowchartsForSuite(suiteId)
    const interviews = await listInterviews(suiteId)
    const cov = computeCoverage(suite, frameworkId)
    const proc = computeProcessCoverage(suite, flows, frameworkId, interviews)
    const rows: unknown[][] = [['类别', '编号', '名称/实体', '说明']]
    for (const g of proc.gapList) rows.push(['流程缺口', g.code, g.label, (g.path ?? []).join(' > ')])
    for (const v of cov.violatedMappings ?? []) rows.push(['违规映射', v.apqcCode, v.entityName, `${v.kind}: ${v.reason}`])
    return {
      filename: `${safeFileId(suiteId)}-gap.csv`,
      mime: 'text/csv; charset=utf-8',
      content: csv(rows),
    }
  }

  // domain：L1/L2 × 实体状态（名词轴）
  const domainKinds = new Set(['AGGREGATE_ROOT', 'ENTITY', 'DATA_DICTIONARY', 'RULE', 'ACTOR', 'ROLE', 'REPORT'])
  const rows: unknown[][] = [['实体名称', '类型', '锚定编号', '锚定节点', '覆盖状态', '备注']]
  const ents = suite.entities.filter(e => domainKinds.has(e.kind)).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  for (const e of ents) {
    const fm = suite.annotations.entityFrameMapping[e.id] as Record<string, FrameMappingEntry> | FrameMappingOld
    const entry = fm && !('frameworkId' in fm) ? (fm as Record<string, FrameMappingEntry>)[frameworkId] : (fm as FrameMappingOld)?.frameworkId === frameworkId ? (fm as FrameMappingOld) : undefined
    const code = entry?.apqcCode
    const mark = suite.annotations.coverageMarks[e.id]
    const hit = code && fw ? findNodeByCode(fw, code) : null
    rows.push([
      e.name, e.kind, code ?? '', hit?.label ?? (code ? '（编号不在框架中）' : ''),
      mark?.status ?? 'unset',
      entry?.note ?? mark?.note ?? '',
    ])
  }
  return {
    filename: `${safeFileId(suiteId)}-domain.csv`,
    mime: 'text/csv; charset=utf-8',
    content: csv(rows),
  }
}

// ─────────────── 套件现场数据包（P5-4） ───────────────

const PACKAGE_SCHEMA = 'dsh-ontology-suite-package'
const PACKAGE_VERSION = 1

/**
 * 导出套件现场数据包：单文件 JSON（meta + 实体 + 关系 + 标注 + 访谈 + 流程图）。
 * 用途：现场电脑 A → 家里电脑 B 的整包迁移；配合导入可完整还原工作现场。
 */
export async function exportPackage(suiteId: string): Promise<{ filename: string; content: string } | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const [interviews, flows] = await Promise.all([
    listInterviews(suiteId),
    listFlowchartsForSuite(suiteId),
  ])
  const pkg = {
    schema: PACKAGE_SCHEMA,
    version: PACKAGE_VERSION,
    exportedAt: Date.now(),
    suite: {
      meta: suite.meta,
      entities: suite.entities,
      relations: suite.relations,
      annotations: suite.annotations,
    },
    interviews,
    flowcharts: flows,
  }
  return { filename: `${safeFileId(suiteId)}.dshont.json`, content: JSON.stringify(pkg, null, 2) }
}

export interface PackageImportResult {
  suiteId: string
  entities: number
  relations: number
  interviews: number
  flowcharts: number
}

/**
 * 导入现场数据包：按 meta.suiteId 整体覆盖。
 * - 套件四文件（meta/entities/relations/annotations）直接覆盖
 * - 访谈清单整体覆盖
 * - 流程图：写入包内全部；删除本地属于该套件但包内没有的（保证两端一致）
 */
export async function importPackage(input: unknown): Promise<PackageImportResult | null> {
  const p = input as {
    schema?: string
    suite?: Record<string, unknown>
    interviews?: unknown
    flowcharts?: unknown
  } | null
  if (!p || typeof p !== 'object' || p.schema !== PACKAGE_SCHEMA) return null
  const s = p.suite as {
    meta?: { suiteId?: string }; entities?: unknown; relations?: unknown; annotations?: unknown
  } | undefined
  const suiteId = s?.meta?.suiteId
  if (!s || typeof suiteId !== 'string' || !suiteId.trim() || !Array.isArray(s.entities)) return null

  await saveSuite(suiteId, {
    meta: s.meta as OntologySuiteMeta,
    entities: s.entities as OntologyEntity[],
    relations: (Array.isArray(s.relations) ? s.relations : []) as OntologyRelation[],
    annotations: (s.annotations ?? { entityFrameMapping: {}, coverageMarks: {}, customRelations: [] }) as OntologyAnnotations,
  })

  const root = resolveDatastorageRoot(await getConfig())

  // 访谈：整体覆盖
  const interviews = (Array.isArray(p.interviews) ? p.interviews : [])
    .filter((r: any): r is InterviewRecord => r && typeof r.id === 'string' && typeof r.apqcCode === 'string')
  await writeJson(interviewsFile(root, suiteId), interviews)

  // 流程图：包内全部写入（保留原 id/createdAt），本地多余的删除
  const pkgFlows = (Array.isArray(p.flowcharts) ? p.flowcharts : [])
    .filter(isFlowchartData)
    .filter(f => /^[\w-]+$/.test(f.id))
  const dir = flowchartsDir(root)
  for (const f of pkgFlows) await writeJson(join(dir, `${f.id}.json`), f)
  const pkgIds = new Set(pkgFlows.map(f => f.id))
  for (const local of await listFlowchartsForSuite(suiteId)) {
    if (!pkgIds.has(local.id)) await deleteFlowchart(local.id)
  }

  return {
    suiteId,
    entities: (s.entities as unknown[]).length,
    relations: (Array.isArray(s.relations) ? s.relations : []).length,
    interviews: interviews.length,
    flowcharts: pkgFlows.length,
  }
}