import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendJson, sendHtml, sendOptions, readJsonBody } from './server-utils.js'
import {
  listImportedSuites, loadSuite, loadSuiteWithDerived, saveAnnotations, setSuiteFramework,
  importFromDatasource, assembleGraph, computeCoverage, computeProcessCoverage, computeCrudMatrix,
  listFrameworks, buildExport, createEntitiesBatch, buildFlowDraftFromInterviews,
  loadUserFrameworksIntoRegistry, saveUserFramework, exportPackage, importPackage,
  listFlowcharts, listFlowchartsForSuite, getFlowchart, saveFlowchart, deleteFlowchart,
  deriveFlowRelations, deriveInterviewRelations,
  listInterviews, saveInterview, deleteInterview,
} from './datastore.js'
import { resolveDatasourceRoot, discoverSuites } from './ontology-parser.js'
import {
  getBuiltinFramework, buildDomainDictionary, deriveOntologyCode, deriveApqcCode, parseApqcCode,
  registerFramework, validateFrameworkDefinition,
} from './builtin-frameworks.js'

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
    { method: 'POST', pattern: /^\/api\/suites\/import-package$/,       handler: apiImportPackage },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/package$/,      handler: apiExportPackage },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/entities$/,     handler: apiListEntities },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/entities\/batch$/, handler: apiBatchEntities },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/graph$/,        handler: apiGetGraph },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/derived-relations$/, handler: apiDerivedRelations },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/crud-matrix$/,  handler: apiCrudMatrix },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/export$/,       handler: apiExportSuite },
    { method: 'GET', pattern: /^\/api\/suites\/([^/]+)\/interviews$/,   handler: apiListInterviews },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/interviews$/,  handler: apiSaveInterview },
    { method: 'DELETE', pattern: /^\/api\/suites\/([^/]+)\/interviews\/([^/]+)$/, handler: apiDeleteInterview },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/annotations$/, handler: apiSaveAnnotations },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/framework$/,   handler: apiSetSuiteFramework },
    { method: 'POST', pattern: /^\/api\/suites\/([^/]+)\/flow-draft$/,  handler: apiFlowDraft },
    { method: 'GET', pattern: /^\/api\/frameworks$/,                    handler: apiListFrameworks },
    { method: 'POST', pattern: /^\/api\/frameworks\/import$/,           handler: apiImportFramework },
    { method: 'PUT', pattern: /^\/api\/frameworks\/([^/]+)$/,           handler: apiUpdateFramework },
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

  // 用户自定义框架：启动扫描 datastorage/frameworks/ 并注册（免重启可见）
  loadUserFrameworksIntoRegistry().catch(err => console.error('[dsh-ontology] user framework scan failed:', err))

  importFromDatasource(false).catch(err => console.error('[dsh-ontology] initial import failed:', err))

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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
  let body: { force?: boolean; framework?: unknown } = {}
  try { body = await readJsonBody(req) as any } catch { /* ignore */ }
  // 新套件框架：仅对本次导入中不存在的新套件生效（已有套件框架锁定不变）
  const fwId = typeof body?.framework === 'string' && body.framework.trim() ? body.framework.trim() : undefined
  if (fwId && !getBuiltinFramework(fwId)) {
    sendJson(res, 400, { success: false, message: `unknown framework: ${fwId}` }); return
  }
  const result = await importFromDatasource(!!body.force, fwId)
  sendJson(res, 200, { success: true, data: result })
}

/** 导出套件现场数据包（P5-4）：单文件 .dshont.json（meta+实体+关系+标注+访谈+流程图） */
async function apiExportPackage(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const payload = await exportPackage(params.p1)
  if (!payload) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${payload.filename}"`,
  })
  res.end(payload.content)
}

/** 导入套件现场数据包（P5-4）：按 meta.suiteId 整体覆盖（导入前由前端二次确认） */
async function apiImportPackage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as { package?: unknown } | null
  const pkg = body && body.package !== undefined ? body.package : body
  const result = await importPackage(pkg)
  if (!result) {
    sendJson(res, 400, { success: false, message: '不是合法的现场数据包（.dshont.json，schema=dsh-ontology-suite-package）' })
    return
  }
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

