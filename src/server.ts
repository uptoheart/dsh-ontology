import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendJson, sendHtml, sendOptions, readJsonBody } from './server-utils.js'
import {
  listImportedSuites, loadSuite, loadSuiteWithDerived, saveAnnotations,
  importFromDatasource, assembleGraph, computeCoverage, computeProcessCoverage, computeCrudMatrix,
  listFrameworks,
  listFlowcharts, listFlowchartsForSuite, getFlowchart, saveFlowchart, deleteFlowchart,
  deriveFlowRelations, deriveInterviewRelations,
  listInterviews, saveInterview, deleteInterview,
} from './datastore.js'
import { resolveDatasourceRoot, discoverSuites } from './ontology-parser.js'
import { getBuiltinFramework, buildDomainDictionary, deriveOntologyCode, deriveApqcCode, parseApqcCode } from './builtin-frameworks.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type DshContext = Record<string, unknown>
type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, query: Record<string, string>) => Promise<void> | void

// ─────────────── 路由表 ───────────────
interface RouteDef { method: string; pattern: RegExp; handler: Handler }

function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const [p, q] = url.split('?')
  const query: Record<string, string> = {}
  if (q) for (const [k, v] of new URLSearchParams(q)) query[k] = v
  return { path: p, query }
}

function extractParamNames(src: string): string[] {
  const names: string[] = []
  let idx = 0
  for (const ch of src) if (ch === '(') names.push(`p${++idx}`)
  return names
}

function matchRoute(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const routes: RouteDef[] = [
    { method: 'GET', pattern: /^\/$/,                                    handler: serveHtml },
    { method: 'GET', pattern: /^\/index\.html$/,                        handler: serveHtml },
    { method: 'GET', pattern: /^\/api\/suites$/,                        handler: apiListSuites },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)$/,               handler: apiGetSuite },
    { method: 'POST', pattern: /^\/api\/suites\/import$/,               handler: apiImportSuites },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/entities$/,     handler: apiListEntities },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/graph$/,        handler: apiGetGraph },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/derived-relations$/, handler: apiDerivedRelations },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/crud-matrix$/,  handler: apiCrudMatrix },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/interviews$/,   handler: apiListInterviews },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/interviews$/,  handler: apiSaveInterview },
    { method: 'DELETE', pattern: /^\/api\/suites\/([^/]+)\/interviews\/([^/]+)$/, handler: apiDeleteInterview },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/annotations$/, handler: apiSaveAnnotations },
    { method: 'GET', pattern: /^\/api\/frameworks$/,                    handler: apiListFrameworks },
    { method: 'GET', pattern: /^\/api\/frameworks\/([^/]+)$/,           handler: apiGetFramework },
    { method: 'GET', pattern: /^\/api\/coverage$/,                      handler: apiCoverage },
    { method: 'GET', pattern: /^\/api\/dictionary$/,                    handler: apiDictionary },
    { method: 'GET', pattern: /^\/api\/datasource\/suites$/,           handler: apiDatasourceSuites },
    { method: 'GET', pattern: /^\/api\/ontology-code\/derive$/,        handler: apiDeriveOntologyCode },
    { method: 'GET', pattern: /^\/api\/flowcharts$/,                   handler: apiListFlowcharts },
    { method: 'POST', pattern: /^\/api\/flowcharts$/,                  handler: apiSaveFlowchart },
    { method: 'GET', pattern: /^\/api\/flowcharts\/([^/]+)$/,          handler: apiGetFlowchart },
    { method: 'DELETE', pattern: /^\/api\/flowcharts\/([^/]+)$/,       handler: apiDeleteFlowchart },
  ]

  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.pattern)
    if (m) {
      const names = extractParamNames(r.pattern.source)
      const params: Record<string, string> = {}
      names.forEach((name, i) => { params[name] = m[i + 1] ?? '' })
      return { handler: r.handler, params }
    }
  }
  return null
}

let HTML = ''
let dshCtx: DshContext | null = null

export function setDshCtx(ctx: DshContext): void { dshCtx = ctx }
export function getDshCtx(): DshContext | null { return dshCtx }

