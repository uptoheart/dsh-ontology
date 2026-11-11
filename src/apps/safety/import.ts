// ──────────────────────────────────────────────────────────────────────
// 安全域批量导入：法规 / 条款 / 资产 / 作业
// 输入为已解析的行对象（CSV 由路由层解析），输出新套件与导入报告
// ──────────────────────────────────────────────────────────────────────

import type { EntityKind, OntologyEntity, OntologyRelation, RelationType, SuiteData } from '../../shared-types.js'
import type { ImportError, ImportReport } from './types.js'

export type ImportKind = ImportReport['kind']

type Row = Record<string, string>

const now = () => Date.now()

function entity(
  kind: EntityKind,
  id: string,
  name: string,
  properties: Record<string, unknown>,
): OntologyEntity {
  return {
    id,
    rawId: id,
    name,
    kind,
    domain: '化工安全',
    sourceFile: 'import',
    properties,
  }
}

function relation(
  from: string,
  to: string,
  type: RelationType,
  label?: string,
): OntologyRelation {
  return { id: `${from}--${type}--${to}`, from, to, type, label }
}

function splitList(value: string | undefined): string[] {
  return String(value ?? '')
    .split(/[;；|]/)
    .map(s => s.trim())
    .filter(Boolean)
}

function boolOf(value: string | undefined): boolean {
  return /^(1|true|yes|y|是)$/i.test(String(value ?? '').trim())
}

