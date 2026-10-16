import { APQC_PCF_V721 } from './frameworks/apqc-pcf.js'
import { HW_STYLE_PCF } from './frameworks/hw-style-pcf.js'
import type { DomainDictionary, FrameworkDefinition, FrameworkDomain, FrameworkLeafNode, FrameworkNode } from './shared-types.js'

export const BUILTIN_FRAMEWORKS: Record<string, FrameworkDefinition> = {
  'hw-style-pcf': HW_STYLE_PCF,
  'apqc-process': APQC_PCF_V721,
}

/** 新导入套件的缺省框架（项目级锁定；旧套件无 frameworkId 仍按 apqc-process 兼容） */
export const DEFAULT_NEW_SUITE_FW = 'hw-style-pcf'

/** 旧套件（meta.frameworkId 缺失）的兼容缺省框架 */
export const LEGACY_DEFAULT_FW = 'apqc-process'

/**
 * 域词典（P1 只读）：从内置框架的 L1/L2 自动生成受控词表。
 * P2 起在 entries 上叠加客户化别名（持久化到 datastorage/dictionary.json）。
 */
export function buildDomainDictionary(frameworkId: string): DomainDictionary {
  const fw = getBuiltinFramework(frameworkId)
  if (!fw) return { frameworkId, entries: [], updatedAt: Date.now() }
  const entries: DomainDictionary['entries'] = []
  for (const domain of fw.domains) {
    entries.push({ code: domain.code, label: domain.label, level: 'L1' })
    for (const child of domain.children ?? []) {
      entries.push({ code: child.code, label: child.label, level: 'L2', parentCode: domain.code })
    }
  }
  return { frameworkId, entries, updatedAt: Date.now() }
}

export function deriveOntologyCode(apqcCode: string): string {
  const parts = apqcCode.split('.').map(s => s.trim()).filter(Boolean)
  while (parts.length < 3) parts.push('0')
  const key = parts.slice(0, 3).join('-')
  return `ONT-${key}`
}

export function deriveApqcCode(ontologyCode: string): string | null {
  const m = ontologyCode.match(/^ONT-(\d+)-(\d+)-(\d+)/i)
  if (!m) return null
  return `${m[1]}.${m[2]}.${m[3]}`
}

export function parseApqcCode(
  apqcCode: string,
): { domainCode: string; levelId: string; segments: string[] } | null {
  const parts = apqcCode.split('.').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0 || parts.some(p => !/^\d+$/.test(p))) return null

  const l1 = parts[0]
  const domainCode = `${l1}.0`

  let levelId: string
  if (parts.length >= 5) levelId = 'L5'
  else if (parts.length === 4) levelId = 'L4'
  else if (parts.length === 3) levelId = 'L3'
  else if (parts.length === 2) levelId = 'L2'
  else levelId = 'L1'

  return { domainCode, levelId, segments: parts }
}

export function getBuiltinFramework(frameworkId: string): FrameworkDefinition | null {
  return BUILTIN_FRAMEWORKS[frameworkId] ?? null
}

export function listBuiltinFrameworks(): FrameworkDefinition[] {
  return Object.values(BUILTIN_FRAMEWORKS)
}

// ─────────────── 用户自定义框架注册表（P4-3） ───────────────

/** 注册用户框架（server 启动扫描 datastorage/frameworks/ 与导入 API 后调用） */
export function registerFramework(fw: FrameworkDefinition): void {
  BUILTIN_FRAMEWORKS[fw.frameworkId] = fw
}

/** 注销用户框架（内置框架不可注销） */
export function unregisterFramework(frameworkId: string): boolean {
  if (BUILTIN_FRAMEWORKS[frameworkId] && (frameworkId === 'apqc-process' || frameworkId === 'hw-style-pcf')) return false
  return delete BUILTIN_FRAMEWORKS[frameworkId]
}

export interface FrameworkValidationResult {
  errors: string[]
  stats: { domains: number; nodes: number; maxDepth: number }
}

/**
 * 框架 JSON 校验（P4-3 导入门槛 / 编辑落盘）：
 * - 结构完整：frameworkId / name / levels / domains
 * - 编号数字点分且全树唯一；L1 允许 1 或 1.0 两种形式（与内置框架 N.0 约定一致）
 * - 层级连续：子节点编号 = 父节点子前缀 + 一段（L1 为 1.0 形式时子前缀去掉 .0，如 1.0 → 1.1 → 1.1.1）
 * - levelId 与层级对应，levels order = 1..n
 */
