import type { EntityKind, OntologyEntity, OntologyRelation, RelationType, SuiteData } from '../../shared-types.js'
import {
  SAFETY_DOMAIN, SAFETY_SUITE_ID, emptyAnnotations, loadSafetySuite, saveIncident,
  saveRules, saveSafetySuite, saveScoreModel,
} from './store.js'
import { DEFAULT_SCORE_MODEL } from './scoring/model.js'
import type { SafetyRule } from './types.js'

const ent = (
  kind: EntityKind,
  id: string,
  name: string,
  properties: Record<string, unknown> = {},
): OntologyEntity => ({
  id, rawId: id, name, kind, domain: SAFETY_DOMAIN, sourceFile: 'seed', properties,
})

const rel = (
  from: string,
  to: string,
  type: RelationType,
  label?: string,
  properties?: Record<string, unknown>,
): OntologyRelation => ({
  id: `${from}--${type}--${to}`, from, to, type, label, properties,
})

// ─────────────── 法规与条款 ───────────────

const REGULATIONS = [
  { code: 'SAFETY-LAW', title: '安全生产法（2021 修正）', type: '法律', issuer: '全国人大常委会' },
  { code: 'HC-REG', title: '危险化学品安全管理条例', type: '行政法规', issuer: '国务院' },
  { code: 'GB30871', title: 'GB 30871-2022 危险化学品企业特殊作业安全规范', type: '国家标准', issuer: '市场监管总局' },
  { code: 'GB18218', title: 'GB 18218-2018 危险化学品重大危险源辨识', type: '国家标准', issuer: '市场监管总局' },
  { code: 'GBT33000', title: 'GB/T 33000-2016 企业安全生产标准化基本规范', type: '国家标准', issuer: '市场监管总局' },
]

const CLAUSES: {
  reg: string; no: string; text: string; mandatory: boolean; appliesTo: string[]; controls: string[]
}[] = [
  { reg: 'GB30871', no: '6.2', text: '动火作业前应进行气体检测，确认可燃气体浓度符合要求。', mandatory: true, appliesTo: ['op:OP-HOT-01', 'eq:EQ-A1-T01'], controls: ['CT-GAS-TEST'] },
  { reg: 'GB30871', no: '6.3', text: '动火作业应办理动火作业票并经审批。', mandatory: true, appliesTo: ['op:OP-HOT-01'], controls: ['CT-PERMIT'] },
  { reg: 'GB30871', no: '6.4', text: '动火作业应设置专人监护。', mandatory: true, appliesTo: ['op:OP-HOT-01'], controls: ['CT-GUARD'] },
  { reg: 'GB30871', no: '8.2', text: '受限空间作业前应进行隔离、清洗、置换。', mandatory: true, appliesTo: ['op:OP-CS-01', 'eq:EQ-A1-T02'], controls: ['CT-ISOLATE'] },
  { reg: 'GB30871', no: '8.3', text: '受限空间作业应检测氧含量与有毒有害气体。', mandatory: true, appliesTo: ['op:OP-CS-01'], controls: ['CT-GAS-TEST'] },
  { reg: 'GB30871', no: '9.2', text: '高处作业应正确佩戴安全带。', mandatory: true, appliesTo: ['op:OP-HW-01'], controls: ['CT-SEATBELT'] },
  { reg: 'GB30871', no: '10.2', text: '吊装作业应设置警戒区域。', mandatory: true, appliesTo: ['op:OP-LIFT-01'], controls: ['CT-BARRICADE'] },
  { reg: 'GB30871', no: '11.2', text: '临时用电应可靠接地。', mandatory: true, appliesTo: ['op:OP-POWER-01'], controls: ['CT-GROUND'] },
  { reg: 'GB30871', no: '12.2', text: '盲板抽堵作业应完成有效隔离。', mandatory: true, appliesTo: ['op:OP-BLIND-01'], controls: ['CT-ISOLATE'] },
  { reg: 'GB30871', no: '5.2', text: '检维修作业前应开展风险分析（JSA）。', mandatory: true, appliesTo: ['op:OP-MAINT-01'], controls: ['CT-JSA'] },
  { reg: 'GB18218', no: '4.1', text: '危险化学品构成重大危险源的应进行辨识。', mandatory: true, appliesTo: ['unit:UNIT-A1', 'area:AREA-A'], controls: ['CT-REGISTER'] },
  { reg: 'GB18218', no: '4.2', text: '重大危险源应按危险程度分级。', mandatory: true, appliesTo: ['unit:UNIT-A1'], controls: ['CT-REGISTER'] },
  { reg: 'GBT33000', no: '5.1', text: '企业应建立风险分级管控机制。', mandatory: false, appliesTo: ['area:AREA-A', 'area:AREA-B'], controls: ['CT-RISK-LIST'] },
  { reg: 'GBT33000', no: '5.2', text: '企业应建立隐患排查治理机制。', mandatory: false, appliesTo: ['area:AREA-A', 'area:AREA-B', 'area:AREA-C'], controls: ['CT-INSPECT'] },
  { reg: 'SAFETY-LAW', no: '40', text: '从业人员应接受安全生产教育和培训。', mandatory: true, appliesTo: ['op:OP-HOT-01', 'op:OP-CS-01', 'op:OP-HW-01'], controls: ['CT-TRAIN'] },
  { reg: 'SAFETY-LAW', no: '44', text: '应为从业人员提供符合标准的劳动防护用品。', mandatory: true, appliesTo: ['op:OP-HW-01', 'op:OP-CS-01'], controls: ['CT-PPE'] },
  { reg: 'SAFETY-LAW', no: '45', text: '危险作业应安排专门人员进行现场安全管理。', mandatory: true, appliesTo: ['op:OP-HOT-01', 'op:OP-CS-01'], controls: ['CT-PERMIT'] },
  { reg: 'HC-REG', no: '24', text: '重大危险源应向应急管理部门备案。', mandatory: true, appliesTo: ['unit:UNIT-A1'], controls: ['CT-REGISTER'] },
]

