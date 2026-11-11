// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：访谈问题生成器
// 只读生成提纲，不写回访谈记录，避免污染真实采集数据。
// ──────────────────────────────────────────────────────────────────────

import type {
  EntityKind, FlowchartData, FrameworkDefinition, InterviewRecord, OntologyEntity, SuiteData,
} from '../shared-types.js'
import { levelNumOfCode, mappingAxisOfKind } from '../shared-types.js'
import { findNodeByCode } from '../builtin-frameworks.js'
import type { AgentQuestionSet } from './types.js'

export interface AgentQuestionInput {
  suite: SuiteData
  framework: FrameworkDefinition
  code: string
  interviews: InterviewRecord[]
  flows: FlowchartData[]
}

const OBJECT_KIND_ORDER: Partial<Record<EntityKind, number>> = {
  AGGREGATE_ROOT: 0,
  ENTITY: 1,
  REPORT: 2,
  DATA_DICTIONARY: 3,
}

function isObjectKind(kind: EntityKind): boolean {
  return OBJECT_KIND_ORDER[kind] !== undefined
}

function firstSegment(code: string): string {
  return code.split('.')[0] ?? ''
}

/** 判断 mapped 编号是否与 code 同一条业务线（跨 L1 "4.0" 与 L2 "4.3" 也能匹配） */
function sameLineage(code: string, mapped: string): boolean {
  const a = code.split('.').map(s => s.trim())
  const b = mapped.split('.').map(s => s.trim())
  if (!a.length || !b.length) return false
  if (firstSegment(code) !== firstSegment(mapped)) return false
  return b.every((seg, i) => a[i] === seg)
}

function pathLabelsOf(framework: FrameworkDefinition, code: string): string[] | null {
  const found = findNodeByCode(framework, code)
  if (!found) return null
  const labels: string[] = []
  const domain = framework.domains.find(d =>
    d.code === code || firstSegment(d.code) === firstSegment(code),
  )
  if (domain) labels.push(domain.label)
  labels.push(...found.path.map(n => n.label))
  labels.push(found.node.label)
  return labels
}

function mappingOf(suite: SuiteData, entityId: string): string | undefined {
  const v = suite.annotations.entityFrameMapping[entityId]
  if (!v) return undefined
  // 新格式：取任一条有 apqcCode 的映射（agent 后台任务不关心具体框架）
  if (typeof v === 'object' && 'frameworkId' in v) return (v as any).apqcCode
  for (const entry of Object.values(v as object)) {
    if (entry && typeof entry === 'object' && (entry as any).apqcCode) return (entry as any).apqcCode
  }
  return undefined
}

function objectCandidateScore(suite: SuiteData, entity: OntologyEntity, code: string, labels: string[]): number {
  const mapped = mappingOf(suite, entity.id)
  let score = 0
  if (mapped && sameLineage(code, mapped)) score += 100
  const domainText = `${entity.domain ?? ''} ${entity.name ?? ''}`
  if (labels.some(label => label && domainText.includes(label))) score += 20
  score += 10 - (OBJECT_KIND_ORDER[entity.kind] ?? 9)
  return score
}

function matchKeywords(text: string, label: string): boolean {
  const source = text.trim()
  if (!source || !label) return false
  if (source.includes(label) || label.includes(source)) return true
  const tokens = label.split(/[\s、/·,，:：()（）\-]+/).filter(t => t.length >= 2)
  return tokens.some(t => source.includes(t))
}

