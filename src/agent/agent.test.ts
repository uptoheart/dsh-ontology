import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  CoverageMatrix, EntityKind, FlowchartData, FrameworkDefinition, InterviewRecord,
  OntologyEntity, ProcessCoverageMatrix, SuiteData,
} from '../shared-types.js'
import type { AgentOverviewInput } from './status.js'
import { buildAgentOverview, deriveAgentStage } from './status.js'
import { buildInterviewQuestions } from './questions.js'
import { buildAgentPrompt, buildLedgerMarkdown } from './prompts.js'
import { loadAgentState, saveAgentState } from './store.js'
import type { AgentDecision, AgentState } from './types.js'

const SUITE_ID = 'suite-test'
const FW_ID = 'test-fw'

const FW: FrameworkDefinition = {
  frameworkId: FW_ID,
  name: '测试框架',
  source: 'test',
  levels: [
    { id: 'L1', name: 'L1', label: '一级', order: 1 },
    { id: 'L2', name: 'L2', label: '二级', order: 2 },
    { id: 'L3', name: 'L3', label: '三级', order: 3 },
  ],
  domains: [{
    id: 'd1',
    code: '4.0',
    name: '交付',
    label: '交付实物产品与服务',
    children: [{
      code: '4.3',
      name: '生产',
      label: '生产制造',
      levelId: 'L2',
      children: [
        { code: '4.3.2', name: '排产', label: '生产排程', levelId: 'L3' },
        { code: '4.3.3', name: '执行', label: '生产执行', levelId: 'L3' },
      ],
    }],
  }],
}

function makeEntity(id: string, kind: EntityKind, name = id): OntologyEntity {
  return { id, rawId: id, name, kind, domain: '交付', sourceFile: 'test.md', properties: {} }
}

function makeSuite(entities: OntologyEntity[], anchoredIds: string[] = []): SuiteData {
  const entityFrameMapping: SuiteData['annotations']['entityFrameMapping'] = {}
  for (const id of anchoredIds) entityFrameMapping[id] = { frameworkId: FW_ID, apqcCode: '4.3' }
  return {
    entities,
    relations: [],
    meta: {
      suiteId: SUITE_ID,
      domain: '装备制造',
      project: '测试项目',
      sourceDir: 'test',
      importTime: 0,
      sourceMtime: 0,
      sourceFileCount: 1,
      entityCount: entities.length,
      relationCount: 0,
      frameworkId: FW_ID,
    },
    annotations: { entityFrameMapping, coverageMarks: {}, customRelations: [] },
  }
}

function makeProcess(overrides: Partial<ProcessCoverageMatrix> = {}): ProcessCoverageMatrix {
  return {
    frameworkId: FW_ID,
    suiteId: SUITE_ID,
    tree: [],
    l3Total: 2,
    l3Covered: 0,
    l3Partial: 0,
    l3Unmounted: 2,
    mountedFlows: [],
    gapList: [
      { code: '4.3.2', label: '生产排程', path: ['交付实物产品与服务', '生产制造'] },
      { code: '4.3.3', label: '生产执行', path: ['交付实物产品与服务', '生产制造'] },
    ],
    ...overrides,
  }
}

function makeCoverage(overrides: Partial<CoverageMatrix> = {}): CoverageMatrix {
  return {
    frameworkId: FW_ID,
    suiteId: SUITE_ID,
    domains: FW.domains,
    levels: FW.levels,
    cells: [],
    totalEntities: 0,
    leafTotal: 0,
    leafCovered: 0,
    leafPartial: 0,
    leafGap: 0,
    leafUnset: 0,
    tree: [],
    ...overrides,
  }
}

