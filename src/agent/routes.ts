// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：/api/agent/* 路由
// 只读计算 + 独立状态文件；不改套件 meta，不影响现有页面。
// ──────────────────────────────────────────────────────────────────────

import type { IncomingMessage, ServerResponse } from 'node:http'
import { registerRoutes } from '../kernel/route-registry.js'
import type { RouteDef } from '../kernel/route-registry.js'
import { readJsonBody, sendJson } from '../server-utils.js'
import {
  computeCoverage, computeProcessCoverage, listFlowchartsForSuite, listInterviews, loadSuiteWithDerived,
} from '../datastore.js'
import { getBuiltinFramework } from '../builtin-frameworks.js'
import type { CoverageMatrix, FlowchartData, FrameworkDefinition, InterviewRecord, SuiteData } from '../shared-types.js'
import { buildAgentOverview, deriveAgentStage } from './status.js'
import { buildInterviewQuestions } from './questions.js'
import { buildAgentPrompt, buildLedgerMarkdown } from './prompts.js'
import { defaultAgentState, loadAgentState, normalizeDecisions, normalizeExports, saveAgentState, safeSuiteId } from './store.js'
import type { AgentPromptScene, AgentStage, AgentState } from './types.js'
import { AGENT_PROMPT_SCENES, AGENT_STAGES } from './types.js'

interface AgentContext {
  suite: SuiteData
  framework: FrameworkDefinition | null
  flows: FlowchartData[]
  interviews: InterviewRecord[]
  coverage: CoverageMatrix
  fwId: string
}

async function loadAgentContext(suiteId: string): Promise<AgentContext | null> {
  const suite = await loadSuiteWithDerived(suiteId)
  if (!suite) return null
  const fwId = suite.meta.frameworkId ?? 'apqc-process'
  const framework = getBuiltinFramework(fwId)
  const [flows, interviews] = await Promise.all([
    listFlowchartsForSuite(suiteId),
    listInterviews(suiteId),
  ])
  const coverage = computeCoverage(suite, fwId)
  coverage.process = computeProcessCoverage(suite, flows, fwId, interviews)
  return { suite, framework, flows, interviews, coverage, fwId }
}

async function resolveState(ctx: AgentContext): Promise<AgentState> {
  const suiteId = ctx.suite.meta.suiteId
  const stored = await loadAgentState(suiteId)
  if (stored) return stored
  const stage = deriveAgentStage({
    suite: ctx.suite,
    framework: ctx.framework,
    coverage: ctx.coverage,
    flows: ctx.flows,
    interviews: ctx.interviews,
  })
  return defaultAgentState(suiteId, stage)
}

const ok = (res: ServerResponse, data: unknown): void => sendJson(res, 200, { success: true, data })
const fail = (res: ServerResponse, code: number, message: string): void =>
  sendJson(res, code, { success: false, message })

function querySuiteId(query: Record<string, string>): string {
  return (query.suiteId ?? '').trim()
}

async function apiAgentOverview(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  query: Record<string, string>,
): Promise<void> {
  const suiteId = querySuiteId(query)
  if (!suiteId) { fail(res, 400, 'suiteId required'); return }
  const ctx = await loadAgentContext(suiteId)
  if (!ctx) { fail(res, 404, `suite ${suiteId} not found`); return }
  const state = await resolveState(ctx)
  ok(res, buildAgentOverview({ ...ctx, state }))
}

