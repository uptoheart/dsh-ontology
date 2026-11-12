import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DomainDictEntry, DomainDictionary } from '../shared-types.js'
import { buildDomainDictionary } from '../builtin-frameworks.js'
import { getStorageRoot } from '../datastore.js'

/**
 * 标准领域目录 + 客户化别名。
 *
 * 目录本体来自内置框架（APQC PCF / 华为式 PCF）的 L1/L2，
 * 别名表持久化在 datastorage/dictionary.json，结构：
 *   { version: 1, updatedAt, frameworks: { [frameworkId]: { [code]: string[] } } }
 */

const ALIAS_FILE = 'dictionary.json'
const ALIAS_VERSION = 1

interface AliasFile {
  version: number
  updatedAt: number
  frameworks: Record<string, Record<string, string[]>>
}

const EMPTY_ALIAS_FILE: AliasFile = { version: ALIAS_VERSION, updatedAt: 0, frameworks: {} }

async function aliasFilePath(): Promise<string> {
  return join(await getStorageRoot(), ALIAS_FILE)
}

async function readAliasFile(): Promise<AliasFile> {
  try {
    const raw = await readFile(await aliasFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AliasFile>
    return {
      version: parsed.version ?? ALIAS_VERSION,
      updatedAt: parsed.updatedAt ?? 0,
      frameworks: parsed.frameworks ?? {},
    }
  } catch {
    return { ...EMPTY_ALIAS_FILE, frameworks: {} }
  }
}

async function writeAliasFile(file: AliasFile): Promise<void> {
  const path = await aliasFilePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(file, null, 2), 'utf-8')
}

/** 读取合并别名后的域词典（只读接口与领域对齐共用） */
export async function getDomainDictionary(frameworkId: string): Promise<DomainDictionary> {
  const base = buildDomainDictionary(frameworkId)
  const file = await readAliasFile()
  const overrides = file.frameworks[frameworkId] ?? {}
  const entries: DomainDictEntry[] = base.entries.map(e => {
    const aliases = overrides[e.code]
    return aliases && aliases.length ? { ...e, aliases: [...aliases] } : e
  })
  return { ...base, entries, updatedAt: Math.max(base.updatedAt, file.updatedAt) }
}

/**
 * 沉淀别名：同一编号下去重追加。
 * @returns 新增的别名数量
 */
export async function addDomainAliases(
  frameworkId: string,
  additions: Array<{ code: string; aliases: string[] }>,
): Promise<number> {
  const file = await readAliasFile()
  const fw = file.frameworks[frameworkId] ?? {}
  let added = 0
  for (const { code, aliases } of additions) {
    const list = fw[code] ?? []
    const seen = new Set(list.map(normalizeTerm))
    for (const raw of aliases) {
      const name = String(raw ?? '').trim()
      const key = normalizeTerm(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      list.push(name)
      added++
    }
    if (list.length) fw[code] = list
  }
  if (added > 0) {
    file.frameworks[frameworkId] = fw
    file.updatedAt = Date.now()
    await writeAliasFile(file)
  }
  return added
}

/** 归一化比较键：去空白/标点/括号，统一小写 */
export function normalizeTerm(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-—·、,，.。:：;；/\\()（）[\]【】{}<>《》"'"'`]+/g, '')
}
