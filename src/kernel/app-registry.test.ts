import { describe, it, expect } from 'vitest'
import { registerBuiltinApps } from '../apps/index.js'
import { DEFAULT_APP_ID, appIdOfSuite, getAppPack, listAppPacks } from '../kernel/app-registry.js'
import { mappingAxisOfKind } from '../shared-types.js'

describe('app registry', () => {
  it('注册内置应用包（幂等）', () => {
    registerBuiltinApps()
    registerBuiltinApps()
    const ids = listAppPacks().map(p => p.id)
    expect(ids).toContain('pcf')
    expect(ids).toContain('chemical-safety')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('旧套件缺省归属 pcf', () => {
    expect(DEFAULT_APP_ID).toBe('pcf')
    expect(appIdOfSuite(undefined)).toBe('pcf')
    expect(appIdOfSuite({})).toBe('pcf')
    expect(appIdOfSuite({ appId: 'chemical-safety' })).toBe('chemical-safety')
  })

  it('安全域实体不参与 APQC 双轴映射', () => {
    expect(mappingAxisOfKind('SAFETY_AREA')).toBe('none')
    expect(mappingAxisOfKind('SAFETY_OPERATION')).toBe('none')
    expect(mappingAxisOfKind('ENTITY')).toBe('domain')
    expect(mappingAxisOfKind('ACTIVITY')).toBe('process')
  })

  it('应用包声明完整', () => {
    const safety = getAppPack('chemical-safety')
    expect(safety).not.toBeNull()
    expect(safety?.kinds.some(k => k.kind === 'SAFETY_EVENT')).toBe(true)
    expect(safety?.relations.some(r => r.type === 'SAFETY_EVENT_CAUSED_BY')).toBe(true)
  })
})
