# 全局本体与领域二次划分 实现规划

## 仓库调研结论

### 当前现状

1. **套件领域单一**：`manifest.json` 只声明一个 `domain` 字段（如 reference-example 的「销售合同执行管理」），解析时该套件所有实体的 `domain` 都被设为这个值（`ontology-parser.ts` 第 112、125 行：`fileDomain = raw.domain ?? domain`）。

2. **主数据被错误归域**：`m1-object-model.yaml` 中产品、客户、部门、人员 4 个聚合根打了 `tags: [主数据]`，合同/开票/收款打了 `核心域`，审批记录打了 `支撑域`。但 `tags` 目前仅存入 `properties`，**不参与领域判定**，导致产品的 `domain` 也是「销售合同执行管理」——违背了「产品只是被该领域引用」的语义。

3. **实体 ID 按套件隔离**：`buildEntity` 生成的 ID 为 `${suiteId}:${kind}:${rawId}`，跨套件的同名实体（如 CRM 的产品 vs MES 的产品）是两个独立实体，无去重机制。

4. **无全局本体视图**：`/api/suites/:id/graph` 仅返回单套件图谱（`assembleGraph`），`loadSuite`/`loadSuiteWithDerived` 均按 suiteId 单套件加载，不存在跨套件合并的「世界本体」。

5. **领域字段仅用于展示**：`entity.domain` 在实体详情抽屉（`shared.js:339`、`ontology.js:588`）和套件列表（`suites.js:18,36`）中展示，未参与任何跨套件逻辑。

### 核心问题

- 领域粒度太粗：一个套件只有一个 domain，主数据与核心业务对象混在同一领域。
- 缺少跨套件去重：不同套件引用的同一主数据（产品、客户、组织、人员）应是全局唯一实体。
- 缺少全局图谱：用户无法看到「世界本体」，只能看到单个套件的局部图谱。

---

## 设计思路

### 1. 领域二次划分（导入时自动完成）

解析阶段根据聚合根的 `tags` 对实体进行**二次领域划分**：

| tags 包含 | 领域类别 (domainCategory) | 实体 domain 取值 | 示例 |
|---|---|---|---|
| `主数据` | `master` | 以实体名称命名的规范领域 | 产品 → domain「产品」，客户 → domain「客户」 |
| `核心域` | `core` | 套件主领域（manifest.domain） | 合同 → domain「销售合同执行管理」 |
| `支撑域` | `supporting` | 套件主领域 + 「支撑」后缀 | 审批记录 → domain「销售合同执行管理·支撑」 |
| 无 / 其他 | `core` | 套件主领域 | — |

> 主数据实体以**自身名称**作为规范领域名，保证不同套件导入的「产品」都落在同一领域，为去重提供基础。

### 2. 规范实体身份（跨套件去重）

为主数据类实体生成**全局规范 ID**（canonicalId）：

```
canonical:${kind}:${name}    例如 canonical:AGGREGATE_ROOT:产品
```

非主数据实体的 canonicalId 等于其 suite-scoped `id`。

构建全局本体时：
- 按 canonicalId 分组，同名主数据实体合并为一个规范实体（取首次导入的属性，其他套件的属性合并入 `properties.suites`）。
- 所有关系的 `from`/`to` 重映射到规范实体 ID，形成跨套件引用关系。

### 3. 双图谱视图

- **套件图谱**（现有）：当前套件的实体 + 它引用的规范主数据实体，完整表达局部语义（CRM 图谱、MES 图谱等）。
- **全局图谱**（新增）：所有已导入套件合并去重后的实体与关系，即「世界本体」。

---

## 文件与模块变更

### 类型层
- `src/shared-types.ts`：扩展 `OntologyEntity`，新增 `domainCategory`、`canonicalId`；新增 `GlobalOntology` 类型；新增 `DomainCategory` 类型。

### 解析层
- `src/ontology-parser.ts`：
  - `parseM1` 中按 tags 判定 `domainCategory`，重写 `domain` 字段，生成 `canonicalId`。
  - `buildEntity` 增加 `domainCategory`、`canonicalId` 参数。
  - 新增 `classifyDomain(aggregate, suiteDomain)` 工具函数。
  - 数据字典（DATA_DICTIONARY）归属跟随其所属聚合根或主数据领域。

