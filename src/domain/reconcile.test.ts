import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DomainDictEntry, OntologyAnnotations, OntologyEntity, OntologySuiteMeta } from '../shared-types.js'
import { applyDomainMappings, matchDomain, reconcileSuite } from './reconcile.js'

const ENTRIES: DomainDictEntry[] = [
  { code: '4.0', label: '交付产品与服务', level: 'L1' },
  { code: '4.3', label: '生产制造', level: 'L2', parentCode: '4.0', aliases: ['生产运营', '制造管理'] },
  { code: '3.0', label: '市场与销售产品和服务', level: 'L1' },
  { code: '3.2', label: '销售合同管理', level: 'L2', parentCode: '3.0' },
]

describe('matchDomain', () => {
  it('声明值就是编号时按编号直等命中', () => {
    const r = matchDomain({ declared: '4.3', name: '工单' }, ENTRIES)
    expect(r.matchedBy).toBe('code')
    expect(r.suggestions[0]).toMatchObject({ code: '4.3', score: 1 })
  })

  it('实体名与标准标签精确一致时高置信命中', () => {
    const r = matchDomain({ declared: '', name: '生产制造' }, ENTRIES)
    expect(r.matchedBy).toBe('label')
    expect(r.suggestions[0].score).toBeCloseTo(0.95)
  })

  it('命中别名（含业务后缀剥离）', () => {
    const r = matchDomain({ declared: '', name: '生产运营管理' }, ENTRIES)
    expect(r.matchedBy).toBe('alias')
    expect(r.suggestions[0].code).toBe('4.3')
  })

  it('仅包含关系时给低分，交由人工确认', () => {
    const r = matchDomain({ declared: '', name: '销售合同' }, ENTRIES)
    expect(r.suggestions[0].code).toBe('3.2')
    expect(r.suggestions[0].score).toBeLessThan(0.9)
  })

  it('无任何线索时返回空建议', () => {
    const r = matchDomain({ declared: '', name: '仲裁委员会' }, ENTRIES)
    expect(r.suggestions).toHaveLength(0)
    expect(r.matchedBy).toBeUndefined()
  })
})

/* ─────────── 端到端：dry-run 与人工写回 ─────────── */
const cleanupDirs: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  for (const dir of cleanupDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

function entity(id: string, name: string, kind: OntologyEntity['kind'], domainCategory: OntologyEntity['domainCategory']): OntologyEntity {
  return {
    id, rawId: id, name, kind, domain: '测试域', domainCategory,
    canonicalId: `canonical:${kind}:${name}`, sourceFile: 'm1.yaml', properties: {},
  }
}

function writeSuite(root: string, suiteId: string, entities: OntologyEntity[]) {
  const dir = join(root, 'ontologies', suiteId)
  mkdirSync(dir, { recursive: true })
  const meta: OntologySuiteMeta = {
    suiteId, domain: '测试域', project: '测试', sourceDir: 'test',
    importTime: Date.now(), sourceMtime: 0, sourceFileCount: 1,
    entityCount: entities.length, relationCount: 0,
  }
  const annotations: OntologyAnnotations = { entityFrameMapping: {}, coverageMarks: {}, customRelations: [] }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta))
  writeFileSync(join(dir, 'entities.json'), JSON.stringify(entities))
  writeFileSync(join(dir, 'relations.json'), JSON.stringify([]))
  writeFileSync(join(dir, 'annotations.json'), JSON.stringify(annotations))
}

describe('reconcileSuite / applyDomainMappings', () => {
  it('跳过主数据与非名词实体，命中后写回编号且不覆盖原领域', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-domain-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const master = entity('s:AGGREGATE_ROOT:产品', '产品', 'AGGREGATE_ROOT', 'master')
    const flow = entity('s:FLOW:审批', '审批', 'FLOW', 'core')
    const core = entity('s:AGGREGATE_ROOT:sales', '营销和销售产品与服务', 'AGGREGATE_ROOT', 'core')
    writeSuite(root, 'demo', [master, flow, core])

    const dry = await reconcileSuite('demo')
    expect(dry).not.toBeNull()
    expect(dry!.stats.skipped).toBe(2)
    expect(dry!.stats.matched).toBe(1)
    const hit = dry!.entries.find(e => e.entityName === '营销和销售产品与服务')!
    expect(hit.suggestions[0].code).toBe('3.0')

    // dry-run 不落库
    const before = JSON.parse(await readFile(join(root, 'ontologies', 'demo', 'entities.json'), 'utf-8'))
    expect(before.find((e: OntologyEntity) => e.id === core.id).domainCode).toBeUndefined()

    const applied = await applyDomainMappings('demo', [{ entityId: core.id, code: '3.0', source: 'manual' }])
    expect(applied!.updated).toBe(1)
    const after = JSON.parse(await readFile(join(root, 'ontologies', 'demo', 'entities.json'), 'utf-8'))
    const saved = after.find((e: OntologyEntity) => e.id === core.id)
    expect(saved.domainCode).toBe('3.0')
    expect(saved.domainSource).toBe('manual')
    expect(saved.domain).toBe('测试域')   // 原始领域字段不被覆盖
    // 主数据与流程实体不受影响
    expect(after.find((e: OntologyEntity) => e.id === master.id).domainCode).toBeUndefined()
    expect(after.find((e: OntologyEntity) => e.id === flow.id).domainCode).toBeUndefined()
  })

  it('人工确认时把实体名沉淀为别名，供下次匹配复用', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-domain-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const core = entity('s:AGGREGATE_ROOT:sales', '营销售货', 'AGGREGATE_ROOT', 'core')
    writeSuite(root, 'demo', [core])

    const applied = await applyDomainMappings('demo', [{ entityId: core.id, code: '3.0', source: 'manual' }])
    expect(applied!.aliasesAdded).toBe(1)
    const aliasFile = JSON.parse(await readFile(join(root, 'dictionary.json'), 'utf-8'))
    expect(aliasFile.frameworks['apqc-process']['3.0']).toContain('营销售货')
  })
})
