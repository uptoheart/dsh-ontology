import { describe, expect, it } from 'vitest'
import { classifyDomain, buildEntity } from './ontology-parser.js'
import type { DomainCategory } from './shared-types.js'

describe('classifyDomain — 领域二次划分', () => {
  const SUITE_DOMAIN = '销售合同执行管理'

  it('主数据聚合根：domain 取实体名称，domainCategory=master', () => {
    const result = classifyDomain({ name: '产品', tags: ['主数据'] }, SUITE_DOMAIN)
    expect(result.domain).toBe('产品')
    expect(result.domainCategory).toBe('master')
  })

  it('核心域聚合根：domain 取套件主领域，domainCategory=core', () => {
    const result = classifyDomain({ name: '合同', tags: ['核心域'] }, SUITE_DOMAIN)
    expect(result.domain).toBe(SUITE_DOMAIN)
    expect(result.domainCategory).toBe('core')
  })

  it('支撑域聚合根：domain = 套件主领域 +「·支撑」，domainCategory=supporting', () => {
    const result = classifyDomain({ name: '审批记录', tags: ['支撑域'] }, SUITE_DOMAIN)
    expect(result.domain).toBe(`${SUITE_DOMAIN}·支撑`)
    expect(result.domainCategory).toBe('supporting')
  })

  it('未打 tags 的聚合根：默认 core，domain 取套件主领域', () => {
    const result = classifyDomain({ name: '未知实体' }, SUITE_DOMAIN)
    expect(result.domain).toBe(SUITE_DOMAIN)
    expect(result.domainCategory).toBe('core')
  })

  it('tags 为空数组：默认 core', () => {
    const result = classifyDomain({ name: 'X', tags: [] }, SUITE_DOMAIN)
    expect(result.domainCategory).toBe('core')
  })

  it('同时含主数据与核心域标签：主数据优先（主数据判定在前）', () => {
    const result = classifyDomain({ name: '产品', tags: ['主数据', '核心域'] }, SUITE_DOMAIN)
    expect(result.domainCategory).toBe('master')
    expect(result.domain).toBe('产品')
  })

  it('主数据但 name 为空：回退到套件主领域', () => {
    const result = classifyDomain({ tags: ['主数据'] }, SUITE_DOMAIN)
    expect(result.domain).toBe(SUITE_DOMAIN)
    expect(result.domainCategory).toBe('master')
  })

  it('非数组 tags 不报错，按无 tags 处理', () => {
    const result = classifyDomain({ name: 'X', tags: '主数据' }, SUITE_DOMAIN)
    expect(result.domainCategory).toBe('core')
  })
})

describe('buildEntity — 规范实体身份', () => {
  const SUITE_ID = 'crm'

  it('主数据实体：canonicalId = canonical:${kind}:${name}', () => {
    const e = buildEntity(SUITE_ID, 'AGG-PRODUCT-001', '产品', 'AGGREGATE_ROOT',
      '产品', 'm1.yaml', {}, undefined, undefined, 'master')
    expect(e.id).toBe(`${SUITE_ID}:AGGREGATE_ROOT:AGG-PRODUCT-001`)
    expect(e.canonicalId).toBe('canonical:AGGREGATE_ROOT:产品')
    expect(e.domain).toBe('产品')
    expect(e.domainCategory).toBe('master')
  })

  it('核心域实体：canonicalId 等于自身 id', () => {
    const e = buildEntity(SUITE_ID, 'AGG-CONTRACT-001', '合同', 'AGGREGATE_ROOT',
      '销售合同执行管理', 'm1.yaml', {}, undefined, undefined, 'core')
    expect(e.id).toBe(`${SUITE_ID}:AGGREGATE_ROOT:AGG-CONTRACT-001`)
    expect(e.canonicalId).toBe(e.id)
    expect(e.domainCategory).toBe('core')
  })

  it('未指定 domainCategory：默认 core，canonicalId = id', () => {
    const e = buildEntity(SUITE_ID, 'R-001', '审批规则', 'RULE',
      '销售合同执行管理', 'm3.yaml', {})
    expect(e.domainCategory).toBe('core')
    expect(e.canonicalId).toBe(e.id)
  })

  it('支撑域实体：canonicalId = id（不跨套件共享）', () => {
    const e = buildEntity(SUITE_ID, 'AGG-APPROVAL-001', '审批记录', 'AGGREGATE_ROOT',
      '销售合同执行管理·支撑', 'm1.yaml', {}, undefined, undefined, 'supporting')
    expect(e.canonicalId).toBe(e.id)
    expect(e.domainCategory).toBe('supporting')
  })

  it('properties 原样保留，alias/description 透传', () => {
    const props = { tags: ['主数据'], foo: 'bar' }
    const e = buildEntity(SUITE_ID, 'AGG-PRODUCT-001', '产品', 'AGGREGATE_ROOT',
      '产品', 'm1.yaml', props, 'Product', '产品主数据', 'master')
    expect(e.properties).toEqual(props)
    expect(e.alias).toBe('Product')
    expect(e.description).toBe('产品主数据')
    expect(e.sourceFile).toBe('m1.yaml')
  })
})

describe('classifyDomain + buildEntity 集成：跨套件同名主数据 canonicalId 一致', () => {
  it('CRM 套件与 MES 套件的「产品」生成相同 canonicalId，可被去重', () => {
    const crmAgg = { name: '产品', tags: ['主数据'] }
    const mesAgg = { name: '产品', tags: ['主数据'] }
    const crmClass = classifyDomain(crmAgg, '客户关系管理')
    const mesClass = classifyDomain(mesAgg, '制造执行')

    const crmProduct = buildEntity('crm', 'P1', '产品', 'AGGREGATE_ROOT',
      crmClass.domain, 'm1.yaml', {}, undefined, undefined, crmClass.domainCategory)
    const mesProduct = buildEntity('mes', 'P2', '产品', 'AGGREGATE_ROOT',
      mesClass.domain, 'm1.yaml', {}, undefined, undefined, mesClass.domainCategory)

    // 两者 domain 均为「产品」，canonicalId 相同 → 可跨套件去重
    expect(crmProduct.domain).toBe('产品')
    expect(mesProduct.domain).toBe('产品')
    expect(crmProduct.canonicalId).toBe(mesProduct.canonicalId)
    expect(crmProduct.canonicalId).toBe('canonical:AGGREGATE_ROOT:产品')
    // 但 suite-local id 不同
    expect(crmProduct.id).not.toBe(mesProduct.id)
  })

  it('不同主数据实体 canonicalId 不同', () => {
    const product = buildEntity('crm', 'P1', '产品', 'AGGREGATE_ROOT',
      '产品', 'm1.yaml', {}, undefined, undefined, 'master')
    const customer = buildEntity('crm', 'C1', '客户', 'AGGREGATE_ROOT',
      '客户', 'm1.yaml', {}, undefined, undefined, 'master')
    expect(product.canonicalId).not.toBe(customer.canonicalId)
  })
})
