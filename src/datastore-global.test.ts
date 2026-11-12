import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import type {
  OntologyEntity, OntologyRelation, OntologySuiteMeta, OntologyAnnotations,
  DomainCategory, SuiteData, InterviewRecord,
} from './shared-types.js'
import {
  buildGlobalOntology, assembleGlobalGraph,
  listInterviews, saveInterview, deleteInterview, deriveInterviewRelations,
} from './datastore.js'

const cleanupDirs: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  for (const dir of cleanupDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

/** 构造一个主数据实体（canonicalId 跨套件一致） */
function masterEntity(suiteId: string, name: string, rawId: string): OntologyEntity {
  return {
    id: `${suiteId}:AGGREGATE_ROOT:${rawId}`,
    rawId,
    name,
    kind: 'AGGREGATE_ROOT',
    domain: name,
    domainCategory: 'master',
    canonicalId: `canonical:AGGREGATE_ROOT:${name}`,
    sourceFile: 'm1.yaml',
    properties: { tags: ['主数据'] },
  }
}

/** 构造一个核心域实体（canonicalId = id，不跨套件共享） */
function coreEntity(suiteId: string, name: string, rawId: string, domain: string): OntologyEntity {
  const id = `${suiteId}:AGGREGATE_ROOT:${rawId}`
  return {
    id, rawId, name, kind: 'AGGREGATE_ROOT', domain,
    domainCategory: 'core', canonicalId: id,
    sourceFile: 'm1.yaml', properties: { tags: ['核心域'] },
  }
}

/** 把一个套件写入临时 datastorage 目录 */
function writeSuite(storageRoot: string, meta: OntologySuiteMeta, entities: OntologyEntity[], relations: OntologyRelation[]) {
  const dir = join(storageRoot, 'ontologies', meta.suiteId)
  mkdirSync(dir, { recursive: true })
  const annotations: OntologyAnnotations = { entityFrameMapping: {}, coverageMarks: {}, customRelations: [] }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta))
  writeFileSync(join(dir, 'entities.json'), JSON.stringify(entities))
  writeFileSync(join(dir, 'relations.json'), JSON.stringify(relations))
  writeFileSync(join(dir, 'annotations.json'), JSON.stringify(annotations))
}

function makeMeta(suiteId: string, domain: string): OntologySuiteMeta {
  return {
    suiteId, domain, project: '测试', sourceDir: 'test',
    importTime: Date.now(), sourceMtime: 0, sourceFileCount: 1,
    entityCount: 0, relationCount: 0,
  }
}