### 存储与合并层
- `src/datastore.ts`：
  - 新增 `buildGlobalOntology(suiteIds?)`：加载指定（或全部）套件，按 canonicalId 去重合并实体，重映射关系。
  - 新增 `assembleGlobalGraph()`：基于全局本体组装 GraphData。
  - `assembleGraph` 增加可选参数支持套件图谱中注入被引用的规范实体。

### 服务层
- `src/server.ts`：
  - 新增 `GET /api/global/ontology`：返回全局本体（entities + relations + 各套件摘要）。
  - 新增 `GET /api/global/graph`：返回全局图谱 GraphData。
  - 新增 `GET /api/suites/:id/graph?mode=suite|global`：复用现有 graph 接口，mode=global 时返回该套件在全局中的视图。

### 前端层
- `src/ui/pages/ontology.html`：图谱工具栏增加「套件图谱 / 全局图谱」切换按钮。
- `src/ui/scripts/ontology.js`：
  - 新增图谱模式状态 `graphMode`（'suite' | 'global'）。
  - 切换模式时重新拉取对应图谱数据并重绘。
  - 全局图谱节点按领域着色（主数据领域一种色系，各套件核心域不同色系）。
  - 节点 tooltip / 详情中展示「规范领域」与「来源套件」。
- `src/ui/scripts/suites.js`：套件列表展示「核心领域 + 引用领域」摘要。
- `src/ui/scripts/shared.js`：实体详情抽屉展示 `domainCategory` 与 `canonicalId`。

### 样式
- `src/ui/css/ontology.css`：全局图谱模式的领域着色、套件标识徽标样式。

---

## 实施步骤（依赖顺序）

### 阶段一：类型与解析（领域二次划分）

1. **`shared-types.ts`**：定义 `DomainCategory = 'master' | 'core' | 'supporting'`；`OntologyEntity` 增加 `domainCategory?: DomainCategory`、`canonicalId?: string`。
2. **`ontology-parser.ts`**：
   - 实现 `classifyDomain(agg, suiteDomain)`：读取 `agg.tags`，返回 `{ domain, domainCategory, isMaster }`。
   - 修改 `parseM1`：对每个聚合根调用 classifyDomain，将结果传入 `buildEntity`；子实体（ENTITY）跟随聚合根的领域；数据字典若能归属到主数据聚合根则跟随，否则归为 `master` 且 domain 为字典名。
   - `buildEntity` 签名增加 `domainCategory`、`canonicalId`；主数据实体 canonicalId = `canonical:${kind}:${name}`，其余 = id。
   - M2/M3/M5/M6/M7/MU 中非对象实体（行为、规则、角色、流程、报表、UI）默认 domainCategory='core'，domain 跟随套件主领域；其 canonicalId = id。
3. **验证**：重新导入 reference-example，断言产品 domain=「产品」、domainCategory=「master」、canonicalId=`canonical:AGGREGATE_ROOT:产品`；合同 domain=「销售合同执行管理」、domainCategory=「core」。

### 阶段二：全局本体合并与去重

4. **`datastore.ts`**：
   - 实现 `buildGlobalOntology(opts?)`：
     - 加载所有套件（或指定 suiteIds）。
     - 建立 `canonicalId → canonicalEntity` 映射：首次出现的实体作为规范实体，后续同名实体合并 `properties.suites`（记录来源套件）。
     - 建立 `suiteLocalId → canonicalId` 映射表。
     - 遍历所有关系，将 `from`/`to` 通过映射表重写为 canonicalId，去重后输出。
     - 返回 `{ entities, relations, suites, canonicalIndex }`。
   - 实现 `assembleGlobalGraph()`：调用 buildGlobalOntology，组装 GraphData，节点 group 取 domainCategory 或 domain。
5. **验证**：模拟两个套件都含「产品」，全局本体中产品实体只有一个，两个套件的合同都引用该产品。

### 阶段三：服务接口

6. **`server.ts`**：
   - 新增路由 `GET /api/global/ontology` → `buildGlobalOntology()`。
   - 新增路由 `GET /api/global/graph` → `assembleGlobalGraph()`。
   - 改造 `GET /api/suites/:id/graph`：支持 `?mode=global` 参数，mode=global 时返回该套件实体在全局本体中的子图（含引用的规范实体）。
