import type { AppPack, KindMeta, RelationMeta, ViewDeclaration } from '../../kernel/types.js'

const kind = (k: string, label: string, color: string, group: string): KindMeta => ({
  kind: k,
  label,
  appId: 'chemical-safety',
  axis: 'none',
  color,
  group,
})

const relation = (type: string, label: string): RelationMeta => ({
  type,
  label,
  appId: 'chemical-safety',
  directed: true,
})

const kinds: KindMeta[] = [
  kind('SAFETY_REGULATION', '法规/标准', '#1e40af', '法规体系'),
  kind('SAFETY_CLAUSE', '条款', '#3b82f6', '法规体系'),
  kind('SAFETY_CHECK_ITEM', '检查项', '#93c5fd', '法规体系'),
  kind('SAFETY_AREA', '区域', '#b45309', '资产'),
  kind('SAFETY_UNIT', '装置', '#d97706', '资产'),
  kind('SAFETY_EQUIPMENT', '设备', '#f59e0b', '资产'),
  kind('SAFETY_MATERIAL', '物料', '#ca8a04', '资产'),
  kind('SAFETY_OPERATION', '作业', '#7c3aed', '作业'),
  kind('SAFETY_PERMIT', '作业票', '#a855f7', '作业'),
  kind('SAFETY_HAZARD', '危险源', '#dc2626', '风险'),
  kind('SAFETY_CONTROL', '管控措施', '#16a34a', '风险'),
  kind('SAFETY_EVENT', '事件', '#991b1b', '事件'),
  kind('SAFETY_CAUSE', '原因', '#7f1d1d', '事件'),
]

const relations: RelationMeta[] = [
  relation('SAFETY_REG_CONTAINS_CLAUSE', '法规包含条款'),
  relation('SAFETY_CLAUSE_APPLIES_TO', '条款适用于'),
  relation('SAFETY_CLAUSE_REQUIRES_CONTROL', '条款要求措施'),
  relation('SAFETY_AREA_CONTAINS_UNIT', '区域包含装置'),
  relation('SAFETY_UNIT_CONTAINS_EQUIPMENT', '装置包含设备'),
  relation('SAFETY_EQUIPMENT_HANDLES_MATERIAL', '设备涉及物料'),
  relation('SAFETY_OPERATION_IN_AREA', '作业位于区域'),
  relation('SAFETY_OPERATION_ON_EQUIPMENT', '作业作用于设备'),
  relation('SAFETY_OPERATION_REQUIRES_PERMIT', '作业需要票证'),
  relation('SAFETY_OPERATION_HAS_HAZARD', '作业存在危险源'),
  relation('SAFETY_EQUIPMENT_HAS_HAZARD', '设备存在危险源'),
  relation('SAFETY_CONTROL_MITIGATES_HAZARD', '措施管控危险源'),
  relation('SAFETY_CHECK_VERIFIES_CLAUSE', '检查项验证条款'),
  relation('SAFETY_EVENT_OCCURS_AT', '事件发生于'),
  relation('SAFETY_EVENT_INVOLVES', '事件涉及'),
  relation('SAFETY_EVENT_CAUSED_BY', '事件起因于'),
  relation('SAFETY_RISK_PROPAGATES_TO', '风险传导至'),
]

const views: ViewDeclaration[] = [
  { id: 'safety-overview', label: '安全总览', kind: 'dashboard', appId: 'chemical-safety' },
  { id: 'safety-regulation', label: '法规库', kind: 'tree', appId: 'chemical-safety' },
  { id: 'safety-asset', label: '资产台账', kind: 'tree', appId: 'chemical-safety' },
  { id: 'safety-operation', label: '作业分析', kind: 'table', appId: 'chemical-safety' },
  { id: 'safety-assessment', label: '安全评级', kind: 'dashboard', appId: 'chemical-safety' },
  { id: 'safety-rca', label: '根因分析', kind: 'chain', appId: 'chemical-safety' },
]

export const SAFETY_APP_PACK: AppPack = {
  id: 'chemical-safety',
  name: '化工安全',
  description: '国家安全法规 + 企业设备与作业 + 厂区安全评级 + 根因链路分析',
  kinds,
  relations,
  views,
}
