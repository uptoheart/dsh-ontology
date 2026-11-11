import type { AppPack, KindMeta, RelationMeta } from '../../kernel/types.js'
import { DOMAIN_KINDS, PROCESS_KINDS } from '../../shared-types.js'

const DOMAIN_LABELS: Record<string, string> = {
  AGGREGATE_ROOT: '聚合根',
  ENTITY: '实体',
  DATA_DICTIONARY: '数据字典',
  RULE: '规则',
  ACTOR: '参与者',
  ROLE: '角色',
  REPORT: '报表',
}

const PROCESS_LABELS: Record<string, string> = {
  FLOW: '流程',
  ACTIVITY: '活动',
}

const OTHER_KINDS: KindMeta[] = [
  { kind: 'BEHAVIOR', label: '行为', appId: 'pcf', axis: 'none', color: '#8b5cf6' },
  { kind: 'PERMISSION', label: '权限', appId: 'pcf', axis: 'none', color: '#f59e0b' },
  { kind: 'UI_MENU', label: '菜单', appId: 'pcf', axis: 'none', color: '#0ea5e9' },
  { kind: 'UI_SCREEN', label: '界面', appId: 'pcf', axis: 'none', color: '#06b6d4' },
  { kind: 'DANGLING_REF', label: '悬空引用', appId: 'pcf', axis: 'none', color: '#ef4444' },
]

const kinds: KindMeta[] = [
  ...DOMAIN_KINDS.map(k => ({
    kind: k as string,
    label: DOMAIN_LABELS[k] ?? (k as string),
    appId: 'pcf',
    axis: 'domain' as const,
    color: '#2563eb',
  })),
  ...PROCESS_KINDS.map(k => ({
    kind: k as string,
    label: PROCESS_LABELS[k] ?? (k as string),
    appId: 'pcf',
    axis: 'process' as const,
    color: '#059669',
  })),
  ...OTHER_KINDS,
]

const RELATION_LABELS: Record<string, string> = {
  REFERENCE: '引用',
  AGGREGATE_OWN_ENTITY: '聚合根拥有实体',
  OWNED_BY: '归属',
  USES_RULE: '使用规则',
  RULE_USED_BY: '规则被使用',
  TRIGGERS_BEHAVIOR: '触发行为',
  HAS_ROLE: '拥有角色',
  HAS_PERMISSION: '拥有权限',
  PERMISSION_TARGET: '权限目标',
  FLOW_CONTAINS_ACTIVITY: '流程包含活动',
  ACTIVITY_NEXT: '活动后继',
  ACTIVITY_CALLS_BEHAVIOR: '活动调用行为',
  ACTIVITY_ROLE: '活动执行角色',
  ACTIVITY_OPERATES_OBJECT: '活动操作对象',
  FLOW_BUSINESS_OBJECT: '流程业务对象',
  FLOW_ROLE: '流程角色',
  REPORT_SOURCE_OBJECT: '报表来源对象',
  REPORT_JOIN: '报表关联',
  REPORT_BEHAVIOR: '报表行为',
  MENU_CONTAINS_MENU: '菜单包含菜单',
  MENU_SCREEN: '菜单指向界面',
  CUSTOM: '自定义',
}

const relations: RelationMeta[] = Object.entries(RELATION_LABELS).map(([type, label]) => ({
  type,
  label,
  appId: 'pcf',
  directed: true,
}))

export const PCF_APP_PACK: AppPack = {
  id: 'pcf',
  name: '产品碳足迹 / 流程本体',
  description: 'APQC / 华为风格流程框架下的流程本体与覆盖度分析',
  kinds,
  relations,
  views: [
    { id: 'framework', label: '流程地图', kind: 'tree', appId: 'pcf' },
    { id: 'flowchart', label: '流程画板', kind: 'graph', appId: 'pcf' },
    { id: 'interview', label: '访谈清单', kind: 'table', appId: 'pcf' },
    { id: 'ontology', label: '本体图谱', kind: 'graph', appId: 'pcf' },
    { id: 'coverage', label: '覆盖度', kind: 'dashboard', appId: 'pcf' },
  ],
}