describe('buildGlobalOntology — 跨套件去重与合并', () => {
  it('两个套件的同名主数据实体合并为一个规范实体', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    // CRM 套件：产品 + 销售订单
    const crmProduct = masterEntity('crm', '产品', 'P1')
    const crmOrder = coreEntity('crm', '销售订单', 'O1', '客户关系管理')
    writeSuite(root, makeMeta('crm', '客户关系管理'), [crmProduct, crmOrder], [
      { id: 'r1', from: crmOrder.id, to: crmProduct.id, type: 'REFERENCE', label: '订购' },
    ])

    // MES 套件：产品 + 生产工单
    const mesProduct = masterEntity('mes', '产品', 'P2')
    const mesWorkOrder = coreEntity('mes', '生产工单', 'W1', '制造执行')
    writeSuite(root, makeMeta('mes', '制造执行'), [mesProduct, mesWorkOrder], [
      { id: 'r2', from: mesWorkOrder.id, to: mesProduct.id, type: 'REFERENCE', label: '生产' },
    ])

    const global = await buildGlobalOntology()

    // 产品应只有 1 个规范实体
    const products = global.entities.filter(e => e.name === '产品' && e.kind === 'AGGREGATE_ROOT')
    expect(products).toHaveLength(1)
    expect(products[0].canonicalId).toBe('canonical:AGGREGATE_ROOT:产品')
    expect(products[0].id).toBe(products[0].canonicalId)

    // 来源套件应同时包含 crm 和 mes
    const suites = products[0].properties?.suites
    expect(Array.isArray(suites)).toBe(true)
    expect(suites).toContain('crm')
    expect(suites).toContain('mes')

    // 核心域实体不合并，各保留 1 个
    const orders = global.entities.filter(e => e.name === '销售订单')
    const workOrders = global.entities.filter(e => e.name === '生产工单')
    expect(orders).toHaveLength(1)
    expect(workOrders).toHaveLength(1)
  })

  it('关系端点重映射到规范实体 ID，形成跨套件引用', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const crmProduct = masterEntity('crm', '产品', 'P1')
    const crmOrder = coreEntity('crm', '销售订单', 'O1', '客户关系管理')
    writeSuite(root, makeMeta('crm', '客户关系管理'), [crmProduct, crmOrder], [
      { id: 'r1', from: crmOrder.id, to: crmProduct.id, type: 'REFERENCE', label: '订购' },
    ])

    const mesProduct = masterEntity('mes', '产品', 'P2')
    const mesWorkOrder = coreEntity('mes', '生产工单', 'W1', '制造执行')
    writeSuite(root, makeMeta('mes', '制造执行'), [mesProduct, mesWorkOrder], [
      { id: 'r2', from: mesWorkOrder.id, to: mesProduct.id, type: 'REFERENCE', label: '生产' },
    ])

    const global = await buildGlobalOntology()

    // 两条关系的 to 都应指向规范产品 ID
    const canonProductId = 'canonical:AGGREGATE_ROOT:产品'
    const refsToProduct = global.relations.filter(r => r.to === canonProductId)
    expect(refsToProduct).toHaveLength(2)

    // from 分别是两个套件的核心域实体（id 未变，因为 core 的 canonicalId = id）
    const fromIds = new Set(refsToProduct.map(r => r.from))
    expect(fromIds.has(crmOrder.id)).toBe(true)
    expect(fromIds.has(mesWorkOrder.id)).toBe(true)
  })

  it('跨套件重复关系按 from|type|to 去重', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const product = masterEntity('s1', '产品', 'P1')
    const order1 = coreEntity('s1', '订单', 'O1', '域A')
    writeSuite(root, makeMeta('s1', '域A'), [product, order1], [
      { id: 'r1', from: order1.id, to: product.id, type: 'REFERENCE', label: '引用' },
    ])

    // 第二个套件：同样的产品，但不同的订单实体；关系类型和目标相同
    const product2 = masterEntity('s2', '产品', 'P2')
    const order2 = coreEntity('s2', '订单', 'O2', '域B')
    writeSuite(root, makeMeta('s2', '域B'), [product2, order2], [
      { id: 'r2', from: order2.id, to: product2.id, type: 'REFERENCE', label: '引用' },
    ])

    const global = await buildGlobalOntology()
    // 两个 from 不同，所以是两条不同的关系；但如果 from 也相同则去重
    expect(global.relations).toHaveLength(2)

    // 现在构造完全重复的关系（同 from、同 type、同 to）——通过同一套件内重复
    const product3 = masterEntity('s3', '产品', 'P3')
    const order3 = coreEntity('s3', '订单', 'O3', '域C')
    writeSuite(root, makeMeta('s3', '域C'), [product3, order3], [
      { id: 'r3a', from: order3.id, to: product3.id, type: 'REFERENCE', label: '引用' },
      { id: 'r3b', from: order3.id, to: product3.id, type: 'REFERENCE', label: '重复' },
    ])

    const global2 = await buildGlobalOntology()
    const canonProduct = 'canonical:AGGREGATE_ROOT:产品'
    const dupRels = global2.relations.filter(r =>
      r.from === order3.id && r.type === 'REFERENCE' && r.to === canonProduct)
    // 同 from|type|to 的关系只保留 1 条
    expect(dupRels).toHaveLength(1)
  })

  it('关系端点不存在于实体集时生成 DANGLING_REF 节点', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const order = coreEntity('s1', '订单', 'O1', '域A')
    writeSuite(root, makeMeta('s1', '域A'), [order], [
      { id: 'r1', from: order.id, to: 'nonexistent:AGGREGATE_ROOT:GHOST', type: 'REFERENCE', label: '指向幽灵' },
    ])

    const global = await buildGlobalOntology()
    const dangling = global.entities.find(e => e.kind === 'DANGLING_REF')
    expect(dangling).toBeDefined()
    expect(dangling?.name).toContain('未解析')
    expect(dangling?.domain).toBe('未知')
  })

  it('suiteIds 参数只合并指定套件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    writeSuite(root, makeMeta('s1', '域A'), [coreEntity('s1', '实体A', 'A1', '域A')], [])
    writeSuite(root, makeMeta('s2', '域B'), [coreEntity('s2', '实体B', 'B1', '域B')], [])

    const global = await buildGlobalOntology({ suiteIds: ['s1'] })
    expect(global.suites).toHaveLength(1)
    expect(global.suites[0].suiteId).toBe('s1')
    expect(global.entities).toHaveLength(1)
    expect(global.entities[0].name).toBe('实体A')
  })

  it('idMap 记录 suite-local id → canonical id 的映射', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const crmProduct = masterEntity('crm', '产品', 'P1')
    const crmOrder = coreEntity('crm', '销售订单', 'O1', '客户关系管理')
    writeSuite(root, makeMeta('crm', '客户关系管理'), [crmProduct, crmOrder], [])

    const global = await buildGlobalOntology()

    // 主数据实体的本地 id 映射到规范 id
    expect(global.idMap[crmProduct.id]).toBe('canonical:AGGREGATE_ROOT:产品')
    // 核心域实体的本地 id 映射到自身
    expect(global.idMap[crmOrder.id]).toBe(crmOrder.id)
  })
})

