// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：确定性状态计算（门禁、指标、行动、风险）
// 所有结论必须能指回具体数据，不做加权综合分。
// ──────────────────────────────────────────────────────────────────────

import type {
  CoverageMatrix, FlowchartData, FrameworkDefinition, InterviewRecord, SuiteData,
} from '../shared-types.js'
import { levelNumOfCode, mappingAxisOfKind } from '../shared-types.js'
import type {
  AgentAction, AgentExportRecord, AgentGate, AgentMetricFact, AgentOverview,
  AgentRisk, AgentStage, AgentState,
} from './types.js'
import { AGENT_STAGES, STAGE_LABELS } from './types.js'

export interface AgentOverviewInput {
  suite: SuiteData
  framework: FrameworkDefinition | null
  coverage: CoverageMatrix
  flows: FlowchartData[]
  interviews: InterviewRecord[]
  state: AgentState
}

function l3Of(code: string): string {
  return code.split('.').slice(0, 3).join('.')
}

export interface AgentInputsSummary {
  domainEntities: number
  anchoredEntities: number
  domainAnchorRate: number
  l3Total: number
  l3Covered: number
  processRate: number
  mountedFlowCount: number
  interviewRecords: number
  completeRecords: number
  completeRate: number
  interviewNodeCodes: string[]
  unmountedInterviewCodes: string[]
  violatedMappings: number
  pendingDecisions: number
  confirmedDecisions: number
  gapList: { code: string; label: string; path: string[] }[]
}

export function summarizeAgentInputs(input: AgentOverviewInput): AgentInputsSummary {
  const { suite, coverage, flows, interviews, state } = input
  const fwId = suite.meta.frameworkId ?? 'apqc-process'

  const domainEntities = suite.entities.filter(e => mappingAxisOfKind(e.kind) === 'domain')
  let anchoredEntities = 0
  for (const entity of domainEntities) {
    const v = suite.annotations.entityFrameMapping[entity.id]
    if (!v) continue
    // 旧格式
    let code: string | undefined
    if (typeof v === 'object' && 'frameworkId' in v) {
      if ((v as any).frameworkId === fwId) code = (v as any).apqcCode
    } else {
      const entry = (v as Record<string, { apqcCode?: string }>)[fwId]
      code = entry?.apqcCode
    }
    if (code && levelNumOfCode(code) <= 2) anchoredEntities++
  }
  const domainAnchorRate = domainEntities.length ? anchoredEntities / domainEntities.length : 0

  const process = coverage.process
  const l3Total = process?.l3Total ?? 0
  const l3Covered = process?.l3Covered ?? 0
  const processRate = l3Total ? l3Covered / l3Total : 0
  const mountedFlows = process?.mountedFlows ?? []
  const gapList = process?.gapList ?? []

  const completeRecords = interviews.filter(rec => {
    const a = rec.answers ?? {}
    return Boolean(
      a.hasRole?.value && a.hasRole.roleRef
      && a.hasObject?.value && a.hasObject.entityId && a.hasObject.op,
    )
  }).length
  const completeRate = interviews.length ? completeRecords / interviews.length : 0

  const interviewNodeCodes = [...new Set(
    interviews.map(i => i.apqcCode).filter(c => c && levelNumOfCode(c) >= 3),
  )]
  const mountedL3 = new Set(mountedFlows.map(m => m.apqcCode))
  const flowNodeCodes = new Set<string>()
  for (const flow of flows) {
    if (flow.apqcCode) flowNodeCodes.add(flow.apqcCode)
    for (const node of flow.nodes) if (node.code) flowNodeCodes.add(node.code)
  }
  const unmountedInterviewCodes = interviewNodeCodes.filter(code =>
    !flowNodeCodes.has(code) && !mountedL3.has(l3Of(code)),
  )

  const violatedMappings = coverage.violatedMappings?.length ?? 0
  const pendingDecisions = state.decisions.filter(d => d.status === 'pending').length
  const confirmedDecisions = state.decisions.filter(d => d.status === 'confirmed').length

  return {
    domainEntities: domainEntities.length,
    anchoredEntities,
    domainAnchorRate,
    l3Total,
    l3Covered,
    processRate,
    mountedFlowCount: mountedFlows.length,
    interviewRecords: interviews.length,
    completeRecords,
    completeRate,
    interviewNodeCodes,
    unmountedInterviewCodes,
    violatedMappings,
    pendingDecisions,
    confirmedDecisions,
    gapList,
  }
}

