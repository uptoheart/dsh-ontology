# FDE 工作 Agent：功能设计与一期落地方案

> 版本：v1.1（待评审）
> 范围：FDE 现场交付闭环
> 交付形态：功能设计 + 在 dsh-ontology 插件内落地一期
> 智能层：**确定性内核 + 提示词工坊**（不接 LLM、离线可用）

---

## 0. 一句话结论

FDE 工作 Agent 不是"会聊天的助手"，而是**把 FDE 的五阶段交付工作流变成可执行闭环的现场副驾**：

> 它知道现在在哪个阶段、门禁还差什么、下一步该做什么、这件事怎么做、做完产出什么、什么东西不能漏。

能力全景：

```
                    ┌──────────────── 横向能力（贯穿全阶段）────────────────┐
                    │ 项目记忆 · 术语口径 · 证据追溯 · 主动提醒 · 安全边界 │
                    └──────────────────────────────────────────────────────┘
  进场准备  →  诊断对齐  →  流程显影  →  语义固化  →  应用验证  →  回带沉淀
  客户档案     痛点排序     框架/流程     本体/访谈     交付物/演示    数据包/复盘
  干系人地图   范围裁决     覆盖缺口      规则/角色     门禁检查      资产回流
      │            │            │             │             │             │
      └── 每阶段四类能力：Prepare（准备）· Guide（引导）· Produce（产出）· Guard（守门）──┘
```

四个不可替代的价值：

1. **不让现场迷路**：阶段、门禁、缺口一屏看清。
2. **不让访谈跑偏**：问题按节点生成，带着候选对象和追问上场。
3. **不让成果散落**：纪要、矩阵、缺口、台账、数据包一处导出。
4. **不让假完成发生**：违规映射、未挂载流程、未确认口径持续暴露。

**边界**：不替客户拍板、不编造数据、不生成业务系统代码（代码生成桥仍后置）。

---

## 1. 现状分析（Phase 1 探索结论）

### 1.1 插件已经有的（Agent 可直接复用）

| 现有资产 | 位置 | 对应 FDE 阶段 |
|---|---|---|
| 套件、框架锁定、实体/关系导入 | `src/datastore.ts` | 进场准备 / 流程显影 |
| 双轴覆盖度（域轴 + 流程轴） | `computeCoverage` / `computeProcessCoverage` | 流程显影 / 语义固化 |
| 流程画板与挂载语义 | `FlowchartData` / `FlowSemantics` | 流程显影 / 语义固化 |
| 四问访谈与自动投影 | `InterviewRecord` / `deriveInterviewRelations` | 语义固化 |
| CRUD 矩阵 | `computeCrudMatrix` | 应用验证 |
| 现场交付物导出与数据包 | `buildExport` / `exportPackage` | 应用验证 / 回带沉淀 |
| 页面导航与切换 | `switchTab`（`src/ui/scripts/shared.js`） | 全阶段（行动跳转） |

### 1.2 Agent 要补的（当前没有）

| 缺口 | 后果 |
|---|---|
| 没有统一阶段视图 | 每次要自己拼流程、访谈、覆盖度的现状 |
| 没有门禁判定 | 不知道"这阶段算不算完成" |
| 没有下一步建议 | 覆盖度只给缺口，不给动作优先级 |
| 没有访谈前的问题准备 | 现场靠个人经验，质量不稳定 |
| 没有客户口径台账 | 跨节点的"待确认/已确认"决策会丢 |
| 没有交付物总入口 | 五种导出散落在不同页面 |
| 插件无 LLM 通道 | `src/index.ts` 仅启动 HTTP 服务，`src/client.ts` 仅挂面板；本期不接模型 |

### 1.3 方法论对齐

仓库已有 FDE 方法论文档（`.trae/documents/FDE-流程图与本体关系及客户演示方案.md`）定义了五阶段与客户签字物：

> 诊断对齐 → 流程显影 → 语义固化 → 应用验证 → 价值演示
> 签字物：痛点排序表 / 流程卡片 / 口径裁决纪要 / 点通的场景 / 数字承诺书

本方案沿用这套阶段语言，不自造体系；只在首尾增加"进场准备"和"回带沉淀"两个操作环节。

---

## 2. 功能设计

### 2.1 阶段 × 四类能力矩阵