export function validateFrameworkDefinition(input: unknown): FrameworkValidationResult {
  const errors: string[] = []
  const stats = { domains: 0, nodes: 0, maxDepth: 0 }
  if (!input || typeof input !== 'object') {
    return { errors: ['不是合法的框架定义对象'], stats }
  }
  const fw = input as Partial<FrameworkDefinition>
  if (typeof fw.frameworkId !== 'string' || !/^[A-Za-z][\w-]{1,63}$/.test(fw.frameworkId)) {
    errors.push('frameworkId 缺失或非法（字母开头，允许字母数字下划线连字符，≤64 字符）')
  }
  if (typeof fw.name !== 'string' || !fw.name.trim()) errors.push('name 缺失')
  if (!Array.isArray(fw.levels) || fw.levels.length === 0) errors.push('levels 缺失（至少定义 L1）')
  if (!Array.isArray(fw.domains) || fw.domains.length === 0) errors.push('domains 缺失（至少一个 L1 类别）')
  if (errors.length) return { errors, stats }

  const levelIds = new Set<string>((fw.levels as FrameworkDefinition['levels']).map(l => l?.id))
  const seen = new Set<string>()
  const isDotted = (c: unknown): c is string => typeof c === 'string' && /^\d+(\.\d+)*$/.test(c)
  /** 子节点编号前缀：L1 为 N.0 形式时前缀为 N，其余为编号本身 */
  const childPrefixOf = (code: string, depth: number): string =>
    depth === 1 && code.endsWith('.0') ? code.slice(0, -2) : code

  const walk = (node: any, parentPrefix: string, depth: number, path: string): void => {
    stats.nodes++
    stats.maxDepth = Math.max(stats.maxDepth, depth)
    const where = path || node?.code || '?'
    if (!isDotted(node?.code)) { errors.push(`${where}: 编号「${String(node?.code)}」不是数字点分格式`); return }
    if (seen.has(node.code)) errors.push(`${where}: 编号「${node.code}」全树重复`)
    seen.add(node.code)
    if (depth > 1) {
      const segs = node.code.split('.').length
      const ok = node.code.startsWith(parentPrefix + '.') && segs === parentPrefix.split('.').length + 1
      if (!ok) errors.push(`${where}: 编号层级不连续（应为父节点编号 + 一段）`)
    }
    if (typeof node.levelId !== 'string' || !levelIds.has(node.levelId)) {
      errors.push(`${where}: levelId「${String(node?.levelId)}」未在 levels 中定义`)
    }
    if (typeof node.label !== 'string' || !node.label.trim()) errors.push(`${where}: label 缺失`)
    const kids = Array.isArray(node.children) ? node.children : []
    for (const k of kids) walk(k, childPrefixOf(node.code, depth), depth + 1, `${where} › ${k?.code ?? '?'}`)
  }

  for (const d of fw.domains as FrameworkDefinition['domains']) {
    stats.domains++
    if (!isDotted(d?.code)) { errors.push(`L1「${String(d?.code)}」编号不是数字点分格式`); continue }
    if (seen.has(d.code)) errors.push(`L1 编号「${d.code}」全树重复`)
    seen.add(d.code)
    const segs = d.code.split('.').length
    const l1Ok = segs === 1 || (segs === 2 && d.code.endsWith('.0'))
    if (!l1Ok) errors.push(`L1「${d.code}」编号应为 1 或 1.0 形式`)
    stats.nodes++
    stats.maxDepth = Math.max(stats.maxDepth, 1)
    if (typeof d.label !== 'string' || !d.label.trim()) errors.push(`L1「${d.code}」label 缺失`)
    for (const k of (Array.isArray(d.children) ? d.children : [])) walk(k, childPrefixOf(d.code, 1), 2, `${d.code} › ${k?.code ?? '?'}`)
  }

  // levels 与最大深度的对应性检查（L1..Ln 顺序 = 深度）
  const ordered = (fw.levels as FrameworkDefinition['levels']).slice().sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
  ordered.forEach((l, i) => {
    if (l && l.order !== i + 1) errors.push(`levels[${i}]（${l.id}）order 应为 ${i + 1}`)
  })
  if (stats.maxDepth > ordered.length) errors.push(`树最大深度 ${stats.maxDepth} 超过 levels 定义数 ${ordered.length}`)

  return { errors: [...new Set(errors)].slice(0, 30), stats }
}

