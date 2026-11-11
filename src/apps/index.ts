import { registerAppPack } from '../kernel/app-registry.js'
import { PCF_APP_PACK } from './pcf/pack.js'
import { SAFETY_APP_PACK } from './safety/pack.js'

let registered = false

/** 注册内置应用包（幂等；server 启动与测试均可调用） */
export function registerBuiltinApps(): void {
  if (registered) return
  registerAppPack(PCF_APP_PACK)
  registerAppPack(SAFETY_APP_PACK)
  registered = true
}

registerBuiltinApps()
