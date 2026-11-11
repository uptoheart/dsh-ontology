import type { AppPack, AppSummary } from './types.js'
import { summarizeApp } from './types.js'

const registry = new Map<string, AppPack>()

/** 缺省应用（旧套件 meta.appId 缺失时按此兼容） */
export const DEFAULT_APP_ID = 'pcf'

export function registerAppPack(pack: AppPack): void {
  registry.set(pack.id, pack)
}

export function unregisterAppPack(id: string): boolean {
  if (id === DEFAULT_APP_ID) return false
  return registry.delete(id)
}

export function getAppPack(id: string): AppPack | null {
  return registry.get(id) ?? null
}

export function listAppPacks(): AppPack[] {
  return [...registry.values()]
}

export function listAppSummaries(): AppSummary[] {
  return listAppPacks().map(summarizeApp)
}

/** 读取套件的应用归属（旧数据缺省 pcf） */
export function appIdOfSuite(meta: { appId?: string } | null | undefined): string {
  return meta?.appId ?? DEFAULT_APP_ID
}
