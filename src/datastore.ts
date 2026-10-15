import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  SuiteData, OntologySuiteMeta, OntologyAnnotations, OntologyEntity, OntologyRelation,
  GraphData, GraphNode, GraphEdge, CoverageMatrix, CoverageCell, CoverageNodeInfo,
  DatastorageConfig, FrameworkDefinition, FrameworkNode, FrameworkDomain, FrameworkLevel,
  FlowchartData, FlowchartMeta,
} from './shared-types.js'
import { discoverSuites, parseSuite, resolveDatasourceRoot as resolveDatasourceRootAsync } from './ontology-parser.js'
import { getBuiltinFramework, parseApqcCode, listBuiltinFrameworks } from './builtin-frameworks.js'

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
      datastoragePath: 'src/datastorage',
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

export async function listImportedSuites(): Promise<OntologySuiteMeta[]> {
  const cfg = await getConfig()
  const storageRoot = join(projRoot(), cfg.datastoragePath)
  const suitesDir = join(storageRoot, 'ontologies')
  let entries: string[]
  try { entries = await readdir(suitesDir) } catch { return [] }

  const metas: OntologySuiteMeta[] = []
  for (const e of entries) {
    const metaPath = join(suitesDir, e, 'meta.json')
    const meta = await readJsonSafe<OntologySuiteMeta | null>(metaPath, null)
    if (meta) metas.push(meta)
  }
  return metas.sort((a, b) => b.importTime - a.importTime)
}

export async function loadSuite(suiteId: string): Promise<SuiteData | null> {
  const cfg = await getConfig()
  const storageRoot = join(projRoot(), cfg.datastoragePath)
  const dir = suiteDir(storageRoot, suiteId)

  const meta = await readJsonSafe<OntologySuiteMeta | null>(join(dir, 'meta.json'), null)
  if (!meta) return null

  const entities = await readJsonSafe<OntologyEntity[]>(join(dir, 'entities.json'), [])
  const relations = await readJsonSafe<OntologyRelation[]>(join(dir, 'relations.json'), [])
  const annotations = await readJsonSafe<OntologyAnnotations>(join(dir, 'annotations.json'), {
    entityFrameMapping: {}, coverageMarks: {}, customRelations: [],
  })

  return { entities, relations, meta, annotations }
}

export async function saveSuite(suiteId: string, data: SuiteData): Promise<void> {
  const cfg = await getConfig()
  const storageRoot = join(projRoot(), cfg.datastoragePath)
  const dir = suiteDir(storageRoot, suiteId)
  await writeJson(join(dir, 'meta.json'), data.meta)
  await writeJson(join(dir, 'entities.json'), data.entities)
  await writeJson(join(dir, 'relations.json'), data.relations)
  await writeJson(join(dir, 'annotations.json'), data.annotations)
}

export async function saveAnnotations(suiteId: string, annotations: OntologyAnnotations): Promise<void> {
  const cfg = await getConfig()
  const storageRoot = join(projRoot(), cfg.datastoragePath)
  await writeJson(join(suiteDir(storageRoot, suiteId), 'annotations.json'), annotations)
}

// ─────────────── Import (datasource → datastorage) ───────────────

