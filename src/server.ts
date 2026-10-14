import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendJson, sendHtml, sendOptions } from './server-utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type DshContext = Record<string, unknown>

type Handler = (req: IncomingMessage, res: ServerResponse, url: string) => Promise<void> | void

function route(method: string, url: string): Handler | null {
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    return (_req, res) => sendHtml(res, HTML)
  }
  return null
}

let HTML = ''
let dshCtx: DshContext | null = null

export function setDshCtx(ctx: DshContext): void {
  dshCtx = ctx
}

export function getDshCtx(): DshContext | null {
  return dshCtx
}

export async function startServer(port = 17320): Promise<{ url: string; close: () => Promise<void> }> {
  HTML = readFileSync(resolve(__dirname, 'ui.html'), 'utf-8')

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')

    const { method = 'GET', url = '/' } = req

    if (method === 'OPTIONS') {
      sendOptions(res)
      return
    }

    const handler = route(method, url)

    if (!handler) {
      sendJson(res, 404, { error: 'Not found' })
      return
    }

    try {
      await handler(req, res, url)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { success: false, message })
    }
  })

  return new Promise((resolvePromise, reject) => {
    const tryListen = (currentPort: number, remaining: number): void => {
      server.listen(currentPort, '127.0.0.1', () => {
        const addr = server.address()
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to start server'))
          return
        }
        const url = `http://127.0.0.1:${addr.port}`
        resolvePromise({
          url,
          close: () => new Promise<void>((resClose) => server.close(() => resClose())),
        })
      })
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && remaining > 0) {
          tryListen(currentPort + 1, remaining - 1)
        } else {
          reject(err)
        }
      })
    }
    tryListen(port, 10)
  })
}