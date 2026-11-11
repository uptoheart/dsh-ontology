// ──────────────────────────────────────────────────────────────────────
// FDE 工作 Agent：状态持久化（独立文件，不写套件 meta，零迁移）
// 位置：<datastorage>/agent/<suiteId>.json
// ──────────────────────────────────────────────────────────────────────

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getStorageRoot } from '../datastore.js'
import type {
  AgentDecision, AgentExportKind, AgentExportRecord, AgentStage, AgentState,
} from './types.js'
import { AGENT_EXPORT_KINDS, AGENT_STAGES } from './types.js'

const MAX_DECISIONS = 300
const MAX_EXPORTS = 200

export function safeSuiteId(suiteId: string): string {
  return String(suiteId || '').replace(/[^\w.-]/g, '_') || 'unknown'
}

function agentDir(root: string): string {
  return join(root, 'agent')
}

function statePath(root: string, suiteId: string): string {
  return join(agentDir(root), `${safeSuiteId(suiteId)}.json`)
}

export function defaultAgentState(suiteId: string, stage: AgentStage = 'prep'): AgentState {
  return { suiteId, stage, decisions: [], exports: [], updatedAt: 0 }
}

function isStage(value: unknown): value is AgentStage {
  return typeof value === 'string' && (AGENT_STAGES as readonly string[]).includes(value)
}

function isExportKind(value: unknown): value is AgentExportKind {
  return typeof value === 'string' && (AGENT_EXPORT_KINDS as readonly string[]).includes(value)
}

function sanitizeDecision(raw: unknown, fallbackStage: AgentStage): AgentDecision | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const topic = typeof item.topic === 'string' ? item.topic.trim().slice(0, 200) : ''
  const question = typeof item.question === 'string' ? item.question.trim().slice(0, 1000) : ''
  if (!topic && !question) return null
  const now = Date.now()
  const createdAt = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : now
  const updatedAt = typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : now
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : `dec-${now}-${Math.random().toString(36).slice(2, 8)}`,
    stage: isStage(item.stage) ? item.stage : fallbackStage,
    topic: topic || '未命名',
    question,
    answer: typeof item.answer === 'string' ? item.answer.trim().slice(0, 2000) : '',
    status: item.status === 'confirmed' ? 'confirmed' : 'pending',
    createdAt,
    updatedAt,
  }
}

function sanitizeExport(raw: unknown): AgentExportRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (!isExportKind(item.kind)) return null
  const at = typeof item.at === 'number' && Number.isFinite(item.at) ? item.at : Date.now()
  return { kind: item.kind, at }
}

function sanitizeState(raw: unknown, suiteId: string): AgentState | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const stage = isStage(item.stage) ? item.stage : 'prep'
  const decisions = Array.isArray(item.decisions)
    ? item.decisions.map(d => sanitizeDecision(d, stage)).filter((d): d is AgentDecision => Boolean(d)).slice(-MAX_DECISIONS)
    : []
  const exports = Array.isArray(item.exports)
    ? item.exports.map(sanitizeExport).filter((e): e is AgentExportRecord => Boolean(e)).slice(-MAX_EXPORTS)
    : []
  const updatedAt = typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : 0
  return { suiteId, stage, decisions, exports, updatedAt }
}

export function normalizeDecisions(raw: unknown, fallbackStage: AgentStage): AgentDecision[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(d => sanitizeDecision(d, fallbackStage))
    .filter((d): d is AgentDecision => Boolean(d))
    .slice(-MAX_DECISIONS)
}

export function normalizeExports(raw: unknown): AgentExportRecord[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(sanitizeExport)
    .filter((e): e is AgentExportRecord => Boolean(e))
    .slice(-MAX_EXPORTS)
}

export async function loadAgentState(suiteId: string): Promise<AgentState | null> {
  const root = await getStorageRoot()
  try {
    const raw = await readFile(statePath(root, suiteId), 'utf-8')
    return sanitizeState(JSON.parse(raw), suiteId)
  } catch {
    return null
  }
}

export async function saveAgentState(state: AgentState): Promise<void> {
  const root = await getStorageRoot()
  await mkdir(agentDir(root), { recursive: true })
  const payload: AgentState = {
    suiteId: state.suiteId,
    stage: state.stage,
    decisions: state.decisions.slice(-MAX_DECISIONS),
    exports: state.exports.slice(-MAX_EXPORTS),
    updatedAt: Date.now(),
  }
  await writeFile(statePath(root, state.suiteId), JSON.stringify(payload, null, 2), 'utf-8')
}