export function buildInterviewQuestions(input: AgentQuestionInput): AgentQuestionSet | null {
  const { suite, framework, code, interviews, flows } = input
  if (!code || levelNumOfCode(code) < 3) return null
  const found = findNodeByCode(framework, code)
  if (!found) return null

  const labels = pathLabelsOf(framework, code) ?? [found.node.label]
  const path = labels.slice(0, -1)
  const label = found.node.label || found.node.name || code
  const l2Label = path[path.length - 1] ?? path[0] ?? ''

  const objectEntities = suite.entities
    .filter(e => mappingAxisOfKind(e.kind) === 'domain' && isObjectKind(e.kind))
    .map(e => ({ entity: e, score: objectCandidateScore(suite, e, code, labels) }))
    .filter(x => x.score > 10)
    .sort((a, b) =>
      b.score - a.score
      || (OBJECT_KIND_ORDER[a.entity.kind] ?? 9) - (OBJECT_KIND_ORDER[b.entity.kind] ?? 9)
      || a.entity.name.localeCompare(b.entity.name, 'zh-CN'),
    )
    .slice(0, 5)
    .map(x => ({ id: x.entity.id, name: x.entity.name, kind: x.entity.kind }))

  const roleEntities = suite.entities
    .filter(e => e.kind === 'ACTOR' || e.kind === 'ROLE')
    .map(e => ({ entity: e, score: objectCandidateScore(suite, e, code, labels) }))
    .sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name, 'zh-CN'))
    .map(x => x.entity.name)
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .slice(0, 3)

  const rules = suite.entities
    .filter(e => e.kind === 'RULE')
    .map(e => ({ entity: e, hit: matchKeywords(`${e.name} ${e.description ?? ''}`, label) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit))
    .slice(0, 3)
    .map(x => x.entity.name)

  const records = interviews
    .filter(r => r.apqcCode === code)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const latest = records[0]
  const a = (latest && latest.answers) || {}
  const roleOk = Boolean(a.hasRole?.value && a.hasRole.roleRef)
  const objectOk = Boolean(a.hasObject?.value && a.hasObject.entityId && a.hasObject.op)

  const l3Code = code.split('.').slice(0, 3).join('.')
  const mounted = flows.some(f =>
    f.apqcCode === l3Code
    || f.apqcCode === code
    || f.nodes.some(n => n.code === code),
  )

  const roleProbes: string[] = []
  if (latest && !roleOk) roleProbes.push('上一次记录没有确认角色，本次优先补问；如客户暂时说不清，记录为 [待确认]。')
  if (roleEntities.length) roleProbes.push(`客户是否提到这些岗位：${roleEntities.join('、')}？`)
  roleProbes.push('追问：谁发起、谁审批、谁复核？如果跨部门，边界在哪里？')

  const objectProbes: string[] = []
  if (latest && !objectOk) objectProbes.push('上一次记录没有确认对象，本次优先补问新建/查看/修改/审批分别对应什么单据。')
  if (objectEntities.length) objectProbes.push(`本体中可能相关的对象：${objectEntities.map(e => e.name).join('、')}；请让客户确认用词。`)
  objectProbes.push('追问：同一张单据在不同状态下由谁维护？有没有线下台账？')

  const ruleProbes: string[] = []
  if (rules.length) ruleProbes.push(`本体中已有规则：${rules.join('、')}；请客户确认是否适用于这一步。`)
  ruleProbes.push('追问：金额、权限、时限、状态、合规要求里，哪一条会让这一步卡住？')
  ruleProbes.push('客户说不清时，记录触发条件与例外的原话，不要替客户归纳。')

  const behaviorProbes: string[] = []
  behaviorProbes.push('追问：完成后是自动通知、生成单据、改状态，还是人工在系统里点一下？')
  behaviorProbes.push('追问：如果系统没做，客户现在靠什么补救（微信群/Excel/电话）？')

  const warnings: string[] = []
  if (records.length > 1) warnings.push(`该节点已有 ${records.length} 条访谈记录，本次以最新一条为对照。`)
  if (latest && !roleOk) warnings.push('已有记录缺少「角色」。')
  if (latest && !objectOk) warnings.push('已有记录缺少「对象」。')
  if (!mounted) warnings.push('该节点尚未挂载流程画板，访谈后可直接生成草稿。')
  if (!objectEntities.length) warnings.push('本体中暂无匹配的业务对象，先按客户口径记录，别急着造实体。')
  if (!rules.length) warnings.push('本体中暂无规则实体，注意记录金额/权限/时限等约束。')

  return {
    code,
    label,
    path,
    customerContext: `咱们在「${l2Label || labels[0] || '当前流程'}」里，${label}这一步……`,
    questions: [
      {
        id: 'role',
        title: '① 角色 —— 谁做？',
        ask: `「${label}」这一步通常由哪个岗位/部门发起？谁审批或复核？`,
        why: '角色决定后续 M5 权限设计，也是四问完整率的判断项。',
        probes: roleProbes,
      },
      {
        id: 'object',
        title: '② 对象 —— 动哪些单据？',
        ask: `做「${label}」要新建、查看、修改、审批哪些单据/台账/系统记录？`,
        why: '对象是 M1 实体与流程参与关系的直接来源。',
        probes: objectProbes,
      },
      {
        id: 'rule',
        title: '③ 规则 —— 有什么规矩？',
        ask: '什么情况下不能做、必须做或必须升级？金额、权限、时限、状态有什么限制？',
        why: '规则决定 M3 约束与后续审批流。',
        probes: ruleProbes,
      },
      {
        id: 'behavior',
        title: '④ 行为 —— 系统怎么处理？',
        ask: '这一步完成后，系统要自动做什么？通知谁？生成什么单据或状态变化？',
        why: '行为决定 M2 自动化与系统集成边界。',
        probes: behaviorProbes,
      },
    ],
    suggestedEntities: objectEntities,
    suggestedRules: rules,
    warnings,
  }
}