/** 无持久化状态时，按现场数据推导当前阶段 */
export function deriveAgentStage(input: Omit<AgentOverviewInput, 'state'> & { state?: AgentState }): AgentStage {
  const summary = summarizeAgentInputs({
    ...input,
    state: input.state ?? { suiteId: input.suite.meta.suiteId, stage: 'prep', decisions: [], exports: [], updatedAt: 0 },
  })
  const exports = input.state?.exports ?? []
  const hasKind = (kind: AgentExportRecord['kind']): boolean => exports.some(e => e.kind === kind)
  if (hasKind('package') && hasKind('ledger')) return 'handoff'
  if (exports.length > 0) return 'validate'
  if (summary.interviewRecords > 0) return 'semantic'
  if (summary.mountedFlowCount > 0 || summary.anchoredEntities > 0) return 'flow'
  if (summary.confirmedDecisions > 0) return 'diagnose'
  return 'prep'
}

function buildGates(summary: AgentInputsSummary, input: AgentOverviewInput): AgentGate[] {
  const exportedKinds = new Set(input.state.exports.map(e => e.kind))
  const validateKinds = ['minutes', 'crud', 'gap', 'domain'] as const
  const validateDone = validateKinds.filter(k => exportedKinds.has(k)).length
  const handoffDone = (exportedKinds.has('package') ? 1 : 0) + (exportedKinds.has('ledger') ? 1 : 0)

  const gates: AgentGate[] = [
    {
      stage: 'prep',
      label: STAGE_LABELS.prep,
      passed: input.suite.entities.length > 0 && Boolean(input.framework),
      criteria: `套件实体 ${input.suite.entities.length} 条，框架${input.framework ? '已锁定' : '未锁定'}`,
    },
    {
      stage: 'diagnose',
      label: STAGE_LABELS.diagnose,
      passed: summary.confirmedDecisions >= 3,
      criteria: `已确认痛点 ${summary.confirmedDecisions}/3 条`,
    },
    {
      stage: 'flow',
      label: STAGE_LABELS.flow,
      passed: summary.domainAnchorRate >= 0.6 && summary.mountedFlowCount >= 1,
      criteria: `域锚定 ${summary.anchoredEntities}/${summary.domainEntities}（${Math.round(summary.domainAnchorRate * 100)}%），已挂载流程 ${summary.mountedFlowCount} 张`,
    },
    {
      stage: 'semantic',
      label: STAGE_LABELS.semantic,
      passed: summary.interviewRecords > 0 && summary.completeRate >= 0.6 && summary.violatedMappings === 0,
      criteria: `四问完整 ${summary.completeRecords}/${summary.interviewRecords}（${Math.round(summary.completeRate * 100)}%），违规映射 ${summary.violatedMappings} 条`,
    },
    {
      stage: 'validate',
      label: STAGE_LABELS.validate,
      passed: validateDone === validateKinds.length,
      criteria: `交付物已导出 ${validateDone}/4 类（纪要/矩阵/缺口/域覆盖）`,
    },
    {
      stage: 'handoff',
      label: STAGE_LABELS.handoff,
      passed: handoffDone === 2,
      criteria: `回带材料已导出 ${handoffDone}/2 项（数据包/决策台账）`,
    },
  ]
  return gates
}

function buildMetrics(summary: AgentInputsSummary): AgentMetricFact[] {
  const anchorPct = Math.round(summary.domainAnchorRate * 100)
  const processPct = Math.round(summary.processRate * 100)
  const completePct = Math.round(summary.completeRate * 100)
  const consistencyCount = summary.violatedMappings + summary.unmountedInterviewCodes.length

  return [
    {
      key: 'domainAnchor',
      label: '域锚定率',
      value: `${summary.anchoredEntities}/${summary.domainEntities}`,
      detail: `${anchorPct}% · 目标 ≥60%`,
      status: anchorPct >= 60 ? 'ok' : anchorPct >= 30 ? 'warn' : 'risk',
    },
    {
      key: 'processMounted',
      label: '流程挂载率',
      value: `${summary.l3Covered}/${summary.l3Total}`,
      detail: `${processPct}% · 目标 ≥50%`,
      status: processPct >= 50 ? 'ok' : processPct > 0 ? 'warn' : 'risk',
    },
    {
      key: 'interviewComplete',
      label: '四问完整率',
      value: `${summary.completeRecords}/${summary.interviewRecords}`,
      detail: `${completePct}% · 目标 ≥60%`,
      status: completePct >= 60 ? 'ok' : completePct > 0 ? 'warn' : 'risk',
    },
    {
      key: 'consistency',
      label: '一致性风险',
      value: `${consistencyCount}`,
      detail: `违规映射 ${summary.violatedMappings} · 未挂载访谈 ${summary.unmountedInterviewCodes.length}`,
      status: consistencyCount === 0 ? 'ok' : consistencyCount <= 3 ? 'warn' : 'risk',
    },
  ]
}

