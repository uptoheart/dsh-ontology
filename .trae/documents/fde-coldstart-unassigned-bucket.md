# FDE 冷启动:框架树全局化 + 访谈未分配桶

## Context

FDE 进场第一天往往还没有套件(套件只能从 datasource 导入/导包诞生),当前 `updateTabLock` 在无套件时锁死流程画板、访谈清单等几乎所有 Tab,造成"进场无法工作"的体验黑洞。用户已确认采用方案 B:

1. **框架树全局化**——流程框架(hw-style-pcf)是全局静态数据,启动时即加载,与套件解耦;画板左树拖拽、L3 挂载下拉、访谈左树在无套件时可用。
2. **访谈未分配桶**——无套件时访谈记录存入 `_unassigned` 桶;建了套件后在访谈页一键「认领」迁入当前套件。

已验证的关键事实:
- `GET /api/frameworks/{id}` 本无套件依赖(server.ts L449-468),纯前端改动即可。
- 访谈存储按 `interviews/<safe(suiteId)>.json` 落盘,不校验套件存在(datastore.ts L1325-1371),`_unassigned` 开箱可用。
- FDE 助手/覆盖度均按真实 suiteId 拉访谈(agent/routes.ts L36-42),`_unassigned` 天然不泄漏、不计入任何套件覆盖度。
- `apiSaveInterview` 对 answers 字段是白名单透传(server.ts L344-357),新增 `entityName` 必须加进白名单。
- 认领跨桶 POST 同 id 会生成新 id(datastore.ts L1346-1348 的 existing 仅在同文件内命中)——接受新 id(纯前端方案,零后端改动;派生关系读取时重算,无悬挂引用)。

## 改动清单

