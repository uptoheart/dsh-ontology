// ──────────────────────────────────────────────────────────────────────
// 统一 Ontology 类型定义
// ──────────────────────────────────────────────────────────────────────

export type EntityKind =
  | 'AGGREGATE_ROOT'
  | 'ENTITY'
  | 'DATA_DICTIONARY'
  | 'BEHAVIOR'
  | 'RULE'
  | 'ACTOR'
  | 'ROLE'
  | 'PERMISSION'
  | 'FLOW'
  | 'ACTIVITY'
  | 'REPORT'
  | 'UI_MENU'
  | 'UI_SCREEN'
  | 'DANGLING_REF'

// ──────────────────────────────────────────────────────────────────────
// APQC 映射按 kind 分流（名词层 vs 动词层）
// 规则：DOMAIN_KINDS 只允许映射 L1/L2；PROCESS_KINDS 只允许映射 L3-L5；
//       其余 kind（BEHAVIOR / UI_MENU / UI_SCREEN 等）暂不参与 APQC 映射。
// UI 录入限制与覆盖度计算分流双重执行。
// ──────────────────────────────────────────────────────────────────────

/** 名词层：允许映射到 L1/L2 的实体 kind */
export const DOMAIN_KINDS: readonly EntityKind[] = [
  'AGGREGATE_ROOT', 'ENTITY', 'DATA_DICTIONARY', 'RULE', 'ACTOR', 'ROLE', 'REPORT',
]
/** 动词层：允许映射到 L3-L5 的实体 kind */
export const PROCESS_KINDS: readonly EntityKind[] = ['FLOW', 'ACTIVITY']

export type MappingAxis = 'domain' | 'process' | 'none'

export function mappingAxisOfKind(kind: EntityKind): MappingAxis {
  if ((DOMAIN_KINDS as readonly string[]).includes(kind)) return 'domain'
  if ((PROCESS_KINDS as readonly string[]).includes(kind)) return 'process'
  return 'none'
}

export function levelNumOfCode(code: string): number {
  return code.split('.').map(s => s.trim()).filter(Boolean).length
}

export type RelationType =
  | 'REFERENCE'
  | 'AGGREGATE_OWN_ENTITY'
  | 'OWNED_BY'
  | 'USES_RULE'
  | 'RULE_USED_BY'
  | 'TRIGGERS_BEHAVIOR'
  | 'HAS_ROLE'
  | 'HAS_PERMISSION'
  | 'PERMISSION_TARGET'
  | 'FLOW_CONTAINS_ACTIVITY'
  | 'ACTIVITY_NEXT'
  | 'ACTIVITY_CALLS_BEHAVIOR'
  | 'ACTIVITY_ROLE'
  | 'ACTIVITY_OPERATES_OBJECT'
  | 'FLOW_BUSINESS_OBJECT'
  | 'FLOW_ROLE'
  | 'REPORT_SOURCE_OBJECT'
  | 'REPORT_JOIN'
  | 'REPORT_BEHAVIOR'
  | 'MENU_CONTAINS_MENU'
  | 'MENU_SCREEN'
  | 'CUSTOM'

export interface OntologyEntity {
  id: string
  rawId: string
  name: string
  alias?: string
  kind: EntityKind
  domain: string
  description?: string
  sourceFile: string
  properties: Record<string, unknown>
}

export interface OntologyRelation {
  id: string
  from: string
  to: string
  type: RelationType
  label?: string
  properties?: Record<string, unknown>
}

export interface OntologySuiteMeta {
  suiteId: string
  domain: string
  project?: string
  sourceRequirements?: string
  sourceDir: string
  importTime: number
  sourceMtime: number
  sourceFileCount: number
  entityCount: number
  relationCount: number
  /** 项目级锁定的流程框架（缺省 'apqc-process'，旧套件零迁移）；切换 = 重新锚定实体 */
  frameworkId?: string
}

export interface FrameMapping {
  frameworkId: string
  apqcCode?: string
  domainCode?: string
  levelCode?: string
  note?: string
}