7. **验证**：启动服务，调用三个接口返回结构正确。

### 阶段四：前端双图谱视图

8. **`ontology.html`**：在 `graph-toolbar` 的 view-toggle 旁增加 `<button class="btn toggle" data-scope="suite">套件图谱</button><button class="btn toggle" data-scope="global">全局图谱</button>`。
9. **`ontology.js`**：
   - 新增 `state.graphScope = 'suite'`。
   - 新增 `loadGraph(scope)`：suite 走现有 `/api/suites/:id/graph`，global 走 `/api/global/graph`。
   - 切换按钮点击时切换 scope 并重绘。
   - 全局模式下，节点颜色按 `domainCategory`：master=金色系，core=按套件哈希色，supporting=灰色系；节点边框标注来源套件数。
   - 详情抽屉展示 `domainCategory`、`canonicalId`、`properties.suites`（来源套件列表）。
10. **`ontology.css`**：增加 `.scope-toggle`、`.node-master`、`.node-core`、`.suite-badge` 等样式。
11. **验证**：浏览器中切换套件/全局图谱，产品节点在全局图谱中唯一且被多套件引用。

### 阶段五：套件列表与展示增强（可选收尾）

12. **`suites.js`**：套件卡片展示「核心领域 + 引用主数据领域数」。
13. **`shared.js`**：实体详情抽屉领域行展示 domainCategory 标签。

---

## 依赖与注意事项

- **向后兼容**：`domainCategory`、`canonicalId` 均为可选字段，旧数据（无此字段）按 core + id 处理，不破坏现有套件。
- **重导入安全**：实体 ID 仍为 `${suiteId}:${kind}:${rawId}`（确定性），annotations 映射在重导入后依然有效；canonicalId 同理确定性生成。
- **关系重映射**：`buildGlobalOntology` 中关系去重需保持 `from|type|to` 唯一键，避免跨套件重复边。
- **性能**：全局本体按需加载，套件数量少时直接全量合并；若将来套件增多可引入缓存。
- **主数据判定**：仅依据 `tags` 字段；若某套件的 YAML 未打 tags，则该套件所有实体归为 core，不参与跨套件去重（符合「显式声明才共享」原则）。
- **数据字典归属**：数据字典若被某主数据聚合根引用（如产品类型字典被产品引用），则跟随该主数据领域；否则按字典名独立领域。

---

## 验证

- `pnpm run typecheck` 通过。
- `pnpm run test:run` 通过（现有测试不受影响）。
- 重新导入 reference-example 后：
  - 产品/客户/部门/人员的 domain 分别为「产品」「客户」「部门」「人员」，domainCategory=master。
  - 合同/开票/收款 domain=「销售合同执行管理」，domainCategory=core。
  - 审批记录 domain=「销售合同执行管理·支撑」，domainCategory=supporting。
- `GET /api/global/ontology` 返回的实体中，产品只有 1 个（canonicalId 去重生效）。
- 前端切换到「全局图谱」，产品节点带多套件引用标识；切换回「套件图谱」，显示当前套件完整局部图。

---

## 风险与应对

| 风险 | 应对 |
|---|---|
| 主数据命名不一致导致去重失效（如「产品」vs「商品」） | canonicalId 基于 name；初期接受此限制，后续可引入别名映射表（alias → canonicalName） |
| 全局图谱节点过多导致渲染卡顿 | 复用现有 kind 筛选 + 力导向布局；全局模式默认只显示 AGGREGATE_ROOT + 主数据实体，可展开 |
| 关系重映射后出现悬空引用 | 合并时校验 from/to 必须存在于 canonical 实体集，否则保留原 suite-local 节点作为 DANGLING |
| 旧 annotations 的 entityFrameMapping 键为 suite-local ID | 映射键不迁移（套件图谱仍用本地 ID）；全局图谱只读展示，不影响标注 |
| 领域二次划分改变了现有 domain 字段值，可能影响依赖 domain 的逻辑 | 检查 domain 字段仅用于展示与搜索，无核心逻辑依赖；覆盖度计算依赖 kind 与 apqcCode，不依赖 domain |