const CONTROLS = [
  { code: 'CT-GAS-TEST', name: '气体检测', level: 'engineering', implemented: false },
  { code: 'CT-PERMIT', name: '作业票审批', level: 'management', implemented: true },
  { code: 'CT-GUARD', name: '专人监护', level: 'management', implemented: false },
  { code: 'CT-ISOLATE', name: '隔离置换', level: 'engineering', implemented: false },
  { code: 'CT-SEATBELT', name: '安全带', level: 'engineering', implemented: true },
  { code: 'CT-BARRICADE', name: '吊装警戒', level: 'management', implemented: true },
  { code: 'CT-GROUND', name: '临时用电接地', level: 'engineering', implemented: true },
  { code: 'CT-JSA', name: '检维修风险分析', level: 'management', implemented: false },
  { code: 'CT-REGISTER', name: '重大危险源备案', level: 'management', implemented: true },
  { code: 'CT-RISK-LIST', name: '风险分级清单', level: 'management', implemented: true },
  { code: 'CT-INSPECT', name: '隐患排查治理', level: 'management', implemented: true },
  { code: 'CT-TRAIN', name: '安全培训', level: 'training', implemented: false },
  { code: 'CT-PPE', name: '劳动防护用品', level: 'engineering', implemented: true },
]

const HAZARDS = [
  { code: 'H-FLAM', name: '可燃气体', category: '化学', accidentType: '火灾爆炸' },
  { code: 'H-TOXIC', name: '中毒窒息', category: '化学', accidentType: '中毒窒息' },
  { code: 'H-FALL', name: '高处坠落', category: '物理', accidentType: '高处坠落' },
  { code: 'H-MECH', name: '机械伤害', category: '物理', accidentType: '机械伤害' },
  { code: 'H-SHOCK', name: '触电', category: '电气', accidentType: '触电' },
  { code: 'H-OBJ', name: '物体打击', category: '物理', accidentType: '物体打击' },
]