### T1 全局框架加载 + 解锁画板/访谈
**文件**: [shared.js](file:///g:/dsh-plugins/dsh-ontology/src/ui/scripts/shared.js)、[main.js](file:///g:/dsh-plugins/dsh-ontology/src/ui/scripts/main.js)

- shared.js 顶部新增 `const GLOBAL_DEFAULT_FW = 'hw-style-pcf'`(注释对齐 builtin-frameworks.ts L11 `DEFAULT_NEW_SUITE_FW`;前端纯 JS 无法 import TS 常量,须显式写死,不能用 L107 的 LEGACY 默认值 'apqc-process')。
- shared.js 新增 `ensureGlobalFramework()`:若 `state.frameworkId === GLOBAL_DEFAULT_FW && state.framework` 已就绪则跳过;否则 `GET /api/frameworks/hw-style-pcf` → 填 `state.framework / state.frameworkId / state.flatFw`(复用 framework.js 的 flattenFramework)。不碰 `state.frameworks`、不拉 coverage/dictionary。
- main.js init:`suites.length !== 1`(含 0)时 `await ensureGlobalFramework()`。selectSuite 逻辑不动——它整组覆盖 state.framework,天然优先。
- **关键**:shared.js L333 `updateTabLock()` 改为分 Tab 判定——`flowchart`、`interview` 仅依赖 `state.framework`;`framework`/`coverage`/`ontology`/`agent` 仍依赖 `state.suite`。

### T2 访谈作用域 + 未分配桶读写
**文件**: [interview.js](file:///g:/dsh-plugins/dsh-ontology/src/ui/scripts/interview.js)

- 新增 `ivScope() = state.currentSuiteId || '_unassigned'`;新增可导出 `loadInterviewScope()`:`GET /api/suites/{ivScope()}/interviews` → `state.interviews`。供 main.js(零套件启动)、deselectSuite、selectSuite 复用(suites.js L49-99 selectSuite 的 Promise.all 中内联拉取改为调用它,避免口径分叉)。
- 保存(L251)/删除(L273)/右列删除(L360)URL 中的 `state.currentSuiteId` 全部替换为 `ivScope()`。
- 无套件时禁用 `#ivDraft`、`#ivExport`(均需真实套件),加 title 说明。

### T3 entityName 自由文本(对象兜底)
**文件**: [shared-types.ts](file:///g:/dsh-plugins/dsh-ontology/src/shared-types.ts)、[server.ts](file:///g:/dsh-plugins/dsh-ontology/src/server.ts)、interview.js、[interview.html](file:///g:/dsh-plugins/dsh-ontology/src/ui/pages/interview.html)

- `InterviewAnswer` 增加 `entityName?: string`(向后兼容,无迁移)。不采用"塞 entityId"方案——脏 entityId 认领后会产生悬空投影。
- server.ts L344-357 白名单加一行:`entityName: typeof a.entityName === 'string' ? a.entityName : undefined`。
- interview.html `#ivEntity` select 旁加 `<input id="ivEntityName" placeholder="对象名称(未选择套件时手填)">`,仅无套件时显示;`ivCollectForm` 无套件时写 entityName 而非 entityId;表单回显与右列列表优先显示 entityName。
- `renderIvProjectLine`(L221-235):无 entityId 时投影提示降级为"认领并绑定实体后才生成参与关系"。

### T4 认领 UX
**文件**: interview.js

- 选中套件时 `loadInterviewScope()` 额外拉 `/api/suites/_unassigned/interviews` → `state.unassignedInterviews`;`renderIvRightList` 在其非空时于右列底部渲染「未分配」分组:每条带「认领」按钮 + 组头「全部认领 n 条」。
- 认领 = `POST /api/suites/{current}/interviews`(body 保留 apqcCode/answers/note,**不传 id**,接受服务端新 id)→ `DELETE /api/suites/_unassigned/interviews/{oldId}` → 重拉两侧。全部认领 = 循环 + 单次重拉。均复用现有路由(server.ts L70-71),零后端改动。

### T5 套件选择器冷启动入口
**文件**: [suites.js](file:///g:/dsh-plugins/dsh-ontology/src/ui/scripts/suites.js)、[suites.html](file:///g:/dsh-plugins/dsh-ontology/src/ui/pages/suites.html)

- `loadSuites` 重建 `#suiteSelect` 时头部插入 `<option value="">— 未选择套件(未分配桶)—</option>`;空值走新增导出函数 `deselectSuite()`:清 `state.currentSuiteId/state.suite/state.coverage/state.dictionary/state.frameworks` → `ensureGlobalFramework()` + `loadInterviewScope()` → 重置 iv 子状态 + `updateTabLock()` + renderAll。
- main.js 保留"恰好 1 个套件自动选中",用户可手动退回未选择。

### T6 文案修正
- interview.js L74、flowchart.js L56 的"请先选择套件"空提示改为"流程框架加载中/失败"(全局加载后原文案不可达,仅作兜底)。
- 画板无套件保存沿用现状(`suiteId: undefined`,可挂 L3,mount 是框架级),不改;全局流程图经 `!f.suiteId` 过滤天然在任意套件可见。

### 明确不改
- 流程地图/覆盖度/套件图谱/FDE 助手仍要求套件,空提示保持。
- 认领接受新 id,不加后端保 id 逻辑。

## Verification

**单测**(新增 vitest 文件,仿 datastore-global.test.ts 的真实临时目录、零 mock 模式):
1. `saveInterview/listInterviews` 用 `_unassigned` 桶 round-trip。
2. 认领流:桶存 1 条 → 套件存(同 body 不传 id)→ 桶删 → 断言套件列表含它、桶为空。
3. `deriveInterviewRelations` 对无 entityId(仅 entityName)的记录不产关系。
4. entityName 经 `saveInterview` 落盘回读保留。
5. 回归:`tsc` 0 错 + 既有 37 测试全绿 + `npm run build` 通过。

**手工端到端**(repo 外临时 serve.mjs import dist/server.js 调 startServer(17399),Puppeteer MCP 验证):
1. 清空/指向空 datastorage,零套件打开页面 → 画板左树与访谈左树均渲染 hw-style-pcf;画板可拖节点、保存为全局;访谈可保存到未分配桶(右列可见)。
2. 新建/导入套件后 → 访谈页右列出现「未分配」分组 → 认领 → 记录迁入套件,桶清空。
3. 流程地图/FDE 助手在无套件时仍锁定;未分配记录不计入套件覆盖度。

## 实施结果(2026-11-12)

已完成 T1–T6;单测补在 `src/datastore-global.test.ts` 的「访谈未分配桶」describe(3 例)。
回归:`tsc --noEmit` 0 错、`vitest run` 47/47 通过、`npm run build` 通过(ui.html 351.6 KB)。

## 后续待执行任务(不在本次范围)

### 任务 A:全局关联层(本体↔流程)—— 已完成(2026-11-12)
把 `suite.annotations.entityFrameMapping` 的 apqcCode 按 `entityId → canonicalId` 投影为**全局只读关联层**:
- `GlobalProcessLink` 类型 + `GlobalOntology.processLinks`;仅收流程轴实体,按套件保留 provenance,过滤悬空 canonical。
- 新路由 `GET /api/global/process-links`(轻量,供流程地图浏览模式与全局图谱投影)。
- 全局图谱新增 PCF 投影(`addGlobalPcfProjection`),节点 `pcf:<code>` 与 `PCF_HAS_ENTITY` 边。
- 流程地图浏览模式:无套件时按框架定义合成只读树,显示全局关联对象数;详情面板只展示关联对象与来源套件,不出现覆盖状态。
- 回归:`tsc` 0 错、vitest 49/49(新增 2 例 processLinks)、`npm run build` 通过;`/api/global/process-links` 冒烟 200。

边界确认:关联可全局化,**覆盖度评估不可**(属某次交付结论),仍按套件存储;`coverageMarks` 不上提。

### 任务 B:项目管理插件 ↔ 本插件联动(待执行)
一个 FDE 可同时负责多个项目,每个项目各有独立覆盖度。需与独立的"项目管理"插件打通:
- 项目实体与套件建立映射(1 项目 : N 套件 或 1:1,待定)。
- 由项目侧驱动"当前项目 → 当前套件上下文",FDE 助手的阶段门禁/指标按项目维度汇总。
- 跨插件契约(项目 ID、套件 ID、状态枚举)需先定义,再谈实现。