function firstIncompleteCode(interviews: InterviewRecord[]): string | undefined {
  const record = interviews.find(rec => {
    const a = rec.answers ?? {}
    const roleOk = Boolean(a.hasRole?.value && a.hasRole.roleRef)
    const objectOk = Boolean(a.hasObject?.value && a.hasObject.entityId && a.hasObject.op)
    return !roleOk || !objectOk
  })
  return record?.apqcCode
}

function gateActions(stage: AgentStage, summary: AgentInputsSummary, input: AgentOverviewInput): AgentAction[] {
  switch (stage) {
    case 'prep':
      if (input.suite.entities.length === 0) {
        return [{
          id: 'anchor-entities',
          priority: 'P0',
          title: '先让套件有可工作的实体',
          why: '当前套件实体为 0，无法锚定或访谈；先导入/选择套件。',
          count: 0,
          cta: { label: '去套件管理', tab: 'suites' },
        }]
      }
      if (!input.framework) {
        return [{
          id: 'anchor-entities',
          priority: 'P0',
          title: '锁定流程框架',
          why: '当前套件未解析到可用框架，覆盖度与编号都无从计算。',
          cta: { label: '去套件管理', tab: 'suites' },
        }]
      }
      return []
    case 'diagnose': {
      const missing = Math.max(0, 3 - summary.confirmedDecisions)
      return [{
        id: 'resolve-decisions',
        priority: 'P1',
        title: '把诊断结论落到决策台账',
        why: `已确认痛点 ${summary.confirmedDecisions}/3 条，还差 ${missing} 条需要客户确认。`,
        count: missing,
        cta: { label: '去台账登记', tab: 'agent' },
      }]
    }
    case 'flow': {
      if (summary.domainAnchorRate < 0.6) {
        const need = summary.domainEntities > 0
          ? Math.max(0, Math.ceil(summary.domainEntities * 0.6) - summary.anchoredEntities)
          : 0
        return [{
          id: 'anchor-entities',
          priority: 'P0',
          title: '补齐 L1/L2 域锚定',
          why: `域锚定 ${summary.anchoredEntities}/${summary.domainEntities}（${Math.round(summary.domainAnchorRate * 100)}%），至少还需 ${need} 条才能达到 60%。`,
          count: need,
          cta: { label: '去实体表锚定', tab: 'suites' },
        }]
      }
      if (summary.mountedFlowCount === 0) {
        if (summary.interviewRecords > 0) {
          const code = input.interviews[0]?.apqcCode
          return [{
            id: 'generate-flow-draft',
            priority: 'P1',
            title: '用已访谈记录生成第一张流程草稿',
            why: `已有 ${summary.interviewRecords} 条访谈记录，但还没有挂载的流程图。`,
            count: summary.interviewRecords,
            cta: { label: '生成画板草稿', tab: 'flowchart', code },
          }]
        }
        const code = summary.gapList[0]?.code
        return [{
          id: 'interview-gaps',
          priority: 'P1',
          title: '从覆盖缺口开始第一场访谈',
          why: summary.gapList.length
            ? `流程轴仍有 ${summary.gapList.length} 个 L3 未挂载，先访谈「${summary.gapList[0].label}」。`
            : '还没有访谈记录，先选一个 L3 做四问。',
          count: summary.gapList.length,
          cta: { label: '去访谈清单', tab: 'interview', code },
        }]
      }
      return []
    }
    case 'semantic': {
      if (summary.violatedMappings > 0) {
        return [{
          id: 'fix-mapping',
          priority: 'P0',
          title: '先修正违规映射',
          why: `存在 ${summary.violatedMappings} 条不符合 kind 分流的映射，语义固化不能带着它们完成。`,
          count: summary.violatedMappings,
          cta: { label: '去覆盖度查看', tab: 'coverage' },
        }]
      }
      if (summary.interviewRecords === 0) {
        const code = summary.gapList[0]?.code
        return [{
          id: 'interview-gaps',
          priority: 'P0',
          title: '开始四问访谈',
          why: '还没有任何访谈记录，无法形成角色/对象/规则。',
          count: 0,
          cta: { label: '去访谈清单', tab: 'interview', code },
        }]
      }
      if (summary.completeRate < 0.6) {
        const code = firstIncompleteCode(input.interviews)
        return [{
          id: 'complete-four-questions',
          priority: 'P1',
          title: '补齐缺角色/对象的访谈记录',
          why: `四问完整 ${summary.completeRecords}/${summary.interviewRecords}（${Math.round(summary.completeRate * 100)}%），至少需到 60%。`,
          count: summary.interviewRecords - summary.completeRecords,
          cta: { label: '去补四问', tab: 'interview', code },
        }]
      }
      return []
    }
    case 'validate': {
      const kinds = ['minutes', 'crud', 'gap', 'domain'] as const
      const missing = kinds.filter(k => !input.state.exports.some(e => e.kind === k))
      if (!missing.length) return []
      return [{
        id: 'export-deliverables',
        priority: 'P2',
        title: '导出四类交付物',
        why: `还缺 ${missing.length} 类：${missing.join(' / ')}。`,
        count: missing.length,
        cta: { label: '去交付物中心', tab: 'agent' },
      }]
    }
    case 'handoff': {
      const hasPackage = input.state.exports.some(e => e.kind === 'package')
      const hasLedger = input.state.exports.some(e => e.kind === 'ledger')
      if (hasPackage && hasLedger) return []
      return [{
        id: 'export-deliverables',
        priority: 'P2',
        title: '完成回带材料',
        why: `数据包${hasPackage ? '已导出' : '未导出'}，决策台账${hasLedger ? '已导出' : '未导出'}。`,
        count: (hasPackage ? 0 : 1) + (hasLedger ? 0 : 1),
        cta: { label: '去导出', tab: 'agent' },
      }]
    }
  }
}