async function apiBatchEntities(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const body = await readJsonBody(req) as { items?: unknown }
  const rawItems = Array.isArray(body?.items) ? body.items : null
  if (!rawItems || rawItems.length === 0) { sendJson(res, 400, { success: false, message: 'items required' }); return }
  if (rawItems.length > 1000) { sendJson(res, 400, { success: false, message: '单次最多 1000 条' }); return }
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  const fwId = suite.meta.frameworkId ?? 'apqc-process'
  const items = rawItems.map((it: any) => ({
    name: typeof it?.name === 'string' ? it.name : '',
    kind: typeof it?.kind === 'string' ? it.kind : undefined,
    domain: typeof it?.domain === 'string' ? it.domain : undefined,
    anchor: Boolean(it?.anchor),
  }))
  const result = await createEntitiesBatch(params.p1, items, fwId)
  if (!result) { sendJson(res, 404, { success: false, message: 'batch import failed' }); return }
  sendJson(res, 200, { success: true, data: { created: result.created.length, anchored: result.anchored, skipped: result.skipped } })
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

async function apiExportSuite(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>, query: Record<string, string>): Promise<void> {
  const kind = query.kind ?? ''
  if (!(['minutes', 'crud', 'gap', 'domain'] as const).includes(kind as any)) {
    sendJson(res, 400, { success: false, message: `invalid kind: ${kind}（可选 minutes|crud|gap|domain）` }); return
  }
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  // 框架跟随套件 meta（项目级锁定），不信任客户端参数
  const fwId = suite.meta.frameworkId ?? 'apqc-process'
  const payload = await buildExport(params.p1, kind as any, fwId)
  if (!payload) { sendJson(res, 404, { success: false, message: 'export failed' }); return }
  res.writeHead(200, {
    'Content-Type': payload.mime,
    'Content-Disposition': `attachment; filename="${payload.filename}"`,
  })
  res.end(payload.content)
}

async function apiListInterviews(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  sendJson(res, 200, { success: true, data: await listInterviews(params.p1) })
}

async function apiFlowDraft(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  let body: { interviewIds?: unknown } = {}
  try { body = await readJsonBody(req) as any } catch { /* ignore */ }
  const interviewIds = Array.isArray(body?.interviewIds)
    ? body.interviewIds.filter((x): x is string => typeof x === 'string')
    : undefined
  const suite = await loadSuite(params.p1)
  if (!suite) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  const fwId = suite.meta.frameworkId ?? 'apqc-process'
  const result = await buildFlowDraftFromInterviews(params.p1, fwId, interviewIds)
  if (!result) { sendJson(res, 404, { success: false, message: 'flow draft failed' }); return }
  if (!result.draft) {
    sendJson(res, 400, { success: false, message: '没有可生成草稿的访谈记录' + (result.skipped.length ? `（${result.skipped.map(s => `${s.code} ${s.reason}`).join('；')}）` : '') })
    return
  }
  sendJson(res, 200, { success: true, data: result })
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

async function apiSetSuiteFramework(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const body = await readJsonBody(req) as { frameworkId?: unknown }
  const frameworkId = typeof body?.frameworkId === 'string' ? body.frameworkId.trim() : ''
  if (!frameworkId) { sendJson(res, 400, { success: false, message: 'frameworkId required' }); return }
  if (!getBuiltinFramework(frameworkId)) { sendJson(res, 400, { success: false, message: `unknown framework: ${frameworkId}` }); return }
  const meta = await setSuiteFramework(params.p1, frameworkId)
  if (!meta) { sendJson(res, 404, { success: false, message: `suite ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data: meta })
}

/** 更新框架定义（流程地图节点增删改/拖拽排序后保存）：校验 → 落盘 datastorage/frameworks/ → 注册运行时。
 *  内置框架允许同名覆盖（项目级定制，重启后由启动扫描遮蔽内置定义）；框架 JSON 全量替换。 */
async function apiUpdateFramework(req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const body = await readJsonBody(req) as { framework?: unknown }
  const fw = body?.framework as { frameworkId?: unknown; name?: unknown } | null | undefined
  if (!fw || typeof fw !== 'object') { sendJson(res, 400, { success: false, message: 'framework required' }); return }
  if (fw.frameworkId !== params.p1) {
    sendJson(res, 400, { success: false, message: `frameworkId（${String(fw.frameworkId)}）与 URL（${params.p1}）不一致` }); return
  }
  if (!getBuiltinFramework(params.p1)) { sendJson(res, 404, { success: false, message: `framework ${params.p1} not found` }); return }
  const { errors, stats } = validateFrameworkDefinition(fw)
  if (errors.length) { sendJson(res, 400, { success: false, message: '框架定义校验失败', errors, stats }); return }
  await saveUserFramework(fw as never)
  registerFramework(fw as never)
  sendJson(res, 200, { success: true, data: { frameworkId: fw.frameworkId, name: fw.name, ...stats } })
}

async function apiListFrameworks(_req: IncomingMessage, res: ServerResponse, _p: Record<string, string>, query: Record<string, string>): Promise<void> {
  const all = await listFrameworks()
  if (query.light === '1') {
    // 轻量清单：供框架下拉/标签展示，避免传输整棵框架树
    sendJson(res, 200, {
      success: true,
      data: all.map(f => ({
        frameworkId: f.frameworkId, name: f.name, source: f.source,
        version: f.version, description: f.description,
      })),
    })
    return
  }
  sendJson(res, 200, { success: true, data: all })
}

async function apiGetFramework(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> {
  const fw = getBuiltinFramework(params.p1)
  if (!fw) { sendJson(res, 404, { success: false, message: `framework ${params.p1} not found` }); return }
  sendJson(res, 200, { success: true, data: fw })
}

/** 导入自定义框架 JSON（P4-3）：校验 → 落盘 datastorage/frameworks/ → 注册进运行时（免重启） */
async function apiImportFramework(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as { framework?: unknown }
  const fw = body?.framework
  const { errors, stats } = validateFrameworkDefinition(fw)
  if (errors.length) {
    sendJson(res, 400, { success: false, message: '框架定义校验失败', errors, stats })
    return
  }
  const def = fw as { frameworkId: string; name: string }
  if (def.frameworkId === 'apqc-process' || def.frameworkId === 'hw-style-pcf') {
    sendJson(res, 400, { success: false, message: `frameworkId「${def.frameworkId}」为内置框架，不可覆盖` })
    return
  }
  await saveUserFramework(fw as never)
  registerFramework(fw as never)
  sendJson(res, 200, {
    success: true,
    data: { frameworkId: def.frameworkId, name: def.name, ...stats },
  })
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