// ──────────────────────────────────────────────────────────────────────
// Framework tree navigation utilities
// ──────────────────────────────────────────────────────────────────────

export function flattenNodes(framework: FrameworkDefinition): FrameworkNode[] {
  const all: FrameworkNode[] = []
  for (const domain of framework.domains) {
    const l1: FrameworkNode = {
      code: domain.code,
      name: domain.name,
      label: domain.label,
      levelId: 'L1',
      pcfId: domain.pcfId,
      definition: domain.definition,
      children: domain.children,
    }
    all.push(l1)
    collectChildren(l1, all)
  }
  return all
}

function collectChildren(node: FrameworkNode, bucket: FrameworkNode[]): void {
  if (!node.children) return
  for (const child of node.children) {
    bucket.push(child)
    collectChildren(child, bucket)
  }
}

export function collectLeafNodes(framework: FrameworkDefinition): FrameworkLeafNode[] {
  const leaves: FrameworkLeafNode[] = []
  for (const domain of framework.domains) {
    collectLeavesFromDomain(domain, [], [], leaves)
  }
  return leaves
}

function collectLeavesFromDomain(
  domain: FrameworkDomain,
  pathCodes: string[],
  pathLabels: string[],
  bucket: FrameworkLeafNode[],
): void {
  const l1Code = domain.code
  const l1Label = domain.label
  for (const l2 of domain.children) {
    walkNode(l2, [l1Code], [l1Label], domain, bucket)
  }
}

function walkNode(
  node: FrameworkNode,
  parentCodes: string[],
  parentLabels: string[],
  domain: FrameworkDomain,
  bucket: FrameworkLeafNode[],
): void {
  const codes = [...parentCodes, node.code]
  const labels = [...parentLabels, node.label]
  if (!node.children || node.children.length === 0) {
    bucket.push({
      code: node.code,
      name: node.name,
      label: node.label,
      levelId: node.levelId,
      path: codes,
      pathLabels: labels,
      domainCode: domain.code,
      domainId: domain.id,
    })
  } else {
    for (const child of node.children) {
      walkNode(child, codes, labels, domain, bucket)
    }
  }
}

export function findNodeByCode(
  framework: FrameworkDefinition,
  code: string,
): { node: FrameworkNode; path: FrameworkNode[] } | null {
  for (const domain of framework.domains) {
    if (domain.code === code) {
      return {
        node: { code: domain.code, name: domain.name, label: domain.label, levelId: 'L1', pcfId: domain.pcfId, definition: domain.definition, children: domain.children },
        path: [],
      }
    }
    const result = searchChildren(domain.children, code, [])
    if (result) return result
  }
  return null
}

function searchChildren(
  nodes: FrameworkNode[],
  code: string,
  parentPath: FrameworkNode[],
): { node: FrameworkNode; path: FrameworkNode[] } | null {
  for (const n of nodes) {
    if (n.code === code) {
      return { node: n, path: parentPath }
    }
    if (n.children) {
      const r = searchChildren(n.children, code, [...parentPath, n])
      if (r) return r
    }
  }
  return null
}

export function countNodesByLevel(framework: FrameworkDefinition): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const lvl of framework.levels) counts[lvl.id] = 0
  counts['L1'] = framework.domains.length
  for (const domain of framework.domains) {
    countChildren(domain.children, counts)
  }
  return counts
}

function countChildren(nodes: FrameworkNode[], counts: Record<string, number>): void {
  for (const n of nodes) {
    counts[n.levelId] = (counts[n.levelId] ?? 0) + 1
    if (n.children) countChildren(n.children, counts)
  }
}

export function getFrameworkStats(framework: FrameworkDefinition): {
  totalNodes: number
  totalLeaves: number
  nodesByLevel: Record<string, number>
  domainsCount: number
  hasL4: boolean
  hasL5: boolean
} {
  const nodesByLevel = countNodesByLevel(framework)
  const leafNodes = collectLeafNodes(framework)
  const totalNodes = Object.values(nodesByLevel).reduce((a, b) => a + b, 0)
  return {
    totalNodes,
    totalLeaves: leafNodes.length,
    nodesByLevel,
    domainsCount: framework.domains.length,
    hasL4: (nodesByLevel['L4'] ?? 0) > 0,
    hasL5: (nodesByLevel['L5'] ?? 0) > 0,
  }
}