export type CoverageStatus = 'covered' | 'partial' | 'gap' | 'unset'

export interface CoverageMark {
  status: CoverageStatus
  note?: string
  updatedAt: number
}

export interface OntologyAnnotations {
  entityFrameMapping: Record<string, FrameMapping>
  coverageMarks: Record<string, CoverageMark>
  customRelations: OntologyRelation[]
}

export interface SuiteData {
  entities: OntologyEntity[]
  relations: OntologyRelation[]
  meta: OntologySuiteMeta
  annotations: OntologyAnnotations
}

export interface FrameworkLevel {
  id: string
  name: string
  label: string
  apqcCode?: string
  order: number
}

export interface FrameworkNode {
  code: string
  name: string
  label: string
  levelId: string
  pcfId?: string
  definition?: string
  children?: FrameworkNode[]
}

export interface FrameworkDomain {
  id: string
  code: string
  name: string
  label: string
  pcfId?: string
  definition?: string
  children: FrameworkNode[]
}

export interface FrameworkDefinition {
  frameworkId: string
  name: string
  source: string
  version?: string
  description?: string
  levels: FrameworkLevel[]
  domains: FrameworkDomain[]
  numberingTemplate?: string
}

export interface FrameworkLeafNode {
  code: string
  name: string
  label: string
  levelId: string
  path: string[]
  pathLabels: string[]
  domainCode: string
  domainId: string
}

