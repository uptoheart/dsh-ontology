// ──────────────────────────────────────────────────────────────────────
// 根因分析引擎：事件 → 因果链 BFS/DFS → 屏障失效 → 证据 → 4M1E 排序
// 只依赖图谱与事件数据，判定确定可复现，不引入 LLM 推断
// ──────────────────────────────────────────────────────────────────────

import type { OntologyEntity, OntologyRelation, SuiteData } from '../../../shared-types.js'
import type {
  ChainEdge, ChainNode, RcaResult, RootCause, SafetyIncident, ScoreModel,
} from '../types.js'
import { buildIndex, type SuiteIndex } from '../graph.js'
import { buildContext } from '../scoring/context.js'

const CAUSED_BY = 'SAFETY_EVENT_CAUSED_BY'
const EVENT_KIND = 'SAFETY_EVENT'

const SEVERITY_WEIGHT: Record<string, number> = {
  一般: 0.6,
  较大: 0.8,
  重大: 0.95,
  特别重大: 1.0,
}

/** 原因名称 → 管控措施编码（种子数据未显式声明 controlCode 时的兜底口径） */
const CONTROL_KEYWORDS: { re: RegExp; code: string }[] = [
  { re: /置换|清洗|隔离/, code: 'CT-ISOLATE' },
  { re: /气体检测|检测/, code: 'CT-GAS-TEST' },
  { re: /票|审批/, code: 'CT-PERMIT' },
  { re: /培训/, code: 'CT-TRAIN' },
  { re: /JSA|风险分析/i, code: 'CT-JSA' },
  { re: /监护/, code: 'CT-GUARD' },
  { re: /接地/, code: 'CT-GROUND' },
  { re: /安全带/, code: 'CT-SEATBELT' },
  { re: /警戒/, code: 'CT-BARRICADE' },
  { re: /备案|登记/, code: 'CT-REGISTER' },
]

interface CauseStat {
  best: number
  depth: number
  paths: number
  parentId: string
}

function confidenceOf(relation: OntologyRelation): number {
  const raw = relation.properties?.confidence
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.6
}

function categoryOf(entity: OntologyEntity | undefined): '人' | '机' | '料' | '法' | '环' {
  const c = String(entity?.properties.category ?? '')
  if (c === '人' || c === '机' || c === '料' || c === '法' || c === '环') return c
  return '法'
}

function categoryByControlLevel(level: unknown): '人' | '机' | '料' | '法' | '环' {
  if (level === 'engineering') return '机'
  if (level === 'training') return '人'
  return '法'
}

function controllabilityOf(
  category: '人' | '机' | '料' | '法' | '环',
  model: ScoreModel,
): number {
  if (category === '人') return model.controllability.training
  if (category === '机' || category === '料') return model.controllability.engineering
  return model.controllability.management
}

function severityWeight(index: SuiteIndex, eventId: string | undefined): number {
  if (!eventId) return 0.75
  const severity = String(index.byId.get(eventId)?.properties.severity ?? '')
  return SEVERITY_WEIGHT[severity] ?? 0.75
}

function controlCodeFor(cause: OntologyEntity): string | undefined {
  const explicit = cause.properties.controlCode
  if (typeof explicit === 'string' && explicit) return explicit
  for (const item of CONTROL_KEYWORDS) {
    if (item.re.test(cause.name)) return item.code
  }
  return undefined
}

function resolveEventId(index: SuiteIndex, incident: SafetyIncident): string | undefined {
  if (incident.eventEntityId && index.byId.has(incident.eventEntityId)) return incident.eventEntityId
  const event = index.ofKind(EVENT_KIND).find(e => {
    const code = String(e.properties.eventCode ?? '')
    return code && (code === incident.id || code === `EV-${incident.id}`)
  })
  return event?.id
}

export interface RcaOptions {
  now?: number
}