describe('assembleGlobalGraph — 全局图谱组装', () => {
  it('节点 group 取领域类别，边 from/to 为规范 id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const product = masterEntity('crm', '产品', 'P1')
    const order = coreEntity('crm', '销售订单', 'O1', '客户关系管理')
    writeSuite(root, makeMeta('crm', '客户关系管理'), [product, order], [
      { id: 'r1', from: order.id, to: product.id, type: 'REFERENCE', label: '订购' },
    ])

    const graph = await assembleGlobalGraph()

    // 产品节点 group = master
    const productNode = graph.nodes.find(n => n.name === '产品')
    expect(productNode?.group).toBe('master')
    expect(productNode?.domain).toBe('产品')

    // 订单节点 group = core
    const orderNode = graph.nodes.find(n => n.name === '销售订单')
    expect(orderNode?.group).toBe('core')

    // 边的 target 指向规范产品 id
    const edge = graph.edges[0]
    expect(edge.target).toBe('canonical:AGGREGATE_ROOT:产品')
    expect(edge.source).toBe(order.id)
  })

  it('跨套件去重后图谱节点数小于各套件实体数之和', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-global-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    writeSuite(root, makeMeta('crm', '客户关系管理'), [
      masterEntity('crm', '产品', 'P1'),
      coreEntity('crm', '销售订单', 'O1', '客户关系管理'),
    ], [])

    writeSuite(root, makeMeta('mes', '制造执行'), [
      masterEntity('mes', '产品', 'P2'),
      coreEntity('mes', '生产工单', 'W1', '制造执行'),
    ], [])

    const graph = await assembleGlobalGraph()
    // 2 + 2 = 4 个实体，但产品去重后只剩 3 个节点
    expect(graph.nodes).toHaveLength(3)
  })
})

describe('全局关联层 — processLinks 跨套件投影', () => {
  function writeSuiteWithMapping(
    storageRoot: string, meta: OntologySuiteMeta, entities: OntologyEntity[],
    mapping: OntologyAnnotations['entityFrameMapping'],
  ) {
    const dir = join(storageRoot, 'ontologies', meta.suiteId)
    mkdirSync(dir, { recursive: true })
    const annotations: OntologyAnnotations = { entityFrameMapping: mapping, coverageMarks: {}, customRelations: [] }
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta))
    writeFileSync(join(dir, 'entities.json'), JSON.stringify(entities))
    writeFileSync(join(dir, 'relations.json'), JSON.stringify([]))
    writeFileSync(join(dir, 'annotations.json'), JSON.stringify(annotations))
  }

  it('多个套件锚定同一流程编号时，保留各自 provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-links-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const crmAct: OntologyEntity = {
      id: 'crm:ACTIVITY:A1', rawId: 'A1', name: '维护客户档案', kind: 'ACTIVITY',
      domain: '客户关系管理', domainCategory: 'core', canonicalId: 'crm:ACTIVITY:A1',
      sourceFile: 'm1.yaml', properties: {},
    }
    const mesAct: OntologyEntity = {
      id: 'mes:ACTIVITY:A2', rawId: 'A2', name: '维护客户档案', kind: 'ACTIVITY',
      domain: '制造执行', domainCategory: 'core', canonicalId: 'mes:ACTIVITY:A2',
      sourceFile: 'm1.yaml', properties: {},
    }
    writeSuiteWithMapping(root, makeMeta('crm', '客户关系管理'), [crmAct],
      { [crmAct.id]: { 'hw-style-pcf': { apqcCode: '2.1.3' } } })
    writeSuiteWithMapping(root, makeMeta('mes', '制造执行'), [mesAct],
      { [mesAct.id]: { 'hw-style-pcf': { apqcCode: '2.1.3' } } })

    const global = await buildGlobalOntology()
    const links = global.processLinks.filter(l => l.apqcCode === '2.1.3')
    expect(links).toHaveLength(2)
    expect(new Set(links.map(l => l.suiteId))).toEqual(new Set(['crm', 'mes']))
    expect(links.every(l => l.frameworkId === 'hw-style-pcf')).toBe(true)
  })

  it('忽略域轴实体与重复锚定，且过滤悬空 canonical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-links-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const act: OntologyEntity = {
      id: 'crm:ACTIVITY:A1', rawId: 'A1', name: '维护客户档案', kind: 'ACTIVITY',
      domain: '客户关系管理', domainCategory: 'core', canonicalId: 'crm:ACTIVITY:A1',
      sourceFile: 'm1.yaml', properties: {},
    }
    const domainEnt: OntologyEntity = {
      id: 'crm:AGGREGATE_ROOT:R1', rawId: 'R1', name: '客户', kind: 'AGGREGATE_ROOT',
      domain: '客户', domainCategory: 'master', canonicalId: 'canonical:AGGREGATE_ROOT:客户',
      sourceFile: 'm1.yaml', properties: {},
    }
    writeSuiteWithMapping(root, makeMeta('crm', '客户关系管理'), [act, domainEnt], {
      [act.id]: { 'hw-style-pcf': { apqcCode: '2.1.3' } },
      // 实体不存在 → 悬空锚定被忽略
      'crm:ACTIVITY:MISSING': { 'hw-style-pcf': { apqcCode: '2.1.3' } },
      // 域轴实体不允许锚定 L3+ → 忽略
      [domainEnt.id]: { 'hw-style-pcf': { apqcCode: '2.1.3' } },
    })

    const global = await buildGlobalOntology()
    const links = global.processLinks.filter(l => l.apqcCode === '2.1.3')
    expect(links).toHaveLength(1)
    expect(links[0].canonicalId).toBe(act.id)
    expect(links[0].entityKind).toBe('ACTIVITY')
  })
})