const MATERIALS = [
  { code: 'MAT-TOLUENE', name: '甲苯', cas: '108-88-3', flashPoint: 4, criticalQuantity: 500, hazardClass: '易燃液体' },
  { code: 'MAT-METHANOL', name: '甲醇', cas: '67-56-1', flashPoint: 11, criticalQuantity: 500, hazardClass: '易燃液体' },
  { code: 'MAT-GASOLINE', name: '汽油', cas: '8006-61-9', flashPoint: -50, criticalQuantity: 200, hazardClass: '易燃液体' },
]

const AREAS = [
  { code: 'AREA-A', name: '罐区', riskLevel: '红色', headcount: 30, stock: 1200 },
  { code: 'AREA-B', name: '生产车间', riskLevel: '橙色', headcount: 60, stock: 300 },
  { code: 'AREA-C', name: '公用工程', riskLevel: '黄色', headcount: 20, stock: 50 },
]

const UNITS = [
  { code: 'UNIT-A1', name: '常压储罐区', area: 'AREA-A', process: '储存', stock: 900, headcount: 12 },
  { code: 'UNIT-A2', name: '装卸车区', area: 'AREA-A', process: '装卸', stock: 200, headcount: 8 },
  { code: 'UNIT-B1', name: '反应装置', area: 'AREA-B', process: '反应', stock: 200, headcount: 30 },
  { code: 'UNIT-B2', name: '精馏装置', area: 'AREA-B', process: '精馏', stock: 100, headcount: 20 },
  { code: 'UNIT-C1', name: '公用工程站', area: 'AREA-C', process: '公用工程', stock: 50, headcount: 10 },
]

const EQUIPMENTS = [
  { code: 'EQ-A1-T01', name: '1#储罐', unit: 'UNIT-A1', cls: '常压储罐', inspectionValidUntil: '2026-12-31', status: '在用', material: 'MAT-TOLUENE', stock: 500 },
  { code: 'EQ-A1-T02', name: '2#储罐', unit: 'UNIT-A1', cls: '常压储罐', inspectionValidUntil: '2025-06-30', status: '在用', material: 'MAT-METHANOL', stock: 300 },
  { code: 'EQ-A1-P01', name: '输送泵', unit: 'UNIT-A1', cls: '输送泵', inspectionValidUntil: '2027-03-31', status: '在用', material: undefined, stock: 0 },
  { code: 'EQ-A2-L01', name: '装车鹤管', unit: 'UNIT-A2', cls: '装车鹤管', inspectionValidUntil: '2026-09-30', status: '在用', material: 'MAT-GASOLINE', stock: 100 },
  { code: 'EQ-B1-R01', name: '反应釜', unit: 'UNIT-B1', cls: '反应釜', inspectionValidUntil: '2026-08-31', status: '在用', material: 'MAT-METHANOL', stock: 100 },
  { code: 'EQ-B2-C01', name: '精馏塔', unit: 'UNIT-B2', cls: '精馏塔', inspectionValidUntil: '2026-11-30', status: '在用', material: undefined, stock: 0 },
  { code: 'EQ-C1-U01', name: '空压机', unit: 'UNIT-C1', cls: '空压机', inspectionValidUntil: '2027-01-31', status: '在用', material: undefined, stock: 0 },
]

