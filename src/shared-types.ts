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
}

export interface FlowchartData {
  id: string
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: number
  updatedAt: number
}

export interface FlowchartMeta {
  id: string
  name: string
  nodeCount: number
  edgeCount: number
  createdAt: number
  updatedAt: number
}