| 阶段 | Prepare 准备 | Guide 引导 | Produce 产出 | Guard 守门 |
|---|---|---|---|---|
| 进场准备 | 客户档案、干系人、系统清单、目标假设 | 首访议程、资料清单 | 客户档案卡 | 档案完整度 |
| 诊断对齐 | 痛点候选、业务流程初判 | 诊断问题树、价值假设 | 痛点排序表 | 已确认痛点 ≥ 3 |
| 流程显影 | 框架选择、L1/L2 范围 | 流程五问、覆盖缺口 Top N | 流程图、覆盖度 | 锚定率、挂载率 |
| 语义固化 | 实体/规则候选、访谈提纲 | 四问 + 追问 + 候选对象 | 访谈记录、口径台账、本体草案 | 四问完整率、违规映射 = 0 |
| 应用验证 | 验收场景、演示脚本 | 场景走查、缺口解释 | CRUD 矩阵、缺口清单、汇报提纲 | 交付物齐备 |
| 回带沉淀 | 交接清单 | 复盘问题 | 数据包、决策台账、经验条目 | 数据包已导出 |

说明：表中"价值演示"并入"应用验证"，避免现场把演示与验收割裂；"回带沉淀"承载数据包与复盘。

### 2.2 横向能力（决定它是不是 Agent）

| 能力 | 具体要求 |
|---|---|
| 项目记忆 | 记住当前套件、阶段、决策、导出历史；换天/换人可恢复 |
| 术语口径 | 客户叫法 ↔ 框架节点 ↔ 本体概念的三向对照（复用域词典） |
| 证据追溯 | 每条建议必须能指到具体数据：缺口编号、记录 id、违规实体 |
| 主动提醒 | 进入页面即给出"当前阶段未达门禁 + 全局风险"，不等人问 |
| 目标导向 | 行动按"当前阶段门禁"排序，而不是固定清单 |
| 人机协作 | 所有写操作由人确认；Agent 只建议与执行显式动作 |
| 安全边界 | 本地数据、无外发；提示词工坊只复制不自动发送 |
| 可解释 | 每个指标给出口径与数据来源，拒绝黑箱分数 |

### 2.3 六个操作环节的具体功能

**① 进场准备（prep）**
- 客户档案：行业、项目名、目标、关键角色、现有系统、数据可得性。
- 干系人地图：决策人 / 流程 Owner / IT / 最终用户，各自关心什么。
- 首访议程与资料清单生成（提示词工坊 `diagnose`）。
- 门禁：档案字段完整度 ≥ 60%（缺失项明确列出）。

**② 诊断对齐（diagnose）**
- 痛点候选：从套件实体/流程缺口生成候选痛点。
- 诊断问题树：按角色分层提问（目标 → 现状 → 痛点 → 影响 → 优先级）。
- 产出：痛点排序表（客户确认后进决策台账）。
- 门禁：已确认痛点 ≥ 3 条。

**③ 流程显影（flow）**
- 框架与范围：锁定框架，明确本次覆盖的 L1/L2。
- 流程五问：谁做 / 动什么对象 / 受什么规则 / 产出什么 / 下一步去哪。
- 覆盖缺口 Top N：来自 `coverage.process.gapList`，可一键去访谈。
- 产出：流程图、域锚定、流程覆盖度。
- 门禁：域锚定率 ≥ 60% 且至少 1 张已挂载流程图。

**④ 语义固化（semantic）**
- 访谈提纲：按选中节点生成四问 + 追问 + 候选实体/规则。
- 访谈记录：沿用现有四问表单，保存即投影。
- 口径台账：记录客户裁决、待确认项、责任人。
- 本体草案：提示词工坊 `model`，输出 M1/M2/M3/M5 草案（只作讨论稿）。
- 门禁：四问完整率 ≥ 60% 且违规映射 = 0。

**⑤ 应用验证（validate）**
- 演示场景清单：从已覆盖流程 + CRUD 矩阵生成"能点通的场景"。
- 交付物：纪要、CRUD 矩阵、缺口清单、域覆盖、汇报提纲。
- 门禁：四类交付物均可导出，且至少一个场景端到端可讲通。

**⑥ 回带沉淀（handoff）**
- 数据包导出/导入（已有）。
- 决策台账导出 Markdown。
- 复盘条目：本次缺口、下次准备、可复用资产。
- 门禁：数据包已导出且台账已导出。

### 2.4 反模式（明确不做）

| 反模式 | 为什么不 |
|---|---|
| 综合分 / 健康分 | 权重任意、容易被当成验收指标；改为门禁灯 + 明确计数 |
| 自动推进阶段 | 现场需要判断权；Agent 只提示"已达成，可进入下一阶段" |
| 自动替客户确认需求 | 需求确认是 FDE 的责任，Agent 只生成待确认项 |
| 自动把提纲写进访谈记录 | 会污染真实采集数据；提纲与记录分离 |
| 无来源的"智能建议" | 每条建议必须带数据依据（编号/记录/实体） |
| 直接生成业务系统 | 与 v0.2 计划一致，等采集质量验证后再启动 |

