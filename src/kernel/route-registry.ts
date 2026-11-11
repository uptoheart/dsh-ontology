import type { IncomingMessage, ServerResponse } from 'node:http'

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  query: Record<string, string>,
) => Promise<void> | void

export interface RouteDef {
  method: string
  pattern: RegExp
  handler: RouteHandler
}

const registered: RouteDef[] = []

/** 应用包在模块初始化时注册自己的路由（server 启动时合并） */
export function registerRoutes(list: RouteDef[]): void {
  registered.push(...list)
}

export function getRegisteredRoutes(): RouteDef[] {
  return [...registered]
}

export function clearRegisteredRoutes(): void {
  registered.length = 0
}
