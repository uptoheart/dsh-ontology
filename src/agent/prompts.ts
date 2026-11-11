// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：提示词工坊 + 决策台账导出
// 只拼装当前套件的真实上下文，不调用任何模型、不自动发送。
// ──────────────────────────────────────────────────────────────────────

import type { AgentOverviewInput } from './status.js'
import { buildAgentOverview } from './status.js'
import { buildInterviewQuestions } from './questions.js'
import type { AgentPrompt, AgentPromptScene, AgentState } from './types.js'
import { AGENT_STAGES, STAGE_LABELS } from './types.js'

export interface AgentPromptInput extends AgentOverviewInput {
  scene: AgentPromptScene
}

const SCENE_TITLES: Record<AgentPromptScene, string> = {
  diagnose: '进场诊断会议提纲',
  interview: '单节点访谈提纲',
  model: '本体建模草案',
  validate: '演示脚本与验收要点',
  handoff: '回带交接摘要',
}

const SCENE_TASKS: Record<AgentPromptScene, string> = {
  diagnose: [
    '请产出一次 90 分钟的进场诊断会议提纲，必须包含：',
    '1. 会议目标（客户视角，不超过 3 条）；',
    '2. 分段时间盒与议程（开场、现状、痛点、影响、优先级、收尾）；',
    '3. 每个议程段要问的 3–5 个问题，按「决策人 / 流程 Owner / IT / 最终用户」分层；',
    '4. 需要客户现场提供的资料清单（单据、报表、系统清单、字段样例）；',
    '5. 会议结束时要客户确认的签字项（对应痛点排序表）。',
  ].join('\n'),
  interview: [
    '请围绕下方覆盖缺口，产出可直接照读的访谈提纲：',
    '1. 每个目标节点按「角色 / 对象 / 规则 / 行为」四问组织；',
    '2. 每题给出客户能听懂的问法、2–3 条追问、以及为什么问；',
    '3. 标注本体中可能相关的对象与规则，提醒 FDE 让客户确认用词；',
    '4. 客户说不清的地方，统一记为 [待确认]，不要替客户归纳。',
  ].join('\n'),
  model: [
    '请基于现有访谈与实体，产出一份供讨论的本体建模草案：',
    '1. M1 对象与属性：对象名、业务定义、关键属性、来源单据；',
    '2. M2 行为：动作名、触发对象、前置状态、结果；',
    '3. M3 规则：条件、约束、例外、责任角色；',
    '4. M5 角色与权限：角色、可见对象、可执行动作；',
    '5. 每条结论标注依据（访谈编号或实体编号）；没有依据的写 [待确认]。',
  ].join('\n'),
  validate: [
    '请产出面向客户的演示脚本与验收要点：',
    '1. 3–5 个端到端场景（从已挂载流程中选择），每个场景写：客户开场问题、操作路径、预期结果、验收问题；',
    '2. 明确哪些场景还不能演示、缺什么数据或流程；',
    '3. 产出客户验收清单（可勾选）与会后跟进项；',
    '4. 不要承诺未验证的数字。',
  ].join('\n'),
  handoff: [
    '请产出回带交接摘要，供下一任 FDE 或项目组直接接手：',
    '1. 本次进场完成了什么（按阶段列）；',
    '2. 已确认的关键决策与仍待确认的口径；',
    '3. 当前最大风险与数据缺口；',
    '4. 下次进场前必须准备的材料与需要客户配合的事项；',
    '5. 可复用的资产（流程、实体、规则、话术）。',
  ].join('\n'),
}

function commonContext(input: AgentOverviewInput): string[] {
  const { suite, framework, coverage, interviews, flows, state } = input
  const overview = buildAgentOverview(input)
  const metricLine = (key: string): string => {
    const metric = overview.metrics.find(m => m.key === key)
    return metric ? `${metric.value}（${metric.detail}）` : '—'
  }
  const process = coverage.process
  const pending = state.decisions.filter(d => d.status === 'pending').slice(0, 5)
  const gaps = (process?.gapList ?? []).slice(0, 5)
  const mounted = (process?.mountedFlows ?? []).slice(0, 5)
  const lines: string[] = []

  lines.push('## 项目上下文')
  lines.push(`- 客户/项目：${suite.meta.project?.trim() || '未填写'}（套件 ${suite.meta.suiteId}）`)
  lines.push(`- 业务域：${suite.meta.domain || '未填写'}`)
  lines.push(`- 流程框架：${framework?.name ?? suite.meta.frameworkId ?? '未锁定'}`)
  lines.push(`- 当前阶段：${STAGE_LABELS[state.stage]}（门禁 ${overview.gates.filter(g => g.passed).length}/${overview.gates.length}）`)
  lines.push(`- 套件规模：实体 ${suite.entities.length} 条 / 关系 ${suite.relations.length} 条 / 访谈 ${interviews.length} 条 / 画板 ${flows.length} 张`)
  lines.push(`- 域锚定率：${metricLine('domainAnchor')}`)
  lines.push(`- 流程挂载率：${metricLine('processMounted')}`)
  lines.push(`- 四问完整率：${metricLine('interviewComplete')}`)
  lines.push(`- 一致性风险：${metricLine('consistency')}`)
  lines.push(`- 未挂载 L3 缺口 Top ${gaps.length || 0}：${gaps.length ? gaps.map(g => `${g.code} ${g.label}`).join('；') : '无'}`)
  lines.push(`- 已挂载流程：${mounted.length ? mounted.map(m => `${m.name}（${m.apqcCode}）`).join('；') : '无'}`)
  if (pending.length) {
    lines.push(`- 待确认口径：${pending.map(d => `[${STAGE_LABELS[d.stage]}] ${d.topic}：${d.question}`).join('；')}`)
  } else {
    lines.push('- 待确认口径：无')
  }
  const risks = overview.risks
  lines.push(`- 当前风险：${risks.length ? risks.map(r => `${r.title}（${r.detail}）`).join('；') : '无'}`)
  return lines
}