---

## 3. 一期落地（MVP）

### 3.1 一期范围

一期只做"现有数据资产能支撑、且现场每天都会用"的 5 个模块：

| 模块 | 对应能力 | 说明 |
|---|---|---|
| 交付驾驶舱 | 阶段 + 门禁 + 指标 + 行动 | 新增 |
| 访谈问题生成器 | 四问 + 追问 + 候选对象 | 新增 |
| 决策台账 | 客户口径 / 待确认项 | 新增 |
| 交付物中心 | 4 种导出 + 数据包 + 门禁检查 | 聚合现有能力 |
| 提示词工坊 | 5 个场景的可复制提示词 | 新增 |

不做：客户档案/干系人管理、数据映射、应用生成、价值测算（列入后续路线）。

### 3.2 页面信息架构

新增页签「FDE 助手」，导航分组 `▎交付驾驶舱` 置顶，初始 `disabled`（选套件后启用）。页面结构：

```
┌───────────────────────────────────────────────────────────────┐
│ 阶段轨：准备 → 诊断 → 显影 → 固化 → 验证 → 回带              │
│ 当前阶段：语义固化 ｜ 门禁：3/6 ｜ 3 项风险                    │
├──────────────────────────┬────────────────────────────────────┤
│ 当前阶段该做什么（≤3 条）│ 访谈问题生成器                     │
│ 全局风险（常驻）          │ 决策台账                           │
│ 关键指标（4 个事实）      │ 提示词工坊                         │
│ 交付物中心               │                                    │
└──────────────────────────┴────────────────────────────────────┘
```

关键元素：`#agStageRail`、`#agGates`、`#agActions`、`#agRisks`、`#agMetrics`、`#agQuestionNode`、`#agQuestions`、`#agLedgerList`、`#agExports`、`#agPromptScene`、`#agPromptText`、`#agPromptCopy`、`#agReload`。

### 3.3 规则（确定性，全部可解释）

**门禁判定**（建议性，不阻断）：

| 阶段 | 通过条件 |
|---|---|
| `prep` | 套件已选 + 实体 > 0 + 框架已锁定 |
| `diagnose` | 台账中 `stage=diagnose` 且 `status=confirmed` 的决策 ≥ 3 |
| `flow` | 域锚定率 ≥ 60% 且已挂载流程图 ≥ 1 |
| `semantic` | 四问完整率 ≥ 60% 且违规映射 = 0 |
| `validate` | 4 类交付物均至少导出过 1 次 |
| `handoff` | 数据包导出过 1 次且台账已导出 1 次 |

**指标口径**（只展示事实，不做加权综合分）：

- 域锚定率 = 已映射 L1/L2 的域轴实体 / 域轴实体总数。
- 流程挂载率 = `coverage.process.l3Covered / l3Total`。
- 四问完整率 = 角色 + 对象双有效的记录 / 访谈记录总数。
- 一致性风险 = 违规映射条数 + 未挂载的已访谈节点数。

**行动生成**：

1. 先算当前阶段门禁缺什么 → 生成 1–3 条"解锁当前门禁"的行动。
2. 再算全局风险 → 常驻展示（违规映射、未挂载、待确认决策）。
3. 当前门禁已达成 → 提示"可进入下一阶段"并给下一阶段的准备动作。
4. 每条行动包含：`title / why（带数据依据）/ count / cta{label, tab, code?, exportKind?}`。

行动映射：

| 行动 id | 触发 | 跳转 |
|---|---|---|
| `anchor-entities` | 域锚定率不足 | `suites` 实体表 |
| `fix-mapping` | 违规映射 > 0 | `coverage`（已有违规横幅） |
| `interview-gaps` | 当前阶段需要访谈且 gapList 非空 | `interview` 并 `selectInterviewNode(gapList[0])` |
| `complete-four-questions` | 有记录缺角色/对象 | `interview` 并选中第一条不完整记录 |
| `generate-flow-draft` | 有记录但节点未挂载 | 调 `/flow-draft` → 打开画板 |
| `resolve-decisions` | 台账有 pending | 定位台账区 |
| `export-deliverables` | 验证/回带阶段缺导出 | 定位交付物区 |

### 3.4 访谈问题生成器

输入：`suiteId + code`（L3/L4）。输出：