function numOf(value: string | undefined): number {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

interface Mutable {
  entities: OntologyEntity[]
  relations: OntologyRelation[]
  seen: Set<string>
}

function pushEntity(
  state: Mutable,
  kind: EntityKind,
  id: string,
  name: string,
  properties: Record<string, unknown>,
  row: number,
  report: ImportReport,
): boolean {
  if (!name) {
    report.errors.push({ row, field: 'name', message: '名称不能为空' })
    return false
  }
  if (state.seen.has(id)) {
    report.skipped += 1
    return false
  }
  state.seen.add(id)
  state.entities.push(entity(kind, id, name, properties))
  report.created += 1
  return true
}

function importRegulations(state: Mutable, rows: Row[], report: ImportReport): void {
  rows.forEach((row, i) => {
    const code = (row.code ?? '').trim()
    if (!code) {
      report.errors.push({ row: i + 1, field: 'code', message: '法规编码不能为空' })
      return
    }
    pushEntity(state, 'SAFETY_REGULATION', `reg:${code}`, row.title ?? code, {
      code,
      title: row.title ?? code,
      type: row.type ?? '标准',
      issuer: row.issuer ?? '',
    }, i + 1, report)
  })
}

function importClauses(state: Mutable, rows: Row[], report: ImportReport): void {
  rows.forEach((row, i) => {
    const reg = (row.reg ?? '').trim()
    const no = (row.no ?? '').trim()
    if (!reg || !no) {
      report.errors.push({ row: i + 1, field: 'reg/no', message: '法规编码与条款号不能为空' })
      return
    }
    const clauseId = `clause:${reg}:${no}`
    const ok = pushEntity(state, 'SAFETY_CLAUSE', clauseId, `${reg} ${no}`, {
      clauseNo: no,
      regulationCode: reg,
      text: row.text ?? '',
      mandatory: boolOf(row.mandatory),
    }, i + 1, report)
    if (!ok) return

    const regId = `reg:${reg}`
    if (state.seen.has(regId)) {
      state.relations.push(relation(regId, clauseId, 'SAFETY_REG_CONTAINS_CLAUSE'))
    }
    for (const target of splitList(row.appliesTo)) {
      state.relations.push(relation(clauseId, target, 'SAFETY_CLAUSE_APPLIES_TO'))
    }
    for (const control of splitList(row.controls)) {
      state.relations.push(relation(clauseId, `control:${control}`, 'SAFETY_CLAUSE_REQUIRES_CONTROL'))
    }
  })
}

function importAssets(state: Mutable, rows: Row[], report: ImportReport): void {
  rows.forEach((row, i) => {
    const kind = (row.kind ?? '').trim().toLowerCase()
    const code = (row.code ?? '').trim()
    const name = (row.name ?? '').trim()
    if (!code) {
      report.errors.push({ row: i + 1, field: 'code', message: '资产编码不能为空' })
      return
    }

    if (kind === 'area') {
      pushEntity(state, 'SAFETY_AREA', `area:${code}`, name || code, {
        code,
        riskLevel: row.riskLevel ?? '',
        headcount: numOf(row.headcount),
        stock: numOf(row.stock),
      }, i + 1, report)
      return
    }

    if (kind === 'unit') {
      const id = `unit:${code}`
      if (!pushEntity(state, 'SAFETY_UNIT', id, name || code, {
        code,
        process: row.process ?? '',
        headcount: numOf(row.headcount),
        stock: numOf(row.stock),
      }, i + 1, report)) return
      if (row.area) state.relations.push(relation(`area:${row.area}`, id, 'SAFETY_AREA_CONTAINS_UNIT'))
      return
    }

    if (kind === 'equipment') {
      const id = `eq:${code}`
      if (!pushEntity(state, 'SAFETY_EQUIPMENT', id, name || code, {
        equipmentCode: code,
        equipmentClass: row.eqClass ?? '',
        inspectionValidUntil: row.inspectionValidUntil ?? '',
        status: row.status || '在用',
        unitCode: row.unit ?? '',
        stock: numOf(row.stock),
      }, i + 1, report)) return
      if (row.unit) state.relations.push(relation(`unit:${row.unit}`, id, 'SAFETY_UNIT_CONTAINS_EQUIPMENT'))
      if (row.material) state.relations.push(relation(id, `mat:${row.material}`, 'SAFETY_EQUIPMENT_HANDLES_MATERIAL'))
      return
    }

    if (kind === 'material') {
      pushEntity(state, 'SAFETY_MATERIAL', `mat:${code}`, name || code, {
        code,
        cas: row.cas ?? '',
        flashPoint: numOf(row.flashPoint),
        criticalQuantity: numOf(row.criticalQuantity),
        hazardClass: row.hazardClass ?? '',
      }, i + 1, report)
      return
    }

    report.errors.push({ row: i + 1, field: 'kind', message: `未知资产类型：${kind || '(空)'}` })
  })
}

function importOperations(state: Mutable, rows: Row[], report: ImportReport): void {
  rows.forEach((row, i) => {
    const code = (row.code ?? '').trim()
    if (!code) {
      report.errors.push({ row: i + 1, field: 'code', message: '作业编码不能为空' })
      return
    }
    const id = `op:${code}`
    const ok = pushEntity(state, 'SAFETY_OPERATION', id, row.name || code, {
      operationCode: code,
      operationType: row.type ?? '其他',
      areaCode: row.area ?? '',
      equipmentCodes: splitList(row.equipments),
      permitType: row.type ?? '',
    }, i + 1, report)
    if (!ok) return

    if (row.area) state.relations.push(relation(id, `area:${row.area}`, 'SAFETY_OPERATION_IN_AREA'))
    for (const eq of splitList(row.equipments)) {
      state.relations.push(relation(id, `eq:${eq}`, 'SAFETY_OPERATION_ON_EQUIPMENT'))
    }
    if (row.permit) {
      state.relations.push(relation(id, `permit:${row.permit}`, 'SAFETY_OPERATION_REQUIRES_PERMIT'))
    }
    for (const hazard of splitList(row.hazards)) {
      state.relations.push(relation(id, `hazard:${hazard}`, 'SAFETY_OPERATION_HAS_HAZARD'))
    }
  })
}

export interface ImportResult {
  suite: SuiteData
  report: ImportReport
}

export function importRows(suite: SuiteData, kind: ImportKind, rows: Row[]): ImportResult {
  const state: Mutable = {
    entities: [...suite.entities],
    relations: [...suite.relations],
    seen: new Set(suite.entities.map(e => e.id)),
  }
  const report: ImportReport = {
    batchId: `IMP-${now()}`,
    kind,
    created: 0,
    skipped: 0,
    errors: [],
    at: now(),
  }

  if (kind === 'regulation') importRegulations(state, rows, report)
  else if (kind === 'clause') importClauses(state, rows, report)
  else if (kind === 'asset') importAssets(state, rows, report)
  else importOperations(state, rows, report)

  const next: SuiteData = {
    entities: state.entities,
    relations: state.relations,
    meta: {
      ...suite.meta,
      entityCount: state.entities.length,
      relationCount: state.relations.length,
      importTime: now(),
    },
    annotations: suite.annotations,
  }
  return { suite: next, report }
}

/** 轻量 CSV 解析（支持双引号包裹与转义） */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1 } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === ',') { row.push(cell); cell = ''; continue }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell || row.length > 0) { row.push(cell); rows.push(row) }

  const nonEmpty = rows.filter(r => r.some(c => c.trim()))
  if (nonEmpty.length < 2) return []
  const header = nonEmpty[0].map(h => h.trim())
  return nonEmpty.slice(1).map(r => {
    const obj: Row = {}
    header.forEach((key, idx) => { obj[key] = (r[idx] ?? '').trim() })
    return obj
  })
}