const OPERATIONS = [
  { code: 'OP-HOT-01', name: '罐区动火作业', type: '动火', area: 'AREA-A', equipments: ['EQ-A1-T01'], permit: 'PTW-HOT-001', hazards: ['H-FLAM', 'H-OBJ'] },
  { code: 'OP-CS-01', name: '储罐受限空间清理', type: '受限空间', area: 'AREA-A', equipments: ['EQ-A1-T02'], permit: 'PTW-CS-002', hazards: ['H-TOXIC'] },
  { code: 'OP-HW-01', name: '反应釜高处检维修', type: '高处', area: 'AREA-B', equipments: ['EQ-B1-R01'], permit: 'PTW-HW-003', hazards: ['H-FALL', 'H-MECH'] },
  { code: 'OP-LIFT-01', name: '空压机吊装作业', type: '吊装', area: 'AREA-C', equipments: ['EQ-C1-U01'], permit: undefined, hazards: ['H-OBJ'] },
  { code: 'OP-POWER-01', name: '精馏塔临时用电', type: '临时用电', area: 'AREA-B', equipments: ['EQ-B2-C01'], permit: undefined, hazards: ['H-SHOCK'] },
  { code: 'OP-BLIND-01', name: '储罐盲板抽堵', type: '盲板抽堵', area: 'AREA-A', equipments: ['EQ-A1-T01'], permit: undefined, hazards: ['H-FLAM', 'H-TOXIC'] },
  { code: 'OP-ROAD-01', name: '厂区断路作业', type: '断路', area: 'AREA-C', equipments: [], permit: undefined, hazards: ['H-MECH'] },
  { code: 'OP-MAINT-01', name: '1#储罐检维修', type: '检维修', area: 'AREA-A', equipments: ['EQ-A1-T01'], permit: undefined, hazards: ['H-FLAM', 'H-MECH'] },
  { code: 'OP-LOAD-01', name: '装卸车作业', type: '其他', area: 'AREA-A', equipments: ['EQ-A2-L01'], permit: undefined, hazards: ['H-FLAM', 'H-TOXIC'] },
  { code: 'OP-FEED-01', name: '反应釜投料', type: '其他', area: 'AREA-B', equipments: ['EQ-B1-R01'], permit: undefined, hazards: ['H-MECH', 'H-TOXIC'] },
]

const PERMITS = [
  { code: 'PTW-HOT-001', name: '动火作业票 PTW-HOT-001', permitType: '动火', valid: true, status: '已批准' },
  { code: 'PTW-CS-002', name: '受限空间作业票 PTW-CS-002', permitType: '受限空间', valid: false, status: '已过期' },
  { code: 'PTW-HW-003', name: '高处作业票 PTW-HW-003', permitType: '高处', valid: true, status: '已批准' },
]

const CHECKS = [
  { code: 'CI-GAS', name: '气体检测记录', clause: 'GB30871:6.2', frequency: '每次作业' },
  { code: 'CI-PERMIT', name: '审批签字', clause: 'GB30871:6.3', frequency: '每票' },
  { code: 'CI-GUARD', name: '监护到位', clause: 'GB30871:6.4', frequency: '每次作业' },
  { code: 'CI-ISOLATE', name: '隔离确认', clause: 'GB30871:8.2', frequency: '每次作业' },
  { code: 'CI-TRAIN', name: '培训记录', clause: 'SAFETY-LAW:40', frequency: '每季度' },
]

const CAUSES = [
  { code: 'CAUSE-C1', name: '未有效置换/清洗', category: '法' },
  { code: 'CAUSE-C2', name: '动火前气体检测缺失', category: '法' },
  { code: 'CAUSE-C3', name: '作业票审批流于形式', category: '法' },
  { code: 'CAUSE-C4', name: '承包商未受专项培训', category: '人' },
  { code: 'CAUSE-C5', name: '动火作业 JSA 风险分析缺失', category: '法' },
]