```ts
interface AgentQuestionSet {
  code: string
  label: string
  path: string[]
  customerContext: string          // "咱们在「{L2}」里，{节点}这一步……"
  questions: {
    id: 'role' | 'object' | 'rule' | 'behavior'
    title: string
    ask: string
    why: string
    probes: string[]
  }[]
  suggestedEntities: { id: string; name: string; kind: EntityKind }[]  // ≤ 5
  suggestedRules: string[]                                             // ≤ 3
  warnings: string[]               // 已有记录缺哪问 / 未挂载 / 已画节点数
}
```

生成规则：

- 候选实体：领域名或映射祖先编号与节点路径匹配，kind 优先 `AGGREGATE_ROOT > ENTITY > REPORT > DATA_DICTIONARY`。
- 候选规则：`RULE` 实体名称/描述与节点名称关键词匹配。
- 追问：已有记录缺失项、未挂载流程、无规则、无审批角色等各生成一条。
- 只读生成，不写库。

### 3.5 决策台账

```ts
export interface AgentDecision {
  id: string
  stage: AgentStage
  topic: string
  question: string
  answer: string
  status: 'pending' | 'confirmed'
  createdAt: number
  updatedAt: number
}
```

- 内联新增/编辑/确认；支持按阶段分组展示。
- 导出 Markdown 交接单（`GET /api/agent/ledger`）。
- 与访谈 `note` 的分工：`note` 是单条原话，台账是跨节点、需签字的决策。

### 3.6 提示词工坊

5 个场景，从当前套件真实数据拼装，只读复制，不自动发送：

| 场景 | 产出 |
|---|---|
| `diagnose` | 诊断会议提纲（议程、目标、问题、资料、签字项） |
| `interview` | 单节点访谈提纲（四问 + 追问 + 话术） |
| `model` | M1/M2/M3/M5 本体草案（缺失标 `[待确认]`） |
| `validate` | 演示脚本与验收要点 |
| `handoff` | 回带交接摘要（完成/待确认/风险/下次准备） |

统一约束：**不得编造数据；缺信息列 `[待确认]`；只使用给定上下文。**

### 3.7 数据结构与存储

```ts
export type AgentStage = 'prep' | 'diagnose' | 'flow' | 'semantic' | 'validate' | 'handoff'

export interface AgentState {
  suiteId: string
  stage: AgentStage
  decisions: AgentDecision[]
  exports: { kind: 'minutes' | 'crud' | 'gap' | 'domain' | 'ledger' | 'package'; at: number }[]
  updatedAt: number
}
```

- 存储：`resolveDatastorageRoot(await getConfig())` 下 `agent/<safeSuiteId>.json`。
- 不写 `OntologySuiteMeta`，旧套件零迁移。
- 文件不存在时返回默认状态（`stage` 按数据推导），不落盘。

### 3.8 API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/agent/overview?suiteId=` | `{ state, gates, metrics, actions, risks }`，一次请求渲染首屏 |
| `POST` | `/api/agent/state` | `{ suiteId, stage?, decisions?, exports? }`，整体覆盖对应字段 |
| `GET` | `/api/agent/questions?suiteId=&code=` | `AgentQuestionSet` |
| `GET` | `/api/agent/prompt?suiteId=&scene=` | `{ scene, title, content }` |
| `GET` | `/api/agent/ledger?suiteId=` | 下载 Markdown 台账 |

错误：套件不存在 404；`scene`/`code`/字段非法 400。现有导出接口保持不变。

### 3.9 文件清单

新增：

| 文件 | 内容 |
|---|---|
| `src/agent/types.ts` | 阶段、状态、决策、指标、行动、问题集、提示词类型 |
| `src/agent/status.ts` | 纯函数 `buildAgentOverview(input)`：门禁、指标、行动、风险 |
| `src/agent/questions.ts` | 纯函数 `buildInterviewQuestions(...)` |
| `src/agent/prompts.ts` | 纯函数 `buildAgentPrompt(scene, context)` |
| `src/agent/store.ts` | 读写 `agent/<suiteId>.json` |
| `src/agent/routes.ts` | `registerRoutes` 注册 `/api/agent/*` |
| `src/agent/agent.test.ts` | 单元测试 |
| `src/ui/pages/agent.html` | 「FDE 助手」页签 |
| `src/ui/css/agent.css` | `ag-` 前缀样式，复用现有变量 |
| `src/ui/scripts/agent.js` | 渲染、跳转、台账、导出、复制 |

修改（最小侵入）：