describe('访谈未分配桶 — 无套件冷启动与认领', () => {
  it('无套件时写入 _unassigned 桶，entityName 落盘可回读', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-itv-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const saved = await saveInterview('_unassigned', {
      apqcCode: '2.1.3',
      answers: { hasObject: { value: true, entityName: '客户主数据', op: 'update' } },
      note: '进场第一天',
    })

    const list = await listInterviews('_unassigned')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(saved.id)
    expect(list[0].suiteId).toBe('_unassigned')
    expect(list[0].answers.hasObject?.entityName).toBe('客户主数据')
    expect(list[0].answers.hasObject?.entityId).toBeUndefined()
    expect(list[0].note).toBe('进场第一天')
  })

  it('认领：桶内记录迁入套件后套件可见、桶清空', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-itv-'))
    cleanupDirs.push(root)
    vi.stubEnv('DSH_ONTOLOGY_DATA', root)

    const bucketRec = await saveInterview('_unassigned', {
      apqcCode: '2.1.3',
      answers: { hasRole: { value: true, roleRef: '销售员' } },
    })

    // 认领（前端行为等价）：套件侧新建同内容记录，再删除桶内记录
    const claimed = await saveInterview('crm', {
      apqcCode: bucketRec.apqcCode, answers: bucketRec.answers, note: bucketRec.note,
    })
    expect(await deleteInterview('_unassigned', bucketRec.id)).toBe(true)

    expect(await listInterviews('_unassigned')).toHaveLength(0)
    const suiteList = await listInterviews('crm')
    expect(suiteList).toHaveLength(1)
    expect(suiteList[0].id).toBe(claimed.id)
    expect(suiteList[0].suiteId).toBe('crm')
    expect(suiteList[0].answers.hasRole?.roleRef).toBe('销售员')
  })

  it('派生关系忽略只有 entityName 的记录，绑定 entityId 后才投影', () => {
    const activity: OntologyEntity = {
      id: 'crm:ACTIVITY:A1', rawId: 'A1', name: '维护客户档案', kind: 'ACTIVITY',
      domain: '客户关系管理', domainCategory: 'core', canonicalId: 'crm:ACTIVITY:A1',
      sourceFile: 'm1.yaml', properties: {},
    }
    const object: OntologyEntity = {
      id: 'crm:ENTITY:E1', rawId: 'E1', name: '客户', kind: 'ENTITY',
      domain: '客户关系管理', domainCategory: 'core', canonicalId: 'crm:ENTITY:E1',
      sourceFile: 'm1.yaml', properties: {},
    }
    const suite: SuiteData = {
      entities: [activity, object],
      relations: [],
      meta: makeMeta('crm', '客户关系管理'),
      annotations: {
        entityFrameMapping: { [activity.id]: { 'hw-style-pcf': { apqcCode: '2.1.3' } } },
        coverageMarks: {},
        customRelations: [],
      },
    }
    const base = { suiteId: 'crm', apqcCode: '2.1.3', createdAt: 1, updatedAt: 1 }
    const nameOnly: InterviewRecord = {
      ...base, id: 'i-name-only',
      answers: { hasObject: { value: true, entityName: '客户', op: 'update' } },
    }
    const bound: InterviewRecord = {
      ...base, id: 'i-bound',
      answers: { hasObject: { value: true, entityId: object.id, op: 'update' } },
    }

    expect(deriveInterviewRelations(suite, [nameOnly])).toHaveLength(0)

    const rels = deriveInterviewRelations(suite, [bound])
    expect(rels).toHaveLength(1)
    expect(rels[0].from).toBe(activity.id)
    expect(rels[0].to).toBe(object.id)
    expect(rels[0].properties?.derivedFrom).toBe('interview:i-bound')
  })
})