// ─────────────── Server ───────────────
export async function startServer(port = 17320): Promise<{ url: string; close: () => Promise<void> }> {
  HTML = readFileSync(resolve(__dirname, 'ui.html'), 'utf-8')

  importFromDatasource(false).catch(err => console.error('[dsh-ontology] initial import failed:', err))

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')

    const { method = 'GET', url = '/' } = req
    if (method === 'OPTIONS') { sendOptions(res); return }

    const { path, query } = parseUrl(url)
    const matched = matchRoute(method, path)
    if (!matched) { sendJson(res, 404, { error: 'Not found', method, path }); return }

    try {
      await matched.handler(req, res, matched.params, query)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[dsh-ontology] handler error:', message)
      sendJson(res, 500, { success: false, message })
    }
  })

  return new Promise((resolvePromise, reject) => {
    const tryListen = (currentPort: number, remaining: number): void => {
      server.listen(currentPort, '127.0.0.1', () => {
        const addr = server.address()
        if (!addr || typeof addr === 'string') { reject(new Error('Failed to start server')); return }
        resolvePromise({
          url: `http://127.0.0.1:${addr.port}`,
          close: () => new Promise<void>(resClose => server.close(() => resClose())),
        })
      })
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && remaining > 0) tryListen(currentPort + 1, remaining - 1)
        else reject(err)
      })
    }
    tryListen(port, 10)
  })
}

// ─────────────── Handler 实现 ───────────────

async function serveHtml(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendHtml(res, HTML)
}

async function apiListSuites(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const suites = await listImportedSuites()
  sendJson(res, 200, { success: true, data: suites })
}

async function apiGetSuite(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data: suite })
}

async function apiImportSuites(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { force?: boolean } = {}
  try { body = await readJsonBody(req) as any } catch { /* ignore */ }
  const result = await importFromDatasource(!!body.force)
  sendJson(res, 200, { success: true, data: result })
}

async function apiListEntities(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>, query: Record<string, string>): Promise<void> {
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  let entities = suite.entities
  if (query.kind) entities = entities.filter(e => e.kind === query.kind)
  const kw = (query.keyword ?? '').toLowerCase()
  if (kw) entities = entities.filter(e => e.name.toLowerCase().includes(kw) || e.rawId.toLowerCase().includes(kw))
  sendJson(res, 200, { success: true, data: { entities, total: suite.entities.length, filtered: entities.length } })
}

async function apiGetGraph(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const suite = await loadSuiteWithDerived(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data: assembleGraph(suite) })
}

async function apiDerivedRelations(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  const flows = await listFlowchartsForSuite(params.p1)
  const interviews = await listInterviews(params.p1)
  sendJson(res, 200, {
    success: true,
    data: {
      relations: [...deriveFlowRelations(suite, flows), ...deriveInterviewRelations(suite, interviews)],
      flowCount: flows.length,
      interviewCount: interviews.length,
    },
  })
}

async function apiCrudMatrix(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  const [flows, interviews] = await Promise.all([
    listFlowchartsForSuite(params.p1),
    listInterviews(params.p1),
  ])
  sendJson(res, 200, { success: true, data: computeCrudMatrix(suite, flows, interviews) })
}

async function apiListInterviews(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  sendJson(res, 200, { success: true, data: await listInterviews(params.p1) })
}

async function apiSaveInterview(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const body = await readJsonBody(req) as {
    id?: string; apqcCode?: string; note?: string
    answers?: { hasRole?: unknown; hasObject?: unknown; hasRule?: unknown; hasBehavior?: unknown }
  }
  if (!body || typeof body.apqcCode !== 'string' || !body.apqcCode.trim()) {
    sendJson(res, 400, { success: false, message: 'apqcCode required' }); return
  }
  const answers: Record<string, unknown> = {}
  for (const key of ['hasRole', 'hasObject', 'hasRule', 'hasBehavior'] as const) {
    const a = body.answers?.[key]
    if (a && typeof a === 'object') {
      answers[key] = {
        value: Boolean((a as any).value),
        roleRef: typeof (a as any).roleRef === 'string' ? (a as any).roleRef : undefined,
        entityId: typeof (a as any).entityId === 'string' ? (a as any).entityId : undefined,
        op: typeof (a as any).op === 'string' ? (a as any).op : undefined,
        ruleRef: typeof (a as any).ruleRef === 'string' ? (a as any).ruleRef : undefined,
        behaviorRef: typeof (a as any).behaviorRef === 'string' ? (a as any).behaviorRef : undefined,
        note: typeof (a as any).note === 'string' ? (a as any).note : undefined,
      }
    }
  }
  const saved = await saveInterview(params.p1, {
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    apqcCode: body.apqcCode.trim(),
    answers: answers as any,
    note: typeof body.note === 'string' ? body.note : undefined,
  })
  sendJson(res, 200, { success: true, data: saved })
}

async function apiDeleteInterview(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const ok = await deleteInterview(params.p1, params.p2)
  if (!ok) { sendJson(res, 404, { success: false, message: 'interview not found' }); return }
  sendJson(res, 200, { success: true, data: { deleted: params.p2 } })
}