function interviewOutline(input: AgentOverviewInput): string[] {
  if (!input.framework) return []
  const gaps = (input.coverage.process?.gapList ?? []).slice(0, 3)
  if (!gaps.length) return ['## 访谈目标节点', '- 当前没有未挂载的 L3 缺口；可从已挂载流程中挑一个节点复核四问。']
  const lines: string[] = ['## 访谈目标节点']
  for (const gap of gaps) {
    const set = buildInterviewQuestions({
      suite: input.suite,
      framework: input.framework,
      code: gap.code,
      interviews: input.interviews,
      flows: input.flows,
    })
    if (!set) continue
    lines.push(`### ${gap.code} ${gap.label}`)
    lines.push(set.customerContext)
    for (const q of set.questions) {
      lines.push(`- ${q.title}${q.ask}`)
      for (const probe of q.probes) lines.push(`  - 追问：${probe}`)
    }
    if (set.suggestedEntities.length) {
      lines.push(`- 本体候选对象：${set.suggestedEntities.map(e => `${e.name}（${e.kind}）`).join('、')}`)
    }
    if (set.suggestedRules.length) lines.push(`- 本体候选规则：${set.suggestedRules.join('、')}`)
    lines.push('')
  }
  return lines
}

export function buildAgentPrompt(input: AgentPromptInput): AgentPrompt {
  const scene = input.scene
  const lines: string[] = []

  lines.push(`# FDE 工作提示词｜${SCENE_TITLES[scene]}`)
  lines.push('')
  lines.push('## 你的角色')
  lines.push('你是一名 Forward Deployed Engineer（FDE），正在客户现场推进交付。你的任务是帮助 FDE 把下面的现场数据变成可执行、可确认的工作产出。')
  lines.push('')
  lines.push(...commonContext(input))
  lines.push('')

  if (scene === 'interview') {
    lines.push(...interviewOutline(input))
  }

  lines.push('## 任务')
  lines.push(SCENE_TASKS[scene])
  lines.push('')
  lines.push('## 输出要求')
  lines.push('- 使用客户能听懂的简体中文，避免堆术语；必要的术语给出客户叫法。')
  lines.push('- 不得编造数据、客户名称、金额或结论；信息不足一律写 [待确认]。')
  lines.push('- 每条结论尽量标注依据（流程编号 / 实体名 / 访谈记录编号）。')
  lines.push('- 输出结构清晰，可直接复制到会议纪要或交付文档。')

  return {
    scene,
    title: SCENE_TITLES[scene],
    content: lines.join('\n'),
  }
}

export function buildLedgerMarkdown(state: AgentState, projectName?: string): string {
  const lines: string[] = []
  const pending = state.decisions.filter(d => d.status === 'pending').length
  const confirmed = state.decisions.filter(d => d.status === 'confirmed').length
  lines.push(`# ${projectName?.trim() || state.suiteId} 交付决策台账`)
  lines.push('')
  lines.push(`> 套件：${state.suiteId} ｜ 当前阶段：${STAGE_LABELS[state.stage]} ｜ 已确认 ${confirmed} 条 ｜ 待确认 ${pending} 条`)
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`)
  lines.push('')

  if (!state.decisions.length) {
    lines.push('暂无决策记录。')
    return lines.join('\n')
  }

  for (const stage of AGENT_STAGES) {
    const items = state.decisions.filter(d => d.stage === stage)
    if (!items.length) continue
    lines.push(`## ${STAGE_LABELS[stage]}`)
    for (const item of items) {
      const flag = item.status === 'confirmed' ? '已确认' : '待确认'
      lines.push(`- [${flag}] ${item.topic || '未命名'}：${item.question || '—'}`)
      if (item.answer) lines.push(`  - 结论：${item.answer}`)
      lines.push(`  - 更新时间：${new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false })}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