export interface GraphNode {
  id: string
  rawId: string
  name: string
  kind: EntityKind
  domain: string
  group: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: RelationType
  label?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface CoverageCell {
  domainId: string
  domainName: string
  levelId: string
  levelLabel: string
  entityCount: number
  coveredCount: number
  partialCount: number
  gapCount: number
  entities: string[]
}

export interface CoverageNodeInfo {
  code: string
  name: string
  label: string
  levelId: string
  entityCount: number
  coveredCount: number
  partialCount: number
  gapCount: number
  status: CoverageStatus
  entities: string[]
  children?: CoverageNodeInfo[]
}

export interface CoverageMatrix {
  frameworkId: string
  suiteId: string
  domains: FrameworkDomain[]
  levels: FrameworkLevel[]
  cells: CoverageCell[]
  totalEntities: number
  leafTotal: number
  leafCovered: number
  leafPartial: number
  leafGap: number
  leafUnset: number
  tree: CoverageNodeInfo[]
  /** 域轴：实际参与域覆盖统计的实体数（kind 分流后） */
  domainEntityCount?: number
  /** 全深度覆盖树（APQC 地图页导航用）：L1/L2 节点聚合域轴实体，L3+ 节点聚合流程轴实体 */
  fullTree?: CoverageNodeInfo[]
  /** 违规存量映射（不符合 kind 分流规则，仅标记不删除，待人工迁移） */
  violatedMappings?: ViolatedMapping[]
  /** 流程覆盖度（P2 起自动推导；null = 无数据） */
  process?: ProcessCoverageMatrix | null
}

/** 不符合 kind 分流规则的存量映射 */
export interface ViolatedMapping {
  entityId: string
  entityName: string
  kind: EntityKind
  apqcCode: string
  levelId: string
  reason: string
}

/** 流程覆盖度（动词轴，由流程挂载与参与关系自动推导，只读） */
export interface ProcessCoverageMatrix {
  frameworkId: string
  suiteId: string
  /** 裁剪后的覆盖树：仅保留有流程活动的 L3+ 分支（L1/L2 为结构容器） */
  tree: CoverageNodeInfo[]
  l3Total: number
  l3Covered: number
  l3Partial: number
  l3Unmounted: number
  /** 已挂载的流程图清单 */
  mountedFlows: {
    flowId: string
    name: string
    apqcCode: string
    nodeCount: number
    participationCount: number
    updatedAt: number
  }[]
  /** 未挂载 L3 清单（访谈/画板的工作入口） */
  gapList: { code: string; label: string; path: string[] }[]
}

// ──────────────────────────────────────────────────────────────────────
// 访谈记录（四问 checklist，现场记录一键转参与关系）
// ──────────────────────────────────────────────────────────────────────

export interface InterviewAnswer {
  value: boolean
  roleRef?: string
  entityId?: string
  op?: FlowOp
  ruleRef?: string
  behaviorRef?: string
  note?: string
}

export interface InterviewRecord {
  id: string
  suiteId: string
  /** 被访谈的 L3/L4 节点编号 */
  apqcCode: string
  answers: {
    hasRole?: InterviewAnswer
    hasObject?: InterviewAnswer
    hasRule?: InterviewAnswer
    hasBehavior?: InterviewAnswer
  }
  /** 记录级备注（客户原话、口径说明等） */
  note?: string
  createdAt: number
  updatedAt: number
}

// ──────────────────────────────────────────────────────────────────────
// CRUD 矩阵（实体 × 流程/活动，FDE 交付物视图）
// ──────────────────────────────────────────────────────────────────────

export interface CrudMatrix {
  suiteId: string
  columns: { flowId: string; name: string; apqcCode?: string }[]
  rows: {
    entityId: string
    entityName: string
    kind: EntityKind
    /** flowId → 该实体在此流程中的 op 列表 */
    cells: Record<string, FlowOp[]>
    opCount: number
  }[]
}

// ──────────────────────────────────────────────────────────────────────
// 域词典（受控词表 = APQC L1/L2 + 别名，实体 domain 归一依据）
// ──────────────────────────────────────────────────────────────────────

export interface DomainDictEntry {
  /** APQC L1/L2 编号，如 "4.0" / "4.3" */
  code: string
  /** 中文名，如 "交付实物产品与服务" */
  label: string
  /** 客户侧叫法，如 ["生产运营", "制造管理"] */
  aliases?: string[]
  level: 'L1' | 'L2'
  /** L2 指向其 L1 */
  parentCode?: string
}

export interface DomainDictionary {
  /** 来源框架，如 'apqc-process' */
  frameworkId: string
  entries: DomainDictEntry[]
  updatedAt: number
}

export interface DatastorageConfig {
  datasourcePath: string
  datastoragePath: string
  defaultFramework: string
  ontologyCodePattern?: string
}

// ──────────────────────────────────────────────────────────────────────
// 流程图（画布节点 + 连线，独立持久化于 datastorage/flowcharts）
// ──────────────────────────────────────────────────────────────────────

export type FlowNodeType = 'task' | 'start' | 'end' | 'decision'

/** 参与关系动词（CRUD + 审批） */
export type FlowOp = 'create' | 'read' | 'update' | 'delete' | 'approve'

export interface FlowNode {
  id: string
  type: FlowNodeType
  /** 任务节点关联的 APQC 编号（可选） */
  code?: string
  label: string
  /** 画布坐标（SVG 用户单位，即像素） */
  x: number
  y: number
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

/** 流程图语义层（画完即沉淀：参与关系 → 本体派生关系 → 覆盖度自动更新） */
export interface FlowSemantics {
  /** key = 节点 id：活动属性（Action 枢纽的角色/守卫/行为引用） */
  activities: Record<string, {
    roleRef?: string
    guardRules?: string[]
    behaviorRefs?: string[]
  }>
  /** 参与关系：画板节点 → 业务对象实体（读取时投影为 ACTIVITY_OPERATES_OBJECT） */
  participations: {
    nodeId: string
    entityId: string
    op: FlowOp
  }[]
}

export interface FlowchartData {
  id: string
  name: string
  /** 归属套件（参与关系桥接的载体；旧数据无此字段时不参与投影） */
  suiteId?: string
  /** 整张流程图挂载的 L3 节点编号 */
  apqcCode?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  semantics?: FlowSemantics
  createdAt: number
  updatedAt: number
}

export interface FlowchartMeta {
  id: string
  name: string
  suiteId?: string
  apqcCode?: string
  nodeCount: number
  edgeCount: number
  participationCount?: number
  createdAt: number
  updatedAt: number
}