async function apiAgentState(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: Record<string, unknown>
  try { body = await readJsonBody(req) as Record<string, unknown> }
  catch { fail(res, 400, 'Invalid JSON'); return }

  const suiteId = typeof body?.suiteId === 'string' ? body.suiteId.trim() : ''
  if (!suiteId) { fail(res, 400, 'suiteId required'); return }

  const ctx = await loadAgentContext(suiteId)
  if (!ctx) { fail(res, 404, `suite ${suiteId} not found`); return }

  const current = await resolveState(ctx)
  const next: AgentState = {
    suiteId,
    stage: current.stage,
    decisions: current.decisions,
    exports: current.exports,
    updatedAt: Date.now(),
  }

  if (body.stage !== undefined) {
    if (typeof body.stage !== 'string' || !(AGENT_STAGES as readonly string[]).includes(body.stage)) {
      fail(res, 400, `invalid stage: ${String(body.stage)}（可选 ${AGENT_STAGES.join('|')}）`)
      return
    }
    next.stage = body.stage as AgentStage
  }
  if (body.decisions !== undefined) {
    if (!Array.isArray(body.decisions)) { fail(res, 400, 'decisions must be an array'); return }
    next.decisions = normalizeDecisions(body.decisions, next.stage)
  }
  if (body.exports !== undefined) {
    if (!Array.isArray(body.exports)) { fail(res, 400, 'exports must be an array'); return }
    next.exports = normalizeExports(body.exports)
  }

  await saveAgentState(next)
  ok(res, next)
}

async function apiAgentQuestions(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  query: Record<string, string>,
): Promise<void> {
  const suiteId = querySuiteId(query)
  const code = (query.code ?? '').trim()
  if (!suiteId) { fail(res, 400, 'suiteId required'); return }
  if (!code) { fail(res, 400, 'code required'); return }
  const ctx = await loadAgentContext(suiteId)
  if (!ctx) { fail(res, 404, `suite ${suiteId} not found`); return }
  if (!ctx.framework) { fail(res, 400, '当前套件未锁定可用框架，无法生成问题'); return }

  const set = buildInterviewQuestions({
    suite: ctx.suite,
    framework: ctx.framework,
    code,
    interviews: ctx.interviews,
    flows: ctx.flows,
  })
  if (!set) { fail(res, 404, `节点 ${code} 不在当前框架的 L3+ 层级中`); return }
  ok(res, set)
}

async function apiAgentPrompt(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  query: Record<string, string>,
): Promise<void> {
  const suiteId = querySuiteId(query)
  const scene = (query.scene ?? '').trim()
  if (!suiteId) { fail(res, 400, 'suiteId required'); return }
  if (!(AGENT_PROMPT_SCENES as readonly string[]).includes(scene)) {
    fail(res, 400, `invalid scene: ${scene}（可选 ${AGENT_PROMPT_SCENES.join('|')}）`)
    return
  }
  const ctx = await loadAgentContext(suiteId)
  if (!ctx) { fail(res, 404, `suite ${suiteId} not found`); return }
  const state = await resolveState(ctx)
  ok(res, buildAgentPrompt({ ...ctx, state, scene: scene as AgentPromptScene }))
}

async function apiAgentLedger(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  query: Record<string, string>,
): Promise<void> {
  const suiteId = querySuiteId(query)
  if (!suiteId) { fail(res, 400, 'suiteId required'); return }
  const ctx = await loadAgentContext(suiteId)
  if (!ctx) { fail(res, 404, `suite ${suiteId} not found`); return }
  const state = await resolveState(ctx)
  const markdown = buildLedgerMarkdown(state, ctx.suite.meta.project)
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${safeSuiteId(suiteId)}-decisions.md"`,
  })
  res.end(markdown)
}

const agentRoutes: RouteDef[] = [
  { method: 'GET', pattern: /^\/api\/agent\/overview$/, handler: apiAgentOverview },
  { method: 'POST', pattern: /^\/api\/agent\/state$/, handler: apiAgentState },
  { method: 'GET', pattern: /^\/api\/agent\/questions$/, handler: apiAgentQuestions },
  { method: 'GET', pattern: /^\/api\/agent\/prompt$/, handler: apiAgentPrompt },
  { method: 'GET', pattern: /^\/api\/agent\/ledger$/, handler: apiAgentLedger },
]

registerRoutes(agentRoutes)
