// ──────────────────────────────────────────────────────────────────────
// 内核契约：应用包与应用无关的类型声明
// 本目录不得出现任何行业/应用字面量（实体类型前缀、应用 ID 等）
// ──────────────────────────────────────────────────────────────────────

export type AppId = string

/** 实体类型在套件中的归属轴（PCF 双轴复用；其余应用一律 none） */
export type Axis = 'domain' | 'process' | 'none'

export interface KindMeta {
  kind: string
  label: string
  appId: AppId
  axis: Axis
  color?: string
  group?: string
}

export interface RelationMeta {
  type: string
  label: string
  appId: AppId
  directed?: boolean
}

/** 应用声明的 UI 视图（前端按此渲染页签） */
export interface ViewDeclaration {
  id: string
  label: string
  kind: 'graph' | 'table' | 'tree' | 'dashboard' | 'chain' | 'sandbox'
  appId: AppId
}

export interface AppPack {
  id: AppId
  name: string
  description?: string
  kinds: KindMeta[]
  relations: RelationMeta[]
  views?: ViewDeclaration[]
}

export interface AppSummary {
  id: AppId
  name: string
  description?: string
  kindCount: number
  relationCount: number
  views: ViewDeclaration[]
}

export function summarizeApp(pack: AppPack): AppSummary {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    kindCount: pack.kinds.length,
    relationCount: pack.relations.length,
    views: pack.views ?? [],
  }
}

// ──────────────────────────────────────────────────────────────────────
// 内核端口契约（后续阶段实现填充；先固化边界，防止内核反向依赖应用）
// ──────────────────────────────────────────────────────────────────────

export interface GraphQueryPort {
  neighbors(id: string): string[]
  outgoing(id: string): { target: string; type: string }[]
  incoming(id: string): { source: string; type: string }[]
  hasRelation(from: string, to: string, type?: string): boolean
  path(from: string, to: string, maxDepth?: number): string[] | null
}

export interface Kernel {
  graph: GraphQueryPort
}