export function buildSeedSuite(): SuiteData {
  const entities: OntologyEntity[] = []
  const relations: OntologyRelation[] = []

  for (const reg of REGULATIONS) {
    entities.push(ent('SAFETY_REGULATION', `reg:${reg.code}`, reg.title, reg))
  }
  for (const c of CLAUSES) {
    const id = `clause:${c.reg}:${c.no}`
    entities.push(ent('SAFETY_CLAUSE', id, `${c.reg} ${c.no}`, {
      clauseNo: c.no, regulationCode: c.reg, text: c.text, mandatory: c.mandatory,
    }))
    relations.push(rel(`reg:${c.reg}`, id, 'SAFETY_REG_CONTAINS_CLAUSE'))
    for (const target of c.appliesTo) relations.push(rel(id, target, 'SAFETY_CLAUSE_APPLIES_TO'))
    for (const control of c.controls) relations.push(rel(id, `control:${control}`, 'SAFETY_CLAUSE_REQUIRES_CONTROL'))
  }
  for (const ct of CONTROLS) {
    entities.push(ent('SAFETY_CONTROL', `control:${ct.code}`, ct.name, {
      controlCode: ct.code, level: ct.level, implemented: ct.implemented,
    }))
  }
  for (const h of HAZARDS) {
    entities.push(ent('SAFETY_HAZARD', `hazard:${h.code}`, h.name, h))
  }
  for (const m of MATERIALS) {
    entities.push(ent('SAFETY_MATERIAL', `mat:${m.code}`, m.name, m))
  }
  for (const a of AREAS) {
    entities.push(ent('SAFETY_AREA', `area:${a.code}`, a.name, a))
  }
  for (const u of UNITS) {
    entities.push(ent('SAFETY_UNIT', `unit:${u.code}`, u.name, u))
    relations.push(rel(`area:${u.area}`, `unit:${u.code}`, 'SAFETY_AREA_CONTAINS_UNIT'))
  }
  for (const e of EQUIPMENTS) {
    entities.push(ent('SAFETY_EQUIPMENT', `eq:${e.code}`, e.name, {
      equipmentCode: e.code, equipmentClass: e.cls, inspectionValidUntil: e.inspectionValidUntil,
      status: e.status, unitCode: e.unit, stock: e.stock,
    }))
    relations.push(rel(`unit:${e.unit}`, `eq:${e.code}`, 'SAFETY_UNIT_CONTAINS_EQUIPMENT'))
    if (e.material) relations.push(rel(`eq:${e.code}`, `mat:${e.material}`, 'SAFETY_EQUIPMENT_HANDLES_MATERIAL'))
  }
  for (const o of OPERATIONS) {
    entities.push(ent('SAFETY_OPERATION', `op:${o.code}`, o.name, {
      operationCode: o.code, operationType: o.type, areaCode: o.area,
      equipmentCodes: o.equipments, permitType: o.type,
    }))
    relations.push(rel(`op:${o.code}`, `area:${o.area}`, 'SAFETY_OPERATION_IN_AREA'))
    for (const eq of o.equipments) relations.push(rel(`op:${o.code}`, `eq:${eq}`, 'SAFETY_OPERATION_ON_EQUIPMENT'))
    if (o.permit) relations.push(rel(`op:${o.code}`, `permit:${o.permit}`, 'SAFETY_OPERATION_REQUIRES_PERMIT'))
    for (const h of o.hazards) relations.push(rel(`op:${o.code}`, `hazard:${h}`, 'SAFETY_OPERATION_HAS_HAZARD'))
  }
  for (const p of PERMITS) {
    entities.push(ent('SAFETY_PERMIT', `permit:${p.code}`, p.name, p))
  }
  for (const c of CHECKS) {
    entities.push(ent('SAFETY_CHECK_ITEM', `check:${c.code}`, c.name, c))
    relations.push(rel(`check:${c.code}`, `clause:${c.clause}`, 'SAFETY_CHECK_VERIFIES_CLAUSE'))
  }
  // 设备危险源
  relations.push(rel('eq:EQ-A1-T01', 'hazard:H-FLAM', 'SAFETY_EQUIPMENT_HAS_HAZARD'))
  relations.push(rel('eq:EQ-A1-T02', 'hazard:H-TOXIC', 'SAFETY_EQUIPMENT_HAS_HAZARD'))
  relations.push(rel('eq:EQ-A2-L01', 'hazard:H-FLAM', 'SAFETY_EQUIPMENT_HAS_HAZARD'))
  // 措施管控危险源
  const mitigates: [string, string][] = [
    ['CT-GAS-TEST', 'H-FLAM'], ['CT-ISOLATE', 'H-TOXIC'], ['CT-GUARD', 'H-FLAM'],
    ['CT-SEATBELT', 'H-FALL'], ['CT-GROUND', 'H-SHOCK'], ['CT-BARRICADE', 'H-OBJ'],
  ]
  for (const [ct, h] of mitigates) relations.push(rel(`control:${ct}`, `hazard:${h}`, 'SAFETY_CONTROL_MITIGATES_HAZARD'))

  // 事件与原因
  entities.push(ent('SAFETY_EVENT', 'event:EV-INC-01', '1#储罐动火闪爆', {
    eventCode: 'EV-INC-01', severity: '较大', occurredAt: '2026-03-12',
    consequences: '1 人重伤，储罐局部损毁', category: '机',
  }))
  for (const c of CAUSES) {
    entities.push(ent('SAFETY_CAUSE', `cause:${c.code}`, c.name, c))
  }
  relations.push(rel('event:EV-INC-01', 'eq:EQ-A1-T01', 'SAFETY_EVENT_OCCURS_AT'))
  relations.push(rel('event:EV-INC-01', 'area:AREA-A', 'SAFETY_EVENT_OCCURS_AT'))
  relations.push(rel('event:EV-INC-01', 'op:OP-HOT-01', 'SAFETY_EVENT_INVOLVES'))
  relations.push(rel('event:EV-INC-01', 'cause:CAUSE-C1', 'SAFETY_EVENT_CAUSED_BY', '直接原因', { confidence: 0.9 }))
  relations.push(rel('event:EV-INC-01', 'cause:CAUSE-C2', 'SAFETY_EVENT_CAUSED_BY', '直接原因', { confidence: 0.85 }))
  relations.push(rel('event:EV-INC-01', 'cause:CAUSE-C4', 'SAFETY_EVENT_CAUSED_BY', '间接原因', { confidence: 0.7 }))
  relations.push(rel('event:EV-INC-01', 'cause:CAUSE-C5', 'SAFETY_EVENT_CAUSED_BY', '间接原因', { confidence: 0.75 }))
  relations.push(rel('cause:CAUSE-C1', 'cause:CAUSE-C3', 'SAFETY_EVENT_CAUSED_BY', '管理原因', { confidence: 0.8 }))
  relations.push(rel('cause:CAUSE-C2', 'cause:CAUSE-C3', 'SAFETY_EVENT_CAUSED_BY', '管理原因', { confidence: 0.8 }))

  const meta = {
    suiteId: SAFETY_SUITE_ID,
    domain: SAFETY_DOMAIN,
    project: '样例厂区',
    sourceRequirements: '内置样例数据',
    sourceDir: 'seed',
    importTime: Date.now(),
    sourceMtime: Date.now(),
    sourceFileCount: 1,
    entityCount: entities.length,
    relationCount: relations.length,
    appId: 'chemical-safety',
  }

  return { entities, relations, meta, annotations: emptyAnnotations() }
}