function buildRisks(summary: AgentInputsSummary, input: AgentOverviewInput): AgentRisk[] {
  const risks: AgentRisk[] = []
  if (summary.violatedMappings > 0) {
    risks.push({
      id: 'violated-mappings',
      title: `${summary.violatedMappings} 条违规映射`,
      detail: '名词轴实体映射到 L3+，或动词轴映射到 L1/L2；只标记不删除，需人工迁移。',
      count: summary.violatedMappings,
      tab: 'coverage',
    })
  }
  if (summary.unmountedInterviewCodes.length > 0) {
    risks.push({
      id: 'unmounted-interviews',
      title: `${summary.unmountedInterviewCodes.length} 个已访谈节点未挂载流程`,
      detail: `例如 ${summary.unmountedInterviewCodes.slice(0, 3).join('、')}；访谈结论还没有变成可看的流程。`,
      count: summary.unmountedInterviewCodes.length,
      tab: 'interview',
      code: summary.unmountedInterviewCodes[0],
    })
  }
  if (summary.pendingDecisions > 0) {
    risks.push({
      id: 'pending-decisions',
      title: `${summary.pendingDecisions} 条待确认口径`,
      detail: '决策台账中仍有 pending 项，换人/下次进场前必须闭环。',
      count: summary.pendingDecisions,
      tab: 'agent',
    })
  }
  if (summary.interviewRecords === 0 && input.flows.length > 0) {
    risks.push({
      id: 'no-interviews',
      title: '有流程画板但没有访谈记录',
      detail: `${input.flows.length} 张画板尚未经过四问确认，角色/对象可能来自推测。`,
      count: input.flows.length,
      tab: 'interview',
    })
  }
  return risks
}

export function buildAgentOverview(input: AgentOverviewInput): AgentOverview {
  const summary = summarizeAgentInputs(input)
  const gates = buildGates(summary, input)

  const currentIdx = AGENT_STAGES.indexOf(input.state.stage)
  const currentGate = gates.find(g => g.stage === input.state.stage)
  const nextStage = currentGate?.passed && currentIdx >= 0 && currentIdx < AGENT_STAGES.length - 1
    ? AGENT_STAGES[currentIdx + 1]
    : null
  // 门禁未达成 → 解锁当前阶段；已达成 → 给出下一阶段的准备动作
  const actions = gateActions(nextStage ?? input.state.stage, summary, input)
  const risks = buildRisks(summary, input)

  return {
    suiteId: input.suite.meta.suiteId,
    stage: input.state.stage,
    stageLabel: STAGE_LABELS[input.state.stage],
    state: input.state,
    gates,
    metrics: buildMetrics(summary),
    actions,
    risks,
    nextStage,
  }
}
