// ──────────────────────────────────────────────────────────────────────
// 化工安全应用：数据模型（规则 AST / 评分 / 事件 / 根因）
// 本文件属于应用层，可自由使用行业字面量
// ──────────────────────────────────────────────────────────────────────

export type SafetyGrade = 'red' | 'orange' | 'yellow' | 'blue'

export type SpecialOperationType =
  | '动火'
  | '受限空间'
  | '高处'
  | '吊装'
  | '临时用电'
  | '断路'
  | '盲板抽堵'
  | '检维修'
  | '其他'

// ─────────────── 规则 AST ───────────────

export type ConditionExpr =
  | { op: 'and'; items: ConditionExpr[] }
  | { op: 'or'; items: ConditionExpr[] }
  | { op: 'not'; item: ConditionExpr }
  | {
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists'
      field: string
      value?: unknown
    }
  | { op: 'related'; relation: string; targetKind?: string; minCount?: number }
  | { op: 'missingRelation'; relation: string; targetKind?: string }

export type RuleEffectKind = 'violation' | 'risk_boost' | 'control_required' | 'permit_required'
export type RuleSeverity = 'general' | 'major' | 'fatal'

export interface SafetyRule {
  id: string
  name: string
  version: string
  sourceClauseIds: string[]
  scope: {
    entityKinds: string[]
    areaTags?: string[]
    operationTypes?: SpecialOperationType[]
  }
  condition: ConditionExpr
  effect: {
    kind: RuleEffectKind
    severity: RuleSeverity
    riskDelta?: number
    message: string
  }
  weight: number
  enabled: boolean
  effectiveFrom?: string
  effectiveTo?: string
}

export interface RuleHit {
  ruleId: string
  ruleName: string
  entityId: string
  severity: RuleSeverity
  effectKind: RuleEffectKind
  riskDelta: number
  message: string
  evidences: {
    clauseIds?: string[]
    relationIds?: string[]
    propertyPath?: string
  }
}

// ─────────────── 评分模型 ───────────────

export interface LecEntry {
  /** 作业类型或设备类别 */
  key: string
  L: number
  E: number
  C: number
}

export interface ScoreModel {
  version: string
  weights: {
    /** A 层：固有风险（LEC） */
    lec: number
    /** B 层：危险源规模（GB18218） */
    hazard: number
    /** C 层：管控有效性（双重预防） */
    compliance: number
    /** 自定义指标 */
    indicator: number
    /** D 层：子节点聚合（设备/作业 → 装置 → 区域 → 厂区） */
    propagation: number
  }
  grades: { red: number; orange: number; yellow: number }
  /** 短板封顶：子节点含红/橙时父节点上限 */
  caps: { ifChildRed: number; ifChildOrange: number }
  /** 传播权重 */
  propagationWeights: { headcount: number; stock: number; output: number }
  /** 因果分析最大深度 */
  rcaMaxDepth: number
  /** 根因可控性权重 */
  controllability: { engineering: number; management: number; training: number }
}

export interface ScoreComponentResult {
  id: string
  label: string
  score: number
  weight: number
  applicable: boolean
  penalties: ScorePenalty[]
}

export interface ScorePenalty {
  layer: 'A' | 'B' | 'C' | 'D' | 'indicator'
  refType: 'rule' | 'clause' | 'incident' | 'child'
  refId: string
  delta: number
  message: string
}

export interface ScoreEvidences {
  relationId?: string
  clauseId?: string
  ruleId?: string
  propertyPath?: string
}

export interface ScoreResult {
  entityId: string
  entityName: string
  kind: string
  score: number
  grade: SafetyGrade
  components: ScoreComponentResult[]
  penalties: ScorePenalty[]
  evidences: ScoreEvidences[]
  modelVersion: string
}

export interface PlantAssessment {
  id: string
  suiteId: string
  createdAt: number
  modelVersion: string
  plant: ScoreResult
  areas: ScoreResult[]
  units: ScoreResult[]
  equipments: ScoreResult[]
  operations: ScoreResult[]
  ruleHits: RuleHit[]
  summary: {
    red: number
    orange: number
    yellow: number
    blue: number
    total: number
  }
}

// ─────────────── 事件与根因 ───────────────

export interface SafetyIncident {
  id: string
  suiteId: string
  title: string
  occurredAt: string
  eventEntityId?: string
  areaCode?: string
  unitCode?: string
  equipmentCode?: string
  operationCode?: string
  category?: '人' | '机' | '料' | '法' | '环'
  consequences: string
  facts: string[]
  /** 已确认的直接原因（人工或规则推导） */
  suspectedCauses?: string[]
  createdAt: number
  updatedAt: number
}

export type ChainNodeType =
  | 'event'
  | 'cause'
  | 'barrier'
  | 'evidence'
  | 'root'

export interface ChainNode {
  id: string
  label: string
  type: ChainNodeType
  category?: '人' | '机' | '料' | '法' | '环'
  unverified?: boolean
  layer: number
  meta?: Record<string, unknown>
}

export interface ChainEdge {
  id: string
  source: string
  target: string
  label?: string
  confidence: number
}

export interface RootCause {
  causeId: string
  causeLabel: string
  rankScore: number
  category: '人' | '机' | '料' | '法' | '环'
  pathCount: number
  evidences: { type: string; refId: string; text: string }[]
}

export interface RcaResult {
  incidentId: string
  graph: { nodes: ChainNode[]; edges: ChainEdge[] }
  roots: RootCause[]
  unverified: string[]
  recommendations: { text: string; targetClauseIds: string[] }[]
  modelVersion: string
  generatedAt: number
}

// ─────────────── 导入 ───────────────

export interface ImportError {
  row: number
  field: string
  message: string
}

export interface ImportReport {
  batchId: string
  kind: 'regulation' | 'clause' | 'asset' | 'operation'
  created: number
  skipped: number
  errors: ImportError[]
  at: number
}
