// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：类型定义（确定性内核，不依赖模型服务）
// ──────────────────────────────────────────────────────────────────────

import type { EntityKind } from '../shared-types.js'

/** 六个操作环节：进场准备 → 诊断对齐 → 流程显影 → 语义固化 → 应用验证 → 回带沉淀 */
export type AgentStage = 'prep' | 'diagnose' | 'flow' | 'semantic' | 'validate' | 'handoff'

export const AGENT_STAGES: readonly AgentStage[] = ['prep', 'diagnose', 'flow', 'semantic', 'validate', 'handoff']

export const STAGE_LABELS: Record<AgentStage, string> = {
  prep: '进场准备',
  diagnose: '诊断对齐',
  flow: '流程显影',
  semantic: '语义固化',
  validate: '应用验证',
  handoff: '回带沉淀',
}

export type AgentDecisionStatus = 'pending' | 'confirmed'

export interface AgentDecision {
  id: string
  stage: AgentStage
  topic: string
  question: string
  answer: string
  status: AgentDecisionStatus
  createdAt: number
  updatedAt: number
}

export type AgentExportKind = 'minutes' | 'crud' | 'gap' | 'domain' | 'ledger' | 'package'

export const AGENT_EXPORT_KINDS: readonly AgentExportKind[] = ['minutes', 'crud', 'gap', 'domain', 'ledger', 'package']

export interface AgentExportRecord {
  kind: AgentExportKind
  at: number
}

export interface AgentState {
  suiteId: string
  stage: AgentStage
  decisions: AgentDecision[]
  exports: AgentExportRecord[]
  updatedAt: number
}

export type AgentNavTab =
  | 'suites' | 'framework' | 'flowchart' | 'interview' | 'ontology' | 'coverage' | 'agent'

export interface AgentMetricFact {
  key: 'domainAnchor' | 'processMounted' | 'interviewComplete' | 'consistency'
  label: string
  /** 主展示值，如 "12/20" */
  value: string
  /** 补充口径，如 "60%" */
  detail: string
  status: 'ok' | 'warn' | 'risk'
}

export interface AgentGate {
  stage: AgentStage
  label: string
  passed: boolean
  /** 通过条件的当前值与目标 */
  criteria: string
}

export interface AgentActionCta {
  label: string
  tab: AgentNavTab
  code?: string
  exportKind?: string
}

export interface AgentAction {
  id:
    | 'anchor-entities'
    | 'fix-mapping'
    | 'interview-gaps'
    | 'complete-four-questions'
    | 'generate-flow-draft'
    | 'resolve-decisions'
    | 'export-deliverables'
  priority: 'P0' | 'P1' | 'P2'
  title: string
  /** 必须带数据依据 */
  why: string
  count?: number
  cta: AgentActionCta
}

export interface AgentRisk {
  id: string
  title: string
  detail: string
  count: number
  tab: AgentNavTab
  code?: string
}

export interface AgentOverview {
  suiteId: string
  stage: AgentStage
  stageLabel: string
  /** 当前持久化状态（台账与导出记录随概览一次返回） */
  state: AgentState
  gates: AgentGate[]
  metrics: AgentMetricFact[]
  actions: AgentAction[]
  risks: AgentRisk[]
  /** 当前门禁已达成时的下一阶段；为空表示未达成或已是最后阶段 */
  nextStage: AgentStage | null
}

export interface AgentQuestion {
  id: 'role' | 'object' | 'rule' | 'behavior'
  title: string
  ask: string
  why: string
  probes: string[]
}

export interface AgentQuestionSet {
  code: string
  label: string
  path: string[]
  customerContext: string
  questions: AgentQuestion[]
  suggestedEntities: { id: string; name: string; kind: EntityKind }[]
  suggestedRules: string[]
  warnings: string[]
}

export type AgentPromptScene = 'diagnose' | 'interview' | 'model' | 'validate' | 'handoff'

export const AGENT_PROMPT_SCENES: readonly AgentPromptScene[] = ['diagnose', 'interview', 'model', 'validate', 'handoff']

export interface AgentPrompt {
  scene: AgentPromptScene
  title: string
  content: string
}
