import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KERNEL_DIR = resolve(dirname(fileURLToPath(import.meta.url)))
const APP_LITERALS = ['SAFETY_', 'BUDGET_', 'CADRE_', 'chemical-safety', 'finance-budget']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

describe('kernel boundary', () => {
  it('内核源码不得出现应用字面量或反向依赖应用层', () => {
    const violations: string[] = []
    for (const file of walk(KERNEL_DIR)) {
      if (file.endsWith('.test.ts')) continue
      const src = readFileSync(file, 'utf-8')
      for (const lit of APP_LITERALS) {
        if (src.includes(lit)) violations.push(`${file}: 含应用字面量 ${lit}`)
      }
      if (/from\s+['"][^'"]*(\/apps\/|\.\.\/apps)/.test(src)) {
        violations.push(`${file}: 反向 import 应用层`)
      }
    }
    expect(violations).toEqual([])
  })
})