// ─────────────── 规则包 ───────────────

const rule = (
  id: string, name: string, clause: string, type: string, control: string,
  severity: 'general' | 'major' | 'fatal', delta: number, message: string,
): SafetyRule => ({
  id, name, version: '1.0.0', sourceClauseIds: [clause],
  scope: { entityKinds: ['SAFETY_OPERATION'], operationTypes: [type as never] },
  condition: { op: 'contains', field: 'missingControlCodes', value: control },
  effect: { kind: 'violation', severity, riskDelta: delta, message },
  weight: 1, enabled: true,
})

export const SEED_RULES: SafetyRule[] = [
  rule('R-01', '动火前未进行气体检测', 'GB30871:6.2', '动火', 'CT-GAS-TEST', 'fatal', 30, '动火作业前未完成可燃气体检测'),
  rule('R-02', '动火作业无专人监护', 'GB30871:6.4', '动火', 'CT-GUARD', 'major', 15, '动火作业未设置专人监护'),
  rule('R-03', '受限空间未隔离置换', 'GB30871:8.2', '受限空间', 'CT-ISOLATE', 'fatal', 30, '受限空间作业前未完成隔离置换'),
  rule('R-04', '受限空间未检测氧含量', 'GB30871:8.3', '受限空间', 'CT-GAS-TEST', 'fatal', 30, '受限空间作业前未检测氧含量与有毒气体'),
  rule('R-05', '高处作业未佩戴安全带', 'GB30871:9.2', '高处', 'CT-SEATBELT', 'major', 20, '高处作业未正确佩戴安全带'),
  rule('R-06', '吊装作业未设警戒', 'GB30871:10.2', '吊装', 'CT-BARRICADE', 'general', 10, '吊装作业未设置警戒区域'),
  rule('R-07', '临时用电未接地', 'GB30871:11.2', '临时用电', 'CT-GROUND', 'major', 20, '临时用电设备未可靠接地'),
  rule('R-08', '盲板抽堵未隔离', 'GB30871:12.2', '盲板抽堵', 'CT-ISOLATE', 'fatal', 30, '盲板抽堵作业未完成有效隔离'),
  rule('R-09', '检维修未做风险分析', 'GB30871:5.2', '检维修', 'CT-JSA', 'major', 20, '检维修作业前未开展 JSA 风险分析'),
  rule('R-10', '作业人员未接受安全培训', 'SAFETY-LAW:40', '动火', 'CT-TRAIN', 'general', 10, '作业人员缺少有效安全培训记录'),
  {
    id: 'R-11', name: '作业票缺失或过期', version: '1.0.0', sourceClauseIds: ['GB30871:6.3'],
    scope: { entityKinds: ['SAFETY_OPERATION'] },
    condition: { op: 'exists', field: 'permitViolation' },
    effect: { kind: 'violation', severity: 'major', riskDelta: 20, message: '作业票缺失、过期或未审批' },
    weight: 1, enabled: true,
  },
  {
    id: 'R-12', name: '设备检验过期', version: '1.0.0', sourceClauseIds: ['GB18218:4.1'],
    scope: { entityKinds: ['SAFETY_EQUIPMENT'] },
    condition: { op: 'eq', field: 'inspectionOverdue', value: true },
    effect: { kind: 'violation', severity: 'major', riskDelta: 25, message: '设备检验有效期已过期' },
    weight: 1, enabled: true,
  },
]

/** 幂等：套件不存在时写入种子数据；规则/模型缺失时补默认 */
export async function ensureSafetySeed(): Promise<void> {
  const existing = await loadSafetySuite()
  if (!existing) {
    await saveSafetySuite(buildSeedSuite())
    await saveRules('default', SEED_RULES)
    await saveScoreModel(DEFAULT_SCORE_MODEL)
    const incident = {
      id: 'INC-001',
      suiteId: SAFETY_SUITE_ID,
      title: '1#储罐动火闪爆',
      occurredAt: '2026-03-12',
      eventEntityId: 'event:EV-INC-01',
      areaCode: 'AREA-A',
      unitCode: 'UNIT-A1',
      equipmentCode: 'EQ-A1-T01',
      operationCode: 'OP-HOT-01',
      category: '机' as const,
      consequences: '1 人重伤，储罐局部损毁',
      facts: ['未有效置换/清洗', '动火前未检测可燃气体', '作业票审批流于形式', '承包商未受专项培训'],
      suspectedCauses: ['cause:CAUSE-C1', 'cause:CAUSE-C2', 'cause:CAUSE-C4', 'cause:CAUSE-C5'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveIncident(incident)
  }
}