export async function importFromDatasource(force = false): Promise<{ updated: string[]; skipped: string[] }> {
  const cfg = await getConfig()
  const storageRoot = join(projRoot(), cfg.datastoragePath)
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

import { collectLeafNodes, findNodeByCode } from './builtin-frameworks.js'

function calcRollupStatus(counts: { covered: number; partial: number; gap: number; unset: number; total: number }): import('./shared-types.js').CoverageStatus {
  if (counts.covered === counts.total && counts.total > 0) return 'covered'
  if (counts.covered > 0 && counts.gap === 0) return 'partial'
  if (counts.gap > 0 && counts.covered === 0 && counts.partial === 0) return 'gap'
  if (counts.total === 0) return 'unset'
  return 'partial'
}

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
    }
  }

  const nodeEntityMap = new Map<string, { entityId: string; status: import('./shared-types.js').CoverageStatus }[]>()

  for (const [entityId, frameMapping] of Object.entries(suite.annotations.entityFrameMapping)) {
    if (frameMapping.frameworkId !== frameworkId || !frameMapping.apqcCode) continue
    const entity = suite.entities.find(e => e.id === entityId)
    if (!entity) continue
    const mark = suite.annotations.coverageMarks[entityId]
    const status = mark?.status ?? 'unset'

    const allAncestorCodes = collectAncestorCodes(fw, frameMapping.apqcCode)
    for (const code of allAncestorCodes) {
      const list = nodeEntityMap.get(code) ?? []
      list.push({ entityId, status })
      nodeEntityMap.set(code, list)
    }
  }

  const tree: CoverageNodeInfo[] = fw.domains.map(domain => buildCoverageForNode(
    { code: domain.code, name: domain.name, label: domain.label, levelId: 'L1', pcfId: domain.pcfId, definition: domain.definition, children: domain.children },
    nodeEntityMap,
  ))

  const cells = computeLevelAggregation(fw, nodeEntityMap)

  const leafStats = computeLeafStats(fw, nodeEntityMap)

  return {
    frameworkId,
    suiteId: suite.meta.suiteId,
    domains: fw.domains,
    levels: fw.levels,
    cells,
    totalEntities: suite.entities.length,
    leafTotal: leafStats.total,
    leafCovered: leafStats.covered,
    leafPartial: leafStats.partial,
    leafGap: leafStats.gap,
    leafUnset: leafStats.unset,
    tree,
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
  for (const anc of info.path) {
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

function computeLeafStats(
  fw: FrameworkDefinition,
  nodeEntityMap: Map<string, { entityId: string; status: import('./shared-types.js').CoverageStatus }[]>,
): { total: number; covered: number; partial: number; gap: number; unset: number } {
  const leaves = collectLeafNodes(fw)
  let covered = 0, partial = 0, gap = 0, unset = 0
  for (const leaf of leaves) {
    const list = nodeEntityMap.get(leaf.code) ?? []
    if (list.length === 0) { unset++; continue }
    const hasCovered = list.some(e => e.status === 'covered')
    const hasGap = list.some(e => e.status === 'gap')
    const hasPartial = list.some(e => e.status === 'partial')
    if (hasCovered && !hasGap && !hasPartial) covered++
    else if (hasGap) gap++
    else if (hasPartial) partial++
    else unset++
  }
  return { total: leaves.length, covered, partial, gap, unset }
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
  const dir = flowchartsDir(join(projRoot(), cfg.datastoragePath))
  let entries: string[]
  try { entries = (await readdir(dir)).filter(f => f.endsWith('.json')) } catch { return [] }

  const metas: FlowchartMeta[] = []
  for (const f of entries) {
    const data = await readJsonSafe<FlowchartData | null>(join(dir, f), null)
    if (!isFlowchartData(data)) continue
    metas.push({
      id: data.id, name: data.name,
      nodeCount: data.nodes.length, edgeCount: data.edges.length,
      createdAt: data.createdAt ?? 0, updatedAt: data.updatedAt ?? 0,
    })
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getFlowchart(id: string): Promise<FlowchartData | null> {
  const cfg = await getConfig()
  // id 仅允许字母数字下划线连字符，防止路径穿越
  if (!/^[\w-]+$/.test(id)) return null
  const dir = flowchartsDir(join(projRoot(), cfg.datastoragePath))
  const data = await readJsonSafe<FlowchartData | null>(join(dir, `${id}.json`), null)
  return isFlowchartData(data) ? data : null
}

export async function saveFlowchart(input: { id?: string; name: string; nodes: FlowchartData['nodes']; edges: FlowchartData['edges'] }): Promise<FlowchartData> {
  const cfg = await getConfig()
  const dir = flowchartsDir(join(projRoot(), cfg.datastoragePath))
  const existing = input.id ? await getFlowchart(input.id) : null
  const now = Date.now()
  const data: FlowchartData = {
    id: existing?.id ?? `flow-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    nodes: input.nodes,
    edges: input.edges,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await writeJson(join(dir, `${data.id}.json`), data)
  return data
}

export async function deleteFlowchart(id: string): Promise<boolean> {
  const cfg = await getConfig()
  if (!/^[\w-]+$/.test(id)) return false
  const path = join(flowchartsDir(join(projRoot(), cfg.datastoragePath)), `${id}.json`)
  try {
    await unlink(path)
    return true
  } catch { return false }
}

// ─────────────── 框架查询 ───────────────

export async function listFrameworks(): Promise<ReturnType<typeof listBuiltinFrameworks>> {
  return listBuiltinFrameworks()
}