async function apiSaveAnnotations(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const body = await readJsonBody(req) as any
  if (!body) { sendJson(res, 400, { success: false, message: 'missing body' }); return }
  await saveAnnotations(params.p1, body)
  sendJson(res, 200, { success: true })
}

async function apiListFrameworks(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, { success: true, data: await listFrameworks() })
}

async function apiGetFramework(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const fw = getBuiltinFramework(params.p1)
  if (!fw) { sendJson(res, 404, { success: false, message: `framework ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data: fw })
}

async function apiCoverage(_req: IncomingMessage, res: ServerResponse, _p: Record<string, string>, query: Record<string, string>): Promise<void> {
  const fw = query.framework ?? 'apqc-process'
  const suiteId = query.suite
  if (!suiteId) { sendJson(res, 400, { success: false, message: 'suite query param required' }); return }
  const suite = await loadSuite(suiteId)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${suiteId} not found` }); return }
  const flows = await listFlowchartsForSuite(suiteId)
  const interviews = await listInterviews(suiteId)
  const data = computeCoverage(suite, fw)
  data.process = computeProcessCoverage(suite, flows, fw, interviews)
  sendJson(res, 200, { success: true, data })
}

async function apiDictionary(_req: IncomingMessage, res: ServerResponse, _p: Record<string, string>, query: Record<string, string>): Promise<void> {
  const fw = query.framework ?? 'apqc-process'
  sendJson(res, 200, { success: true, data: buildDomainDictionary(fw) })
}

async function apiDatasourceSuites(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const root = resolveDatasourceRoot()
  const disc = await discoverSuites(root)
  sendJson(res, 200, {
    success: true,
    data: disc.map(d => ({
      suiteId: d.suiteId,
      sourceDir: d.dir,
      domain: d.manifest.domain as string | undefined,
      project: d.manifest.project as string | undefined,
      fileCount: d.fileCount,
      maxMtime: d.maxMtime,
      modelFiles: d.manifest.model_files ?? [],
    })),
  })
}

async function apiDeriveOntologyCode(_req: IncomingMessage, res: ServerResponse, _p: Record<string, string>, query: Record<string, string>): Promise<void> {
  const direction = query.direction ?? 'apqc->ontology'
  const code = query.code
  if (!code) { sendJson(res, 400, { success: false, message: 'code query param required' }); return }
  if (direction === 'apqc->ontology') {
    const ontologyCode = deriveOntologyCode(code)
    sendJson(res, 200, { success: true, data: { apqcCode: code, ontologyCode, parsed: parseApqcCode(code) } })
  } else {
    const apqcCode = deriveApqcCode(code)
    if (!apqcCode) { sendJson(res, 400, { success: false, message: 'invalid ontology code' }); return }
    sendJson(res, 200, { success: true, data: { ontologyCode: code, apqcCode } })
  }
}

// ─────────────── 流程图 ───────────────

async function apiListFlowcharts(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, { success: true, data: await listFlowcharts() })
}

async function apiGetFlowchart(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const data = await getFlowchart(params.p1)
  if (!data) { sendJson(res, 404, { success: false, message: `flowchart ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data })
}

async function apiSaveFlowchart(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as {
    id?: string; name?: string; nodes?: unknown; edges?: unknown
    suiteId?: unknown; apqcCode?: unknown; semantics?: unknown
  }
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    sendJson(res, 400, { success: false, message: 'name required' }); return
  }
  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    sendJson(res, 400, { success: false, message: 'nodes and edges required' }); return
  }
  // 语义层轻校验：participations/activities 结构不符合时不落盘语义
  let semantics = body.semantics as any
  if (semantics && typeof semantics === 'object') {
    if (!Array.isArray(semantics.participations)) semantics.participations = []
    if (!semantics.activities || typeof semantics.activities !== 'object') semantics.activities = {}
  } else {
    semantics = undefined
  }
  const saved = await saveFlowchart({
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    name: body.name.trim().slice(0, 80),
    suiteId: typeof body.suiteId === 'string' && body.suiteId ? body.suiteId : undefined,
    apqcCode: typeof body.apqcCode === 'string' && body.apqcCode ? body.apqcCode : undefined,
    nodes: body.nodes as any,
    edges: body.edges as any,
    semantics,
  })
  sendJson(res, 200, { success: true, data: saved })
}

async function apiDeleteFlowchart(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const ok = await deleteFlowchart(params.p1)
  if (!ok) { sendJson(res, 404, { success: false, message: `flowchart ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true })
}