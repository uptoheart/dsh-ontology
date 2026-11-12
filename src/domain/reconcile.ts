import type {
  DomainApplyItem, DomainApplyResult, DomainDictEntry, DomainReconcileResult,
  DomainSuggestion, DomainSource, OntologyEntity,
} from '../shared-types.js'
import { mappingAxisOfKind } from '../shared-types.js'
import { loadSuite, saveSuite } from '../datastore.js'
import { addDomainAliases, getDomainDictionary, normalizeTerm } from './standard-domains.js'

/**
 * 领域对齐：把实体的声明领域（domain）匹配到标准领域目录（APQC PCF L1/L2）。
 *
 * 纯规则匹配，不调用外部模型：
 *   编号直等(1.0) → 名称精确(0.95) → 别名(0.9) → 包含(0.7)
 * 结果只产出建议，是否写回由人工确认；原始 domain 字段永不覆盖。
 */

const SUFFIXES = ['管理', '业务', '领域', '域']

export interface DomainMatchInput {
  declared?: string
  name?: string
  alias?: string
}

export interface DomainMatchResult {
  matchedBy: DomainSuggestion['matchedBy']
  suggestions: DomainSuggestion['suggestions']
}

/** 生成比较变体：归一化原值 + 去掉业务后缀的版本 */
function termVariants(value: unknown): string[] {
  const base = normalizeTerm(value)
  if (!base) return []
  const out = new Set<string>([base])
  for (const suffix of SUFFIXES) {
    const s = normalizeTerm(suffix)
    if (base.length > s.length + 1 && base.endsWith(s)) out.add(base.slice(0, -s.length))
  }
  return [...out]
}

/**
 * 实体 → 标准领域候选（纯函数，便于单测）。
 * 同一编号只保留最高分；按分数降序，同分时 L2 优先（更具体）。
 */
export function matchDomain(input: DomainMatchInput, entries: DomainDictEntry[]): DomainMatchResult {
  const declaredRaw = String(input.declared ?? '').trim()
  const nameTerms = termVariants(input.name)
  const aliasTerms = termVariants(input.alias)
  const declaredTerms = termVariants(declaredRaw)

  const hits = new Map<string, DomainSuggestion['suggestions'][number] & { by: DomainSuggestion['matchedBy'] }>()

  for (const entry of entries) {
    const labelKey = normalizeTerm(entry.label)
    const aliasKeys = (entry.aliases ?? []).map(normalizeTerm).filter(Boolean)
    let score = 0
    let by: DomainSuggestion['matchedBy']

    if (declaredRaw && declaredRaw === entry.code) {
      score = 1; by = 'code'
    } else if (nameTerms.includes(labelKey)) {
      score = 0.95; by = 'label'
    } else if (aliasTerms.includes(labelKey)) {
      score = 0.9; by = 'alias'
    } else if (aliasKeys.some(a => nameTerms.includes(a))) {
      score = 0.9; by = 'alias'
    } else if (declaredTerms.includes(labelKey)) {
      score = 0.9; by = 'alias'
    } else if (aliasKeys.some(a => declaredTerms.includes(a))) {
      score = 0.9; by = 'alias'
    } else {
      const candidates = [...nameTerms, ...declaredTerms]
      const hit = candidates.find(t =>
        t.length >= 2 && labelKey.length >= 2 && (t.includes(labelKey) || labelKey.includes(t)))
      if (hit) { score = 0.7; by = 'contains' }
    }

    if (!score) continue
    const prev = hits.get(entry.code)
    if (prev && prev.score >= score) continue
    hits.set(entry.code, {
      code: entry.code,
      label: entry.label,
      level: entry.level,
      parentCode: entry.parentCode,
      score,
      by,
    })
  }

  const ranked = [...hits.values()]
    .sort((a, b) => b.score - a.score
      || (a.level === b.level ? 0 : a.level === 'L2' ? -1 : 1)
      || a.code.localeCompare(b.code))
    .slice(0, 3)

  return {
    matchedBy: ranked[0]?.by,
    suggestions: ranked.map(h => ({
      code: h.code, label: h.label, level: h.level, parentCode: h.parentCode, score: h.score,
    })),
  }
}

/**
 * 套件领域对齐（dry-run）：只读，不落库。
 */
