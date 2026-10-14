# dsh-ontology

> Personal ontology plugin for DeepSeek Harness (DSH).
> 用于建立和管理个人本体论的 DeepSeek Harness 插件。

## Quick start / 快速开始

```sh
pnpm install
pnpm run build

# From the PARENT directory, install into a profile and boot:
dsh plugin --profile my-profile add ./dsh-ontolgoy
dsh --profile my-profile
```

> 注意：`dsh plugin add <dir>` 的相对路径锚定调用目录，请在插件父目录执行。

## Dev

开发时建议开两个终端：一个 watch 编译，一个用 patch 模式启动宿主。

终端 1 — watch 编译（改源码自动重新打包）：

```sh
pnpm run dev
```

启动时会先跑一次完整构建，然后并行开启三个 watch 进程：

| 进程 | 颜色 | 监听目标 | 触发动作 |
|------|------|----------|----------|
| tsc  | 蓝色 | `src/**/*.ts` | TypeScript 增量编译 → `dist/` |
| wrap | 绿色 | `dist/client.js` | inline 依赖 + 包装为 `window.__ModuleLoader__.load` 格式 |
| ui   | 黄色 | `src/ui.html` | 复制到 `dist/ui.html` |

终端 2 — 启动 DSH 宿主并叠加本地 patch（开发时实时加载 `cordis.patch.yml`）：

```sh
dsh web --patch ./cordis.patch.yml --no-open
```

| 命令 | 说明 |
|------|------|
| `dsh web --patch ./cordis.patch.yml` | 用本地 patch 启动 web 宿主，插件 bundle 层会即时生效 |
| `dsh web --patch ./cordis.patch.yml --port 8080` | 指定端口 |
| `dsh web --patch ./cordis.patch.yml --host 0.0.0.0` | 允许局域网访问 |

> `--patch` 可以叠加多个文件（重复传入），本地开发时只需 `cordis.patch.yml` 这一份。宿主跑起来后，终端 1 改完源码 → 自动 rebuild → 浏览器刷新即可看到最新效果。

## Tests

```sh
pnpm test          # watch 模式（默认）
pnpm test:run      # 单次运行并退出
pnpm test:coverage # 运行并生成覆盖率报告
```

测试框架使用 [Vitest](https://vitest.dev/)，测试文件放在 `src/` 下，命名为 `*.test.ts` 或 `*.spec.ts`。

## Dev notes

- Pure ESM: `"type": "module"` + `module: esnext` + `moduleResolution: bundler`.
- `@deepseek-ai/cordis` is a peerDependency — import only `type { Context }`, runtime ctx comes from the host.
- Load order via `inject` (service deps), never file order.