import type { Context } from '@deepseek-ai/cordis'
import { startServer, setDshCtx } from './server.js'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { appendFileSync } from 'node:fs'

const LOG_FILE = join(homedir(), '.dsh', 'dsh-ontology.log')

function debugLog(...parts: unknown[]): void {
  const msg = parts.map(p => typeof p === 'string' ? p : String(p)).join(' ')
  try { appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`) } catch { console.log(msg) }
}

export const name = 'dsh-ontology'
export const inject: string[] = []

export async function apply(ctx: Context) {
  setDshCtx(ctx as unknown as Record<string, unknown>)

  try {
    const { url } = await startServer()
    debugLog(`UI server started: ${url}`)
  } catch (err) {
    debugLog('ERROR starting UI server:', err)
  }
}