export function analyzeIncident(
  suite: SuiteData,
  incident: SafetyIncident,
  model: ScoreModel,
  options: RcaOptions = {},
): RcaResult {
  const now = options.now ?? Date.now()
  const index = buildIndex(suite)
  const eventId = resolveEventId(index, incident)
  const nodes = new Map<string, ChainNode>()
  const edges = new Map<string, ChainEdge>()

  if (eventId) {
    const event = index.byId.get(eventId)!
    nodes.set(eventId, {
      id: eventId,
      label: event.name,
      type: 'event',
      category: categoryOf(event),
      layer: 0,
      meta: { severity: event.properties.severity, occurredAt: event.properties.occurredAt },
    })
  }

  // ── 因果链遍历（限制深度，避免环） ──
  const stats = new Map<string, CauseStat>()
  const visitedPaths = new Set<string>()

  const walk = (currentId: string, depth: number, confidence: number, onPath: Set<string>): void => {
    if (!eventId || depth >= model.rcaMaxDepth) return
    for (const relation of index.outgoing(currentId, CAUSED_BY)) {
      const childId = relation.to
      const child = index.byId.get(childId)
      if (!child || onPath.has(childId)) continue

      const edgeId = relation.id || `${currentId}--${CAUSED_BY}--${childId}`
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: currentId,
          target: childId,
          label: relation.label ?? '起因于',
          confidence: confidenceOf(relation),
        })
      }

      const childConfidence = confidence * confidenceOf(relation)
      const childDepth = depth + 1
      const stat = stats.get(childId)
      if (!stat) {
        stats.set(childId, {
          best: childConfidence,
          depth: childDepth,
          paths: 1,
          parentId: currentId,
        })
      } else {
        stat.paths += 1
        if (childConfidence > stat.best) {
          stat.best = childConfidence
          stat.parentId = currentId
        }
        if (childDepth < stat.depth) stat.depth = childDepth
      }

      if (!nodes.has(childId)) {
        const layer = stats.get(childId)!.depth
        nodes.set(childId, {
          id: childId,
          label: child.name,
          type: depth + 1 >= model.rcaMaxDepth ? 'root' : 'cause',
          category: categoryOf(child),
          layer,
          meta: { confidence: Math.round(childConfidence * 100) / 100 },
        })
      }

      const pathKey = `${currentId}>${childId}`
      if (!visitedPaths.has(pathKey)) {
        visitedPaths.add(pathKey)
        walk(childId, childDepth, childConfidence, new Set([...onPath, childId]))
      }
    }
  }

  if (eventId) walk(eventId, 0, 1, new Set([eventId]))

  // ── 识别根因：在已展开因果子图中没有后继原因的原因节点 ──
  const rootIds: string[] = []
  for (const [causeId, stat] of stats) {
    const hasChildCause = index.outgoing(causeId, CAUSED_BY)
      .some(r => stats.has(r.to))
    if (!hasChildCause) rootIds.push(causeId)
    void stat
  }

  const severity = severityWeight(index, eventId)
  const suspected = new Set(incident.suspectedCauses ?? [])
  const barrierClauses = new Map<string, string[]>()
  const recommendations: RcaResult['recommendations'] = []
  const roots: RootCause[] = []

  for (const causeId of rootIds.sort((a, b) => (stats.get(b)!.best - stats.get(a)!.best))) {
    const cause = index.byId.get(causeId)!
    const stat = stats.get(causeId)!
    const category = categoryOf(cause)

    const controlCode = controlCodeFor(cause)
    const controlEntity = controlCode
      ? index.ofKind('SAFETY_CONTROL').find(c => c.properties.controlCode === controlCode)
      : undefined

    let clauseIds: string[] = []
    if (controlEntity) {
      const clauses = index.sources(controlEntity.id, 'SAFETY_CLAUSE_REQUIRES_CONTROL')
      clauseIds = clauses.filter(id => index.byId.has(id))

      const barrierId = `barrier:${controlEntity.id}`
      if (!nodes.has(barrierId)) {
        nodes.set(barrierId, {
          id: barrierId,
          label: `屏障失效：${controlEntity.name}`,
          type: 'barrier',
          category: categoryByControlLevel(controlEntity.properties.level),
          layer: stat.depth + 1,
          meta: {
            controlCode,
            implemented: controlEntity.properties.implemented === true,
            causeIds: [causeId],
          },
        })
      } else {
        const existing = nodes.get(barrierId)!
        const causeIds = (existing.meta?.causeIds as string[] | undefined) ?? []
        existing.meta = { ...existing.meta, causeIds: [...new Set([...causeIds, causeId])] }
      }
      const barrierEdgeId = `${causeId}--barrier--${barrierId}`
      if (!edges.has(barrierEdgeId)) {
        edges.set(barrierEdgeId, {
          id: barrierEdgeId,
          source: causeId,
          target: barrierId,
          label: '屏障失效',
          confidence: 0.85,
        })
      }

      // 证据节点：条款依据
      for (const clauseId of clauseIds) {
        const clause = index.byId.get(clauseId)!
        const evidenceId = `evidence:${clauseId}`
        if (!nodes.has(evidenceId)) {
          nodes.set(evidenceId, {
            id: evidenceId,
            label: `依据：${clause.name}`,
            type: 'evidence',
            layer: stat.depth + 2,
            meta: { clauseId, text: clause.properties.text },
          })
        }
        const evidenceEdgeId = `${barrierId}--evidence--${evidenceId}`
        if (!edges.has(evidenceEdgeId)) {
          edges.set(evidenceEdgeId, {
            id: evidenceEdgeId,
            source: barrierId,
            target: evidenceId,
            label: '法规依据',
            confidence: 1,
          })
        }
      }

      const code = String(controlCode)
      const existing = barrierClauses.get(code) ?? []
      barrierClauses.set(code, [...new Set([...existing, ...clauseIds])])
    }

    const evidences: RootCause['evidences'] = [
      ...clauseIds.map(id => ({
        type: 'clause',
        refId: id,
        text: String(index.byId.get(id)?.properties.text ?? index.byId.get(id)?.name ?? id),
      })),
    ]

    const rankScore = Math.round(
      stat.best * severity * controllabilityOf(category, model) * 100,
    ) / 100

    roots.push({
      causeId,
      causeLabel: cause.name,
      rankScore,
      category,
      pathCount: stat.paths,
      evidences,
    })

    if (controlEntity) {
      recommendations.push({
        text: `恢复并验证「${controlEntity.name}」的有效性，留存执行记录`,
        targetClauseIds: clauseIds,
      })
    } else {
      const text = category === '人'
        ? '补充作业人员与承包商的专项培训、考核与准入管理'
        : category === '机'
          ? '完善设备设施本质安全设计与定期检验'
          : category === '料'
            ? '加强物料储存、相容性与流向管控'
            : category === '环'
              ? '改善作业环境监测与警示隔离'
              : '修订作业程序，强化审批与现场执行的一致性'
      recommendations.push({ text, targetClauseIds: clauseIds })
    }
  }

  // ── 未被事件事实/人工确认支撑的原因，标记为待验证 ──
  const unverified = [...stats.keys()].filter(id => !suspected.has(id))

  // ── 事件涉及的作业/设备缺失管控，补挂屏障与证据 ──
  const relatedIds = [
    incident.operationCode ? `op:${incident.operationCode}` : '',
    incident.equipmentCode ? `eq:${incident.equipmentCode}` : '',
  ].filter(Boolean)

  for (const id of relatedIds) {
    const entity = index.byId.get(id)
    if (!entity) continue
    const ctx = buildContext(entity, index, now)
    for (const code of ctx.missingControlCodes) {
      const control = index.ofKind('SAFETY_CONTROL').find(c => c.properties.controlCode === code)
      if (!control) continue
      const barrierId = `barrier:${control.id}`
      if (!nodes.has(barrierId)) {
        nodes.set(barrierId, {
          id: barrierId,
          label: `屏障缺失：${control.name}`,
          type: 'barrier',
          category: categoryByControlLevel(control.properties.level),
          layer: 1,
          meta: { controlCode: code, implemented: false, sourceEntity: entity.id },
        })
        if (eventId) {
          const edgeId = `${eventId}--barrier--${barrierId}`
          if (!edges.has(edgeId)) {
            edges.set(edgeId, {
              id: edgeId,
              source: eventId,
              target: barrierId,
              label: '现场屏障缺失',
              confidence: 0.7,
            })
          }
        }
      }
    }
    for (const v of ctx.clauseViolations) {
      const evidenceId = `evidence:${v.clauseId}`
      if (nodes.has(evidenceId)) continue
      const clause = index.byId.get(v.clauseId)
      if (!clause) continue
      nodes.set(evidenceId, {
        id: evidenceId,
        label: `依据：${clause.name}`,
        type: 'evidence',
        layer: 2,
        meta: { clauseId: v.clauseId, text: clause.properties.text, missingControls: v.missingControls },
      })
    }
  }

  return {
    incidentId: incident.id,
    graph: {
      nodes: [...nodes.values()].sort((a, b) => (a.layer - b.layer) || a.id.localeCompare(b.id)),
      edges: [...edges.values()],
    },
    roots,
    unverified,
    recommendations,
    modelVersion: model.version,
    generatedAt: now,
  }
}