function makeInterview(id: string, code: string, complete: boolean): InterviewRecord {
  return {
    id,
    suiteId: SUITE_ID,
    apqcCode: code,
    answers: complete
      ? {
          hasRole: { value: true, roleRef: 'ROLE-1' },
          hasObject: { value: true, entityId: 'ent-1', op: 'create' },
          hasRule: { value: true },
          hasBehavior: { value: true },
        }
      : {
          hasRole: { value: false },
          hasObject: { value: true, entityId: 'ent-1', op: 'read' },
        },
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeFlow(id: string, apqcCode?: string): FlowchartData {
  return {
    id,
    name: `流程 ${id}`,
    suiteId: SUITE_ID,
    apqcCode,
    nodes: [],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeState(stage: AgentState['stage'] = 'prep', overrides: Partial<AgentState> = {}): AgentState {
  return { suiteId: SUITE_ID, stage, decisions: [], exports: [], updatedAt: 0, ...overrides }
}

function makeInput(overrides: Partial<AgentOverviewInput> = {}): AgentOverviewInput {
  return {
    suite: makeSuite([makeEntity('ent-1', 'ENTITY', '生产工单')], ['ent-1']),
    framework: FW,
    coverage: makeCoverage({ process: makeProcess() }),
    flows: [],
    interviews: [],
    state: makeState(),
    ...overrides,
  }
}

const cleanupDirs: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  for (const dir of cleanupDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('FDE 工作 Agent', () => {
  it('门禁：域锚定率 0.5 时流程显影未通过，0.6 且挂载 1 张流程图时通过', () => {
    const entities = Array.from({ length: 10 }, (_, i) => makeEntity(`ent-${i}`, 'ENTITY', `实体${i}`))

    const half = buildAgentOverview(makeInput({
      suite: makeSuite(entities, entities.slice(0, 5).map(e => e.id)),
      coverage: makeCoverage({ process: makeProcess() }),
      state: makeState('flow'),
    }))
    expect(half.gates.find(g => g.stage === 'flow')?.passed).toBe(false)

    const enough = buildAgentOverview(makeInput({
      suite: makeSuite(entities, entities.slice(0, 6).map(e => e.id)),
      coverage: makeCoverage({
        process: makeProcess({
          mountedFlows: [{ flowId: 'f1', name: '排产流程', apqcCode: '4.3.2', nodeCount: 3, participationCount: 1, updatedAt: 0 }],
        }),
      }),
      state: makeState('flow'),
    }))
    expect(enough.gates.find(g => g.stage === 'flow')?.passed).toBe(true)
    expect(enough.nextStage).toBe('semantic')
  })

  it('行动：流程显影阶段缺锚定优先补锚定，违规映射常驻全局风险', () => {
    const entities = Array.from({ length: 4 }, (_, i) => makeEntity(`ent-${i}`, 'ENTITY', `实体${i}`))
    const overview = buildAgentOverview(makeInput({
      suite: makeSuite(entities, ['ent-0']),
      coverage: makeCoverage({
        process: makeProcess(),
        violatedMappings: [{
          entityId: 'ent-9', entityName: '流程实体', kind: 'FLOW', apqcCode: '4.3.2', levelId: 'L3', reason: '动词轴实体映射到 L1/L2',
        }],
      }),
      state: makeState('flow'),
    }))

    expect(overview.actions[0]?.id).toBe('anchor-entities')
    expect(overview.actions[0]?.priority).toBe('P0')
    expect(overview.risks.some(r => r.id === 'violated-mappings')).toBe(true)
  })

  it('指标：域锚定 2/3 为 67%，四问完整 2/4 为 50%', () => {
    const entities = [
      makeEntity('ent-0', 'ENTITY', '实体0'),
      makeEntity('ent-1', 'ENTITY', '实体1'),
      makeEntity('ent-2', 'ENTITY', '实体2'),
    ]
    const interviews = [
      makeInterview('i1', '4.3.2', true),
      makeInterview('i2', '4.3.2', true),
      makeInterview('i3', '4.3.3', false),
      makeInterview('i4', '4.3.3', false),
    ]
    const overview = buildAgentOverview(makeInput({
      suite: makeSuite(entities, ['ent-0', 'ent-1']),
      interviews,
      state: makeState('semantic'),
    }))

    const anchor = overview.metrics.find(m => m.key === 'domainAnchor')
    expect(anchor?.value).toBe('2/3')
    expect(anchor?.detail).toContain('67%')
    expect(anchor?.status).toBe('ok')

    const complete = overview.metrics.find(m => m.key === 'interviewComplete')
    expect(complete?.value).toBe('2/4')
    expect(complete?.detail).toContain('50%')
    expect(complete?.status).toBe('warn')
  })

  it('问题：四问齐全、带节点编号与名称、候选实体不超过 5 个、缺角色时给出警告', () => {
    const suite = makeSuite([
      makeEntity('ent-1', 'ENTITY', '生产工单'),
      makeEntity('ent-2', 'AGGREGATE_ROOT', '生产订单'),
      makeEntity('ent-3', 'ENTITY', '生产批次'),
      makeEntity('ent-4', 'DATA_DICTIONARY', '生产状态字典'),
      makeEntity('ent-5', 'REPORT', '生产日报'),
      makeEntity('ent-6', 'ENTITY', '生产领料单'),
      makeEntity('role-1', 'ROLE', '生产计划员'),
      makeEntity('rule-1', 'RULE', '排产优先级规则'),
    ], ['ent-1'])
    const set = buildInterviewQuestions({
      suite,
      framework: FW,
      code: '4.3.2',
      interviews: [makeInterview('i1', '4.3.2', false)],
      flows: [],
    })

    expect(set).not.toBeNull()
    expect(set!.code).toBe('4.3.2')
    expect(set!.label).toBe('生产排程')
    expect(set!.path).toEqual(['交付实物产品与服务', '生产制造'])
    expect(set!.questions.map(q => q.id)).toEqual(['role', 'object', 'rule', 'behavior'])
    expect(set!.suggestedEntities.length).toBeLessThanOrEqual(5)
    expect(set!.suggestedEntities.some(e => e.id === 'ent-1')).toBe(true)
    expect(set!.warnings.some(w => w.includes('缺少「角色」'))).toBe(true)
    expect(set!.questions[0].probes.some(p => p.includes('生产计划员'))).toBe(true)

    expect(buildInterviewQuestions({ suite, framework: FW, code: '4.3', interviews: [], flows: [] })).toBeNull()
  })

  it('提示词：包含项目域与阶段、保留待确认约束且体积可控', () => {
    const prompt = buildAgentPrompt({
      ...makeInput({ state: makeState('flow') }),
      scene: 'diagnose',
    })

    expect(prompt.title).toBe('进场诊断会议提纲')
    expect(prompt.content).toContain('测试项目')
    expect(prompt.content).toContain('装备制造')
    expect(prompt.content).toContain('流程显影')
    expect(prompt.content).toContain('[待确认]')
    expect(prompt.content.length).toBeLessThan(8 * 1024)
  })

  it('存储：保存后可原样读回，台账导出包含已确认与待确认项', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-agent-'))
    cleanupDirs.push(dir)
    vi.stubEnv('DSH_ONTOLOGY_DATA', dir)

    const decisions: AgentDecision[] = [
      { id: 'd1', stage: 'diagnose', topic: '痛点排序', question: '先做哪个？', answer: '排产优先', status: 'confirmed', createdAt: 1, updatedAt: 2 },
      { id: 'd2', stage: 'flow', topic: '流程边界', question: '是否含委外？', answer: '', status: 'pending', createdAt: 3, updatedAt: 4 },
    ]
    await saveAgentState(makeState('flow', { decisions }))
    const loaded = await loadAgentState(SUITE_ID)

    expect(loaded).not.toBeNull()
    expect(loaded!.suiteId).toBe(SUITE_ID)
    expect(loaded!.stage).toBe('flow')
    expect(loaded!.decisions).toEqual(decisions)
    expect(loaded!.exports).toEqual([])

    const ledger = buildLedgerMarkdown(loaded!, '测试项目')
    expect(ledger).toContain('测试项目 交付决策台账')
    expect(ledger).toContain('已确认 1 条')
    expect(ledger).toContain('待确认 1 条')
    expect(ledger).toContain('排产优先')
  })

  it('阶段推导：无状态输入时按现场数据落到流程显影', () => {
    const stage = deriveAgentStage(makeInput({
      suite: makeSuite([makeEntity('ent-0', 'ENTITY', '实体0')], ['ent-0']),
    }))
    expect(stage).toBe('flow')
  })
})