export async function reconcileSuite(suiteId: string, frameworkId?: string): Promise<DomainReconcileResult | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const fwId = frameworkId || suite.meta.activeFrameworkId || suite.meta.frameworkId || 'apqc-process'
  const dict = await getDomainDictionary(fwId)
  const entries: DomainSuggestion[] = []

  for (const ent of suite.entities) {
    // 名词轴之外（流程/行为/UI/安全域）不参与领域对齐
    if (mappingAxisOfKind(ent.kind) !== 'domain') {
      entries.push(skip(ent, '非名词类实体，不参与领域轴'))
      continue
    }
    // 主数据实体的领域就是它自己，映射到业务域会破坏跨套件去重
    if (ent.domainCategory === 'master') {
      entries.push(skip(ent, '主数据实体，领域即自身'))
      continue
    }
    // 已对齐且编号仍在当前目录中：直接认定
    if (ent.domainCode) {
      const hit = dict.entries.find(e => e.code === ent.domainCode)
      if (hit) {
        entries.push({
          entityId: ent.id, entityName: ent.name, kind: ent.kind, declared: ent.domain,
          status: 'matched', matchedBy: 'aligned',
          suggestions: [{ code: hit.code, label: hit.label, level: hit.level, parentCode: hit.parentCode, score: 1 }],
        })
        continue
      }
    }

    const { matchedBy, suggestions } = matchDomain(
      { declared: ent.domain, name: ent.name, alias: ent.alias },
      dict.entries,
    )
    const top = suggestions[0]
    const second = suggestions[1]
    let status: DomainSuggestion['status']
    if (!top) status = 'unmatched'
    else if (top.score >= 0.9 && (!second || top.score - second.score >= 0.05)) status = 'matched'
    else status = 'ambiguous'

    entries.push({
      entityId: ent.id, entityName: ent.name, kind: ent.kind, declared: ent.domain,
      status, matchedBy: status === 'unmatched' ? undefined : matchedBy, suggestions,
    })
  }

  const stats = {
    total: entries.length,
    matched: entries.filter(e => e.status === 'matched').length,
    ambiguous: entries.filter(e => e.status === 'ambiguous').length,
    unmatched: entries.filter(e => e.status === 'unmatched').length,
    skipped: entries.filter(e => e.status === 'skipped').length,
  }
  return { suiteId, frameworkId: fwId, entries, stats, generatedAt: Date.now() }
}

function skip(ent: OntologyEntity, reason: string): DomainSuggestion {
  return {
    entityId: ent.id, entityName: ent.name, kind: ent.kind, declared: ent.domain,
    status: 'skipped', reason, suggestions: [],
  }
}

/**
 * 人工确认后写回标准领域编号，并把实体名沉淀为别名。
 * 只接受目录中存在的编号；跳过主数据与非名词实体。
 */
export async function applyDomainMappings(
  suiteId: string,
  items: DomainApplyItem[],
  frameworkId?: string,
): Promise<DomainApplyResult | null> {
  const suite = await loadSuite(suiteId)
  if (!suite) return null
  const fwId = frameworkId || suite.meta.activeFrameworkId || suite.meta.frameworkId || 'apqc-process'
  const dict = await getDomainDictionary(fwId)
  const byCode = new Map(dict.entries.map(e => [e.code, e]))

  const updated: OntologyEntity[] = []
  const aliasAdds = new Map<string, string[]>()

  for (const item of items) {
    const ent = suite.entities.find(e => e.id === item.entityId)
    if (!ent) continue
    if (mappingAxisOfKind(ent.kind) !== 'domain') continue
    if (ent.domainCategory === 'master') continue
    const entry = byCode.get(String(item.code ?? '').trim())
    if (!entry) continue

    const source: DomainSource = item.source ?? 'manual'
    ent.domainCode = entry.code
    ent.domainLabel = entry.label
    ent.domainSource = source
    ent.domainConfidence = source === 'manual' ? 1 : (item.confidence ?? 1)
    updated.push(ent)

    const names = [ent.name, ent.alias]
      .map(v => String(v ?? '').trim())
      .filter(Boolean)
      .filter(v => normalizeTerm(v) !== normalizeTerm(entry.label))
    if (names.length) {
      const list = aliasAdds.get(entry.code) ?? []
      aliasAdds.set(entry.code, [...list, ...names])
    }
  }

  if (updated.length) await saveSuite(suiteId, suite)
  const aliasesAdded = aliasAdds.size
    ? await addDomainAliases(fwId, [...aliasAdds].map(([code, aliases]) => ({ code, aliases })))
    : 0

  return { updated: updated.length, aliasesAdded, entities: updated }
}
