import { APQC_PCF_V721 } from './frameworks/apqc-pcf.js'
import type { FrameworkDefinition, FrameworkDomain, FrameworkLeafNode, FrameworkNode } from './shared-types.js'

export const BUILTIN_FRAMEWORKS: Record<string, FrameworkDefinition> = {
  'apqc-process': APQC_PCF_V721,
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