| 文件 | 改动 |
|---|---|
| `src/ui/layout.html` | 新增 include 与 `data-tab="agent"` 按钮（`▎交付驾驶舱` 分组） |
| `src/ui/scripts/shared.js` | `switchTab` 增加 agent 分支；`state` 增加 `agent` 子状态 |
| `src/server.ts` | 顶部 `import './agent/routes.js'` |

不改：`datastore.ts` 既有逻辑、访谈/画板/覆盖度页面、套件 meta 结构。

### 3.10 测试

`src/agent/agent.test.ts`：

1. 门禁：域锚定率 0.5 时 `flow` 未通过，0.6 且 1 张流程图时通过。
2. 行动：当前阶段缺锚定 → `anchor-entities` 优先；违规映射 → `fix-mapping` 常驻风险。
3. 指标：3 个域实体 2 个已锚定 → 0.67；4 条访谈 2 条完整 → 0.5。
4. 问题：4 问齐全、含节点编号/名称、候选实体 ≤ 5、缺角色时 `warnings` 非空。
5. 提示词：含项目域/阶段/`[待确认]` 约束，长度 < 8KB。
6. 存储：`vi.stubEnv('DSH_ONTOLOGY_DATA', tmpdir)` 保存→读取一致。

---

## 4. 假设与决策

| 项 | 决策 | 理由 |
|---|---|---|
| 智能层 | 确定性内核 + 提示词工坊 | 插件无模型服务、现场常无网、避免密钥；用户已确认 |
| 阶段体系 | 沿用仓库 FDE 五阶段 + 首尾两环节 | 与既有方法论和客户签字物对齐，不自造体系 |
| 门禁 | 建议性，不阻断 | 现场需要判断权，硬阻断会被绕过 |
| 指标 | 只展示事实与计数，不做综合分 | 权重任意、易被误当验收指标 |
| 行动排序 | 以当前阶段门禁为先，全局风险常驻 | 目标导向，避免固定清单 |
| 存储 | 独立 `agent/<suiteId>.json` | 不动套件 meta，零迁移 |
| 交付物 | 复用现有 4 种导出 + 数据包 | 不新增格式，减少分叉 |
| 依赖 | 不新增 npm 依赖 | 纯 TS + 现有 UI 栈 |
| 代码生成 | 继续后置 | 与 v0.2 计划一致 |

---

## 5. 验证步骤

1. `pnpm run typecheck` 通过。
2. `pnpm run test:run` 全绿（含新增 6 组）。
3. `pnpm run build` 成功，`dist/ui.html` 含 `tab-agent`。
4. 冒烟（服务端缓存 HTML，构建后必须重启）：
   - `%TEMP%` 下临时 `serve.mjs`，`import('file:///G:/dsh-plugins/dsh-ontology/dist/server.js')` 后 `startServer(17399)`。
   - 选 `reference-example` 或 `chemical-safety-demo` → 打开「FDE 助手」：阶段轨、门禁灯、行动、风险正常。
   - 行动跳转：访谈类能选中指定 L3；映射类跳到覆盖度页。
   - 问题生成器：四问、候选实体、提醒齐全；不写库。
   - 台账：新增待确认 → 刷新仍在；Markdown 分组正确。
   - 提示词：5 场景切换，复制成功。
   - 交付物：4 种导出 + 数据包成功，`exports` 增加记录。
   - 阶段切换、换套件后概览正确刷新。
5. 视觉：1280×800 / 1920×1080 两栏不溢出；暗色主题无硬编码白底。

---

## 6. 后续路线（本期不做）

| 期 | 内容 | 前置条件 |
|---|---|---|
| P1 | LLM 适配层（OpenAI 兼容 / DSH 宿主模型） | 一期确定性内核稳定 |
| P2 | 客户档案、干系人地图、术语对照表 | 有真实项目字段需求 |
| P3 | 数据映射与质量检查（字段级） | 生成桥启动前 |
| P4 | 应用生成桥、价值测算 | 至少 1 个完整项目验证采集质量 |
| P5 | 多项目/团队协作、云端同步 | 单机闭环跑顺 |

---

## 7. 实施顺序

1. `types.ts` → `status.ts` → `questions.ts` → `prompts.ts` + `agent.test.ts`（纯函数先跑通）。
2. `store.ts` + `routes.ts` + `server.ts` 导入，临时服务验证 API。
3. `agent.html` / `agent.css` / `agent.js` + `layout.html` / `shared.js` 集成。
4. `pnpm run build` 重启服务，端到端冒烟与视觉检查。
