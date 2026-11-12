/* ═════════════════════════ 工具（全局共享） ═════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
const fmtTime = (ts) => { try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }); } catch { return '—'; } };

const STATUS_LABEL = { covered: '已覆盖', partial: '部分', gap: '缺口', unset: '未标注' };
const PAGE_SIZE = 300;
/* 旧套件（meta 无 frameworkId）兼容缺省；实际框架跟随套件 meta（项目级锁定） */
const LEGACY_DEFAULT_FW = 'apqc-process';
/* 全局缺省框架（无套件冷启动时加载）：与 builtin-frameworks.ts 的 DEFAULT_NEW_SUITE_FW 对齐，前端纯 JS 需显式写死 */
const GLOBAL_DEFAULT_FW = 'hw-style-pcf';
function suiteFw(suite) { return (suite && suite.meta && suite.meta.frameworkId) || LEGACY_DEFAULT_FW; }
/* 框架轻量清单（id → 名称），init 时加载 */
let FW_LIST = [];
function fwNameOf(id) {
  const f = FW_LIST.find(x => x.frameworkId === (id || LEGACY_DEFAULT_FW));
  return f ? f.name : (id || LEGACY_DEFAULT_FW);
}

let toastTimer = null;
function toast(msg, type) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.error)) || (res.status + ' ' + res.statusText));
  }
  return json ? json.data : null;
}

/* 现场交付物导出：kind = minutes|crud|gap|domain（文件名由服务端 Content-Disposition 决定后缀） */
const EXPORT_EXT = { minutes: 'md', crud: 'csv', gap: 'csv', domain: 'csv' };
async function downloadExport(kind) {
  if (!state.currentSuiteId) { toast('请先选择套件', 'err'); return; }
  try {
    const res = await fetch('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/export?kind=' + kind);
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const name = state.currentSuiteId.replace(/[^\w.-]/g, '_') + '-' + kind + '.' + (EXPORT_EXT[kind] || 'txt');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出：' + name, 'ok');
  } catch (err) {
    toast('导出失败：' + err.message, 'err');
  }
}

/* 与后端 deriveOntologyCode 一致：ONT-{L1}-{L2}-{L3}，不足 3 段补 0 */
function deriveOntologyCodeLocal(apqcCode) {
  const parts = apqcCode.split('.').map(s => s.trim()).filter(Boolean);
  if (!parts.length || !parts.every(p => /^\d+$/.test(p))) return null;
  while (parts.length < 3) parts.push('0');
  return 'ONT-' + parts.slice(0, 3).join('-');
}

/* ═══════════ 框架编号映射按 kind 分流（与后端 DOMAIN_KINDS/PROCESS_KINDS 一致） ═══════════ */
const DOMAIN_KINDS = new Set(['AGGREGATE_ROOT', 'ENTITY', 'DATA_DICTIONARY', 'RULE', 'ACTOR', 'ROLE', 'REPORT']);
const PROCESS_KINDS = new Set(['FLOW', 'ACTIVITY']);

/* kind 轴向：'domain'=名词层只允许 L1/L2；'process'=动词层只允许 L3-L5；null=不参与映射 */
function kindAxis(kind) {
  if (DOMAIN_KINDS.has(kind)) return 'domain';
  if (PROCESS_KINDS.has(kind)) return 'process';
  return null;
}

function levelNumOfCode(code) {
  return String(code || '').split('.').map(s => s.trim()).filter(Boolean).length;
}

/* 校验 kind 是否允许映射到该框架编号 */
function checkMappingAllowed(kind, code) {
  const axis = kindAxis(kind);
  if (!axis) return { ok: false, msg: `${kind} 类型暂不参与框架映射` };
  const lvl = levelNumOfCode(code);
  if (axis === 'domain' && lvl > 2) return { ok: false, msg: '该实体类型仅允许映射到 L1/L2（L3+ 属流程轴，由流程与参与关系推导）' };
  if (axis === 'process' && lvl < 3) return { ok: false, msg: '该流程类型仅允许映射到 L3-L5（L1/L2 属域轴）' };
  return { ok: true };
}

/* 域词典查询：code → 词条 */
function dictEntryFor(code) {
  if (!state.dictionary || !code) return null;
  return (state.dictionary.entries || []).find(e => e.code === code) || null;
}

/* ═════════════════════════ 状态 ═════════════════════════ */
const state = {
  suites: [],
  currentSuiteId: null,
  suite: null,          // SuiteData {entities, relations, meta, annotations}
  frameworks: [],       // 当前套件已关联的框架清单（string[]）
  frameworkId: LEGACY_DEFAULT_FW, // 当前激活的框架（从 meta.activeFrameworkId 读）
  framework: null,      // FrameworkDefinition
  coverage: null,       // CoverageMatrix
  dictionary: null,     // DomainDictionary（受控词表，只读）
  domainReconcile: null, // DomainReconcileResult（领域对齐 dry-run 结果）
  interviews: [],       // InterviewRecord[]（当前作用域访谈记录：套件或未分配桶）
  unassignedInterviews: [], // InterviewRecord[]（未分配桶，仅在选中套件时加载，供认领）
  flatFw: [],           // 框架扁平索引（含 definition / path）
  entityFilter: { kind: '', keyword: '' },
  entityPage: 1,
  treeQuery: '',
  selectedNode: null,   // CoverageNodeInfo（含 _path）
  expanded: new Set(),  // 展开的节点 code
  drawer: null,         // {entityId, apqc, status, note}
  agent: null,          // FDE 助手运行时状态（首次进入初始化）
  loading: false,
  graphScope: 'suite',  // 'suite' = 当前套件图谱；'global' = 全局本体图谱（世界本体）
  globalGraph: null,    // GraphData {nodes, edges}，全局图谱缓存
  processLinks: [],     // GlobalProcessLink[]（全局「本体↔流程」关联，只读派生）
  browseMode: false,    // 流程地图浏览模式（无套件，仅展示全局关联）
};

/* 实体标注快捷读取（套件页表格 + 本体详情共用）
 * 新格式：entityId → { frameworkId: { apqcCode, note, mappedAt } }
 * 旧格式（兼容）：entityId → { frameworkId, apqcCode, note, mappedAt }
 * 统一从 state.frameworkId（当前锁定框架）下取值
 */
function fwEntryOf(entId) {
  const m = state.suite?.annotations?.entityFrameMapping?.[entId];
  if (!m) return null
  // 旧格式
  if (typeof m === 'object' && 'frameworkId' in m) {
    return m.frameworkId === state.frameworkId ? { apqcCode: m.apqcCode, note: m.note, mappedAt: m.mappedAt } : null
  }
  // 新格式
  return m[state.frameworkId] || null
}
function entityApqc(eid) {
  const e = fwEntryOf(eid); return e && e.apqcCode ? e.apqcCode : null
}
function entityStatus(eid) {
  const m = state.suite?.annotations?.coverageMarks?.[eid];
  return (m && m.status) || 'unset';
}

/* ═════════════════════════ 套件框架切换（多框架并行） ═════════════════════════ */
let _fwManageMode = false;   // 是否显示「添加」下拉和「×」移除按钮

function renderSuiteFwSwitcher() {
  const bar = $('#suiteFwBar');
  if (!bar) return;
  // 无当前套件 → 隐藏
  if (!state.currentSuiteId || !state.frameworks || state.frameworks.length === 0) {
    bar.style.display = 'none';
    return;
  }
  // 只有一个框架时仍然显示（让用户知道当前绑定什么，且可随时加第二个）
  bar.style.display = '';
  // 渲染 pills
  const pills = $('#suiteFwPills');
  pills.innerHTML = state.frameworks.map(fwId => {
    const isActive = fwId === state.frameworkId;
    const name = fwNameOf(fwId);
    return `<button class="sfb-pill ${isActive ? 'active' : ''}" data-fw="${esc(fwId)}" title="${esc(fwId)}">
      ${esc(name)}${_fwManageMode ? `<span class="close-fw" data-rm="${esc(fwId)}" title="从套件移除该框架">×</span>` : ''}
    </button>`;
  }).join('');
  // 添加下拉：列出 FW_LIST 中未被当前套件关联的框架
  const addSel = $('#suiteFwAdd');
  const available = (FW_LIST || []).filter(f => !state.frameworks.includes(f.frameworkId));
  if (_fwManageMode && available.length) {
    addSel.style.display = '';
    addSel.innerHTML = '<option value="">+ 关联新框架…</option>'
      + available.map(f => `<option value="${esc(f.frameworkId)}">${esc(f.name)}（${esc(f.frameworkId)}）</option>`).join('');
  } else {
    addSel.style.display = 'none';
  }
  $('#suiteFwManage').textContent = _fwManageMode ? '✓ 完成' : '⚙ 管理关联';
  // 提示：标注按当前框架独立保存；切换后流程地图/覆盖度/抽屉内容随之重算
  $('#suiteFwHint').textContent = `标注各框架独立保存 · 当前 ${fwNameOf(state.frameworkId)}`;
}

async function switchFramework(newFwId) {
  if (!state.frameworks || !state.frameworks.includes(newFwId)) {
    toast('该框架未关联到当前套件', 'err'); return;
  }
  if (newFwId === state.frameworkId) return;
  const fwName = fwNameOf(newFwId);
  try {
    // 先在服务端持久化 activeFrameworkId（meta.json）
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/frameworks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeFrameworkId: newFwId }),
    });
    // 并行重拉所有框架相关数据
    const [coverage, framework, dictionary] = await Promise.all([
      api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + newFwId),
      api('/api/frameworks/' + newFwId),
      api('/api/dictionary?framework=' + newFwId),
    ]);
    state.frameworkId = newFwId;
    state.framework = framework;
    state.flatFw = flattenFramework(framework);
    state.coverage = coverage;
    state.dictionary = dictionary;
    // 重置 UI 状态
    state.selectedNode = null;
    state.expanded = new Set();
    state.treeQuery = '';
    $('#treeSearch').value = '';
    // 抽屉 open 着则 close 掉（标注已按旧框架展示，避免混乱）
    if (state.drawer) closeDrawer();
    // 重绘一切
    renderAll();
    renderSuiteFwSwitcher();
    // 如果流程地图 tab 激活，也要刷新
    if ($('#tab-framework').classList.contains('active')) { renderTree(); renderNodeDetail(); }
    if ($('#tab-interview').classList.contains('active')) renderInterviewTab();
    toast(`已切换到框架「${fwName}」`, 'ok');
  } catch (err) {
    toast('切换框架失败：' + err.message, 'err');
  }
}

async function addFrameworkToSuite(newFwId) {
  if (!newFwId || state.frameworks.includes(newFwId)) return;
  try {
    const newList = [...state.frameworks, newFwId];
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/frameworks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frameworks: newList, activeFrameworkId: state.frameworkId }),
    });
    state.frameworks = newList;
    toast(`已关联框架「${fwNameOf(newFwId)}」，可在切换栏选择激活`, 'ok');
    renderSuiteFwSwitcher();
  } catch (err) {
    toast('关联框架失败：' + err.message, 'err');
  }
}

async function removeFrameworkFromSuite(rmFwId) {
  if (state.frameworks.length <= 1) {
    toast('至少保留一个框架关联', 'err'); return;
  }
  if (rmFwId === state.frameworkId) {
    toast('当前激活的框架不能直接移除，先切到其他框架再移除', 'err'); return;
  }
  const newList = state.frameworks.filter(id => id !== rmFwId);
  if (!confirm(`从套件移除框架「${fwNameOf(rmFwId)}」？\n该框架下的实体标注会保留（未删除），但不再随套件加载。`)) return;
  try {
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/frameworks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frameworks: newList, activeFrameworkId: state.frameworkId }),
    });
    state.frameworks = newList;
    toast(`已移除框架「${fwNameOf(rmFwId)}」`, 'ok');
    renderSuiteFwSwitcher();
  } catch (err) {
    toast('移除框架失败：' + err.message, 'err');
  }
}

/* ═════════════════════════ Tab 切换 ═════════════════════════ */
function switchTab(name) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  // global 图谱复用 ontology 面板（同一画布，不同数据源）
  const panelName = (name === 'global') ? 'ontology' : name;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + panelName));
  if (name === 'framework') { renderTree(); renderNodeDetail(); }
  if (name === 'flowchart') { renderFlowTree(); renderMountSelect(); refreshFlowList(); }
  if (name === 'interview') renderInterviewTab();
  if (name === 'ontology') { setGraphScope('suite'); sizeCanvas(); ensureSim(false); }
  if (name === 'global') { setGraphScope('global'); sizeCanvas(); ensureSim(false); }
  if (name === 'agent') renderAgentTab();
  if (name === 'safety' && typeof initSafety === 'function') initSafety();
}

/** 设置图谱范围：suite=当前套件局部图谱，global=跨套件合并的世界本体 */
function setGraphScope(scope) {
  if (typeof state === 'undefined') return;
  if (state.graphScope === scope) return;
  state.graphScope = scope;
  const title = $('#graphTitle');
  const subtitle = $('#graphSubtitle');
  const viewToggle = document.querySelector('#tab-ontology .view-toggle');
  if (title) title.textContent = scope === 'global' ? '🌍 全局本体图谱' : '🕸️ 套件本体图谱';
  if (subtitle) {
    subtitle.textContent = scope === 'global'
      ? '跨套件合并去重后的世界本体 · 主数据实体全局唯一'
      : (state.currentSuiteId ? `当前套件：${state.currentSuiteId}` : '');
  }
  // 全局模式下 CRUD 矩阵无意义（矩阵基于套件流程），仅显示图形视图
  if (viewToggle) viewToggle.style.display = scope === 'global' ? 'none' : '';
  if (scope === 'global') {
    state.viewMode = 'graph';
    document.querySelectorAll('#tab-ontology .view-toggle .toggle').forEach(b => b.classList.toggle('active', b.dataset.view === 'graph'));
  }
  // 触发图谱数据加载与重绘
  if (typeof refreshGraphByScope === 'function') refreshGraphByScope();
}

$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn || btn.disabled) return;
  switchTab(btn.dataset.tab);
});

/* ── 套件框架切换栏事件 ── */
document.addEventListener('click', (e) => {
  const pill = e.target.closest('#suiteFwPills .sfb-pill');
  if (pill) {
    const rm = e.target.closest('.close-fw');
    if (rm) { e.stopPropagation(); removeFrameworkFromSuite(rm.dataset.rm); return; }
    switchFramework(pill.dataset.fw);
    return;
  }
  if (e.target.closest('#suiteFwManage')) {
    _fwManageMode = !_fwManageMode;
    renderSuiteFwSwitcher();
    return;
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'suiteFwAdd' && e.target.value) {
    addFrameworkToSuite(e.target.value);
    e.target.value = '';
  }
});

function updateTabLock() {
  const has = !!state.suite;
  const hasFw = !!state.framework;
  // 仅需全局框架即可工作的 Tab：流程画板、访谈清单、流程地图（浏览模式）
  const fwOnly = ['flowchart', 'interview', 'framework'];
  document.querySelectorAll('nav.tabs button').forEach(b => {
    // suites / safety / global 不依赖当前选中套件（global 跨所有已导入套件）
    if (b.dataset.tab !== 'suites' && b.dataset.tab !== 'safety' && b.dataset.tab !== 'global') {
      b.disabled = fwOnly.includes(b.dataset.tab) ? !hasFw : !has;
    }
  });
}

/* 无套件冷启动：加载全局缺省框架，使画板/访谈两棵树可用（selectSuite 会整组覆盖框架状态，天然优先于此） */
async function ensureGlobalFramework() {
  if (state.framework && state.frameworkId === GLOBAL_DEFAULT_FW) return;
  const framework = await api('/api/frameworks/' + GLOBAL_DEFAULT_FW);
  state.framework = framework;
  state.frameworkId = GLOBAL_DEFAULT_FW;
  state.flatFw = flattenFramework(framework);
}

/* 全局「本体↔流程」关联（只读派生，跨套件合并，保留来源套件） */
async function loadGlobalProcessLinks() {
  try {
    const links = await api('/api/global/process-links');
    state.processLinks = Array.isArray(links) ? links : [];
  } catch {
    state.processLinks = [];
  }
  return state.processLinks;
}

/* 从框架详情跳转到实体并打开抽屉（实体列表在「本体管理」右侧） */
function goEntity(entityId) {
  if (!state.suite) return;
  const ent = state.suite.entities.find(x => x.id === entityId);
  if (!ent) { toast('实体不存在：' + entityId, 'err'); return; }
  switchTab('suites');
  openDrawer(entityId);
}

/* ═════════════════════════ 标注抽屉 ═════════════════════════ */
function openDrawer(entityId) {
  const ent = state.suite.entities.find(x => x.id === entityId);
  if (!ent) return;
  const entry = fwEntryOf(entityId);
  const mark = state.suite.annotations.coverageMarks[entityId];
  state.drawer = {
    entityId,
    apqc: (entry && entry.apqcCode) || '',
    status: (mark && mark.status) || 'unset',
    note: (entry && entry.note) || (mark && mark.note) || '',
  };
  $('#dwTitle').textContent = ent.name;
  $('#dwSub').textContent = `${state.currentSuiteId}:${ent.rawId}`;
  const desc = ent.description || (ent.properties && ent.properties.description) || '';
  $('#dwDesc').style.display = desc ? '' : 'none';
  $('#dwDesc').textContent = desc;
  $('#dwInfo').innerHTML = `
    <dt>Kind</dt><dd><span class="kind-tag">${esc(ent.kind)}</span></dd>
    <dt>轴向</dt><dd>${kindAxisLabel(ent.kind)}</dd>
    <dt>领域</dt><dd>${esc(ent.domain || '—')}${ent.domainCategory ? ` <span class="cat-tag cat-${ent.domainCategory}">${catLabel(ent.domainCategory)}</span>` : ''}</dd>
    ${ent.domainCode ? `<dt>标准领域</dt><dd>${esc(ent.domainCode)} ${esc(ent.domainLabel || '')}<span class="e-id"> · ${esc(ent.domainSource || 'rule')}</span></dd>` : ''}
    <dt>来源</dt><dd class="mono" style="font-size:11px">${esc(ent.sourceFile || '—')}</dd>
    <dt>实体 ID</dt><dd class="mono" style="font-size:11px">${esc(ent.id)}</dd>
    ${ent.canonicalId && ent.canonicalId !== ent.id ? `<dt>规范 ID</dt><dd class="mono" style="font-size:11px">${esc(ent.canonicalId)}</dd>` : ''}
    <dt>框架路径</dt><dd style="line-height:1.7">${fwPathHtml(state.drawer.apqc)}</dd>`;
  const axis = kindAxis(ent.kind);
  const inp = $('#dwApqc');
  inp.disabled = !axis;
  inp.value = state.drawer.apqc;
  const sample = axis ? fwSampleCode(axis) : '';
  inp.placeholder = axis === 'domain' ? `如 ${sample}，仅可选 L1/L2…`
    : axis === 'process' ? `如 ${sample}，仅可选 L3-L5…`
    : `${ent.kind} 类型不参与框架映射`;
  $('#dwNote').value = state.drawer.note;
  renderStatusBtns();
  renderDerive();
  hideSug();
  $('#overlay').classList.add('show');
  $('#drawer').classList.add('show');
}

function kindAxisLabel(kind) {
  const axis = kindAxis(kind);
  return axis === 'domain' ? '<span class="axis-tag axis-domain">名词轴 · L1/L2</span>'
    : axis === 'process' ? '<span class="axis-tag axis-process">动词轴 · L3-L5</span>'
    : '<span class="axis-tag axis-none">不参与映射</span>';
}

/* 领域类别中文标签 */
function catLabel(cat) {
  return cat === 'master' ? '主数据'
    : cat === 'core' ? '核心域'
    : cat === 'supporting' ? '支撑域'
    : cat || '';
}

/* 按当前套件锁定的框架取示例编号：不同框架编号规则不同（APQC / hw-style PCF …），不能写死 */
function fwSampleCode(axis) {
  const want = axis === 'domain' ? ['L2', 'L1'] : ['L3', 'L4'];
  for (const lv of want) {
    const item = (state.flatFw || []).find(n => n.levelId === lv && n.code);
    if (item) return item.code;
  }
  return axis === 'domain' ? 'L2 编号' : 'L3 编号';
}

/* 框架路径：L1 → L5 全链路，可从抽屉直达流程地图 */
function fwPathOf(code) {
  if (!code || !state.flatFw) return null;
  const item = state.flatFw.find(x => x.code === code);
  if (!item) return null;
  return { codes: item.pathCodes || [code], labels: item.pathLabels || [item.label || ''] };
}

function fwPathHtml(code) {
  if (!code) return '<span style="color:var(--text-dim)">未标注</span>';
  const p = fwPathOf(code);
  if (!p) return `<span class="mono">${esc(code)}</span> <span style="color:var(--text-dim)">（不在当前框架中）</span>`;
  const chain = p.codes.map((c, i) =>
    `<span class="mono" style="color:var(--accent)">${esc(c)}</span> ${esc(p.labels[i] || '')}`
  ).join('<span style="color:var(--text-dim)"> › </span>');
  return `${chain}<br><button class="btn" id="dwGotoFw" style="margin-top:5px">在流程地图中定位</button>`;
}

function gotoFrameworkNode(code) {
  if (!code) return false;
  const node = findCoverageNode(code);
  if (!node) { toast(`当前框架中找不到 ${code}`, 'err'); return false; }
  (node._path || []).forEach(p => state.expanded.add(p.code));
  state.expanded.add(code);
  if ($('#drawer').classList.contains('show')) closeDrawer();
  switchTab('framework');
  selectNode(code);
  return true;
}

$('#dwInfo') && $('#dwInfo').addEventListener('click', (e) => {
  if (!e.target.closest('#dwGotoFw') || !state.drawer) return;
  gotoFrameworkNode(($('#dwApqc').value || '').trim() || state.drawer.apqc);
});

function closeDrawer() {
  state.drawer = null;
  $('#overlay').classList.remove('show');
  $('#drawer').classList.remove('show');
}

function renderStatusBtns() {
  const box = $('#dwStatus');
  box.innerHTML = (['covered', 'partial', 'gap', 'unset']).map(s =>
    `<button data-st="${s}" class="st-${s} ${state.drawer.status === s ? 'on' : ''}">${STATUS_LABEL[s]}</button>`).join('');
}

$('#dwStatus').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-st]');
  if (!btn || !state.drawer) return;
  state.drawer.status = btn.dataset.st;
  renderStatusBtns();
});

function renderDerive() {
  const el = $('#dwDerive');
  const warnEl = $('#dwWarn');
  const domEl = $('#dwDomain');
  const code = $('#dwApqc').value.trim();
  const ent = state.drawer ? state.suite.entities.find(x => x.id === state.drawer.entityId) : null;

  // 域归属（来自词典）：展示词条 label 与别名
  const entry = dictEntryFor(code);
  if (code && entry) {
    domEl.style.display = '';
    const aliasTxt = entry.aliases && entry.aliases.length ? `（别名：${esc(entry.aliases.join('、'))}）` : '';
    domEl.innerHTML = `域归属：<b>${esc(entry.code)} ${esc(entry.label)}</b>${aliasTxt}<span class="axis-tag">${esc(entry.level)}</span>`;
  } else if (code) {
    domEl.style.display = '';
    domEl.innerHTML = `域归属：<span class="dim">「${esc(code)}」不在域词典中</span>`;
  } else {
    domEl.style.display = 'none';
    domEl.innerHTML = '';
  }

  // 分流校验：违规即时提示
  if (code && ent) {
    const chk = checkMappingAllowed(ent.kind, code);
    if (!chk.ok) {
      warnEl.style.display = '';
      warnEl.innerHTML = `⚠ ${esc(chk.msg)}`;
    } else {
      warnEl.style.display = 'none';
      warnEl.innerHTML = '';
    }
  } else {
    warnEl.style.display = 'none';
    warnEl.innerHTML = '';
  }

  if (!code) { el.innerHTML = '<span style="opacity:.6">输入框架节点编号后将自动推导 Ontology 编号</span>'; return; }
  const onto = deriveOntologyCodeLocal(code);
  el.innerHTML = onto
    ? `→ 推导 Ontology 编号：<b>${esc(onto)}</b>`
    : `→ <span style="color:var(--st-gap)">编号格式无效（应为 1.2.3 形式的数字分层）</span>`;
}

$('#dwApqc').addEventListener('input', () => { renderDerive(); showSug(); });
$('#dwApqc').addEventListener('focus', () => showSug());
$('#dwApqc').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = $('#dwSug .sug-item');
    if (first) { pickSug(first.dataset.code); }
    e.preventDefault();
  } else if (e.key === 'Escape') {
    hideSug();
  }
});

function pickSug(code) {
  $('#dwApqc').value = code;
  state.drawer.apqc = code;
  renderDerive();
  hideSug();
}

function showSug() {
  if (!state.drawer) return;
  const q = $('#dwApqc').value.trim().toLowerCase();
  const box = $('#dwSug');
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const ent = state.suite.entities.find(x => x.id === state.drawer.entityId);
  const axis = ent ? kindAxis(ent.kind) : null;
  if (!axis) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const lvNum = (id) => { const m = /^L(\d+)$/.exec(id || ''); return m ? +m[1] : 0; };
  const allowed = (n) => axis === 'domain' ? n >= 1 && n <= 2 : n >= 3;
  const lvLabel = (id) => { const l = (state.framework?.levels || []).find(x => x.id === id); return l ? l.id : id; };
  const hits = state.flatFw.filter(n => {
    const ln = lvNum(n.levelId) || levelNumOfCode(n.code);
    if (!allowed(ln)) return false;
    return n.code.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || (n.name || '').toLowerCase().includes(q);
  }).slice(0, 30);
  box.innerHTML = hits.length
    ? hits.map(n => `<div class="sug-item" data-code="${esc(n.code)}">
        <span class="s-code">${esc(n.code)}</span>
        <span class="s-label">${esc(n.label)}</span>
        <span class="s-lv">${esc(lvLabel(n.levelId))}</span>
      </div>`).join('')
    : `<div class="sug-empty">${axis === 'domain' ? '无匹配的 L1/L2 节点' : '无匹配的 L3-L5 节点'}</div>`;
  box.classList.add('show');
}

function hideSug() { const b = $('#dwSug'); b.classList.remove('show'); b.innerHTML = ''; }

$('#dwSug').addEventListener('mousedown', (e) => {
  const item = e.target.closest('.sug-item');
  if (item) { e.preventDefault(); pickSug(item.dataset.code); }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.apqc-box')) hideSug();
});

async function saveDrawer() {
  if (!state.drawer) return;
  const { entityId, status, note } = state.drawer;
  const apqc = $('#dwApqc').value.trim();
  if (apqc && !deriveOntologyCodeLocal(apqc)) { toast('框架编号格式无效（应为 1.2.3 形式的数字分层）', 'err'); return; }
  if (apqc) {
    const ent = state.suite.entities.find(x => x.id === entityId);
    const chk = ent ? checkMappingAllowed(ent.kind, apqc) : { ok: false, msg: '实体不存在' };
    if (!chk.ok) { toast('保存被拒绝：' + chk.msg, 'err'); renderDerive(); return; }
  }
  const btn = $('#dwSave');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const ann = state.suite.annotations;
    const now = Date.now();
    // 保留其他框架的条目，只写/删当前 state.frameworkId 下的 entry
    const prevAll = ann.entityFrameMapping[entityId];
    let base = {};
    if (prevAll) {
      if (typeof prevAll === 'object' && 'frameworkId' in prevAll) {
        // 旧格式 → 先转成新格式单条作为 base
        if (prevAll.frameworkId) base[prevAll.frameworkId] = { apqcCode: prevAll.apqcCode, note: prevAll.note, mappedAt: prevAll.mappedAt };
      } else {
        base = { ...prevAll };
      }
    }
    if (apqc) {
      base[state.frameworkId] = { apqcCode: apqc, note: note || undefined, mappedAt: now };
      ann.entityFrameMapping[entityId] = base;
    } else {
      delete base[state.frameworkId];
      if (Object.keys(base).length) ann.entityFrameMapping[entityId] = base;
      else delete ann.entityFrameMapping[entityId];
    }
    ann.coverageMarks[entityId] = { status, note: note || undefined, updatedAt: now };
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann),
    });
    closeDrawer();
    toast('标注已保存', 'ok');
    // 刷新覆盖度（本地实体标注状态同步更新，无需重新拉取套件）
    state.coverage = await api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + state.frameworkId);
    renderCoverage();
    renderTree();
    renderNodeDetail();
    renderEntities();
    renderOntologyDetail();
  } catch (err) {
    toast('保存失败：' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '保存';
  }
}

$('#dwSave').addEventListener('click', saveDrawer);

/* 流程地图 / 本体图上的「挂载实体」：不经抽屉，直接写 entityFrameMapping（apqcCode 传空则摘除） */
async function setEntityMapping(entityId, apqcCode) {
  if (!state.suite) return false;
  const ent = state.suite.entities.find(x => x.id === entityId);
  if (!ent) { toast('实体不存在：' + entityId, 'err'); return false; }
  const code = (apqcCode || '').trim();
  if (code) {
    const chk = checkMappingAllowed(ent.kind, code);
    if (!chk.ok) { toast('挂载被拒绝：' + chk.msg, 'err'); return false; }
  }
  const ann = state.suite.annotations;
  // 保存失败回滚用：clone 当前框架下的旧 entry + 其他框架原样
  const prevFwEntry = fwEntryOf(entityId);
  const prevAllRaw = ann.entityFrameMapping[entityId];
  try {
    const now = Date.now();
    let base = {};
    if (prevAllRaw) {
      if (typeof prevAllRaw === 'object' && 'frameworkId' in prevAllRaw) {
        if (prevAllRaw.frameworkId) base[prevAllRaw.frameworkId] = { apqcCode: prevAllRaw.apqcCode, note: prevAllRaw.note, mappedAt: prevAllRaw.mappedAt };
      } else {
        base = { ...prevAllRaw };
      }
    }
    if (code) {
      base[state.frameworkId] = { apqcCode: code, note: prevFwEntry?.note || undefined, mappedAt: now };
      ann.entityFrameMapping[entityId] = base;
    } else {
      delete base[state.frameworkId];
      if (Object.keys(base).length) ann.entityFrameMapping[entityId] = base;
      else delete ann.entityFrameMapping[entityId];
    }
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann),
    });
    state.coverage = await api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + state.frameworkId);
    renderCoverage();
    renderTree();
    renderNodeDetail();
    renderEntities();
    renderOntologyDetail();
    if (typeof graph !== 'undefined' && graph.showPcf) { rebuildGraph(false); ensureSim(true); }
    toast(code ? `已把「${ent.name}」挂到 ${code}` : `已解除「${ent.name}」的编号锚定`, 'ok');
    return true;
  } catch (err) {
    // 失败回滚：恢复旧值（框架外的条目保持不变）
    const cur = ann.entityFrameMapping[entityId];
    if (cur && typeof cur === 'object' && !('frameworkId' in cur)) {
      if (prevFwEntry) cur[state.frameworkId] = prevFwEntry;
      else delete cur[state.frameworkId];
      if (!Object.keys(cur).length) delete ann.entityFrameMapping[entityId];
    } else if (prevAllRaw) {
      ann.entityFrameMapping[entityId] = prevAllRaw;
    } else {
      delete ann.entityFrameMapping[entityId];
    }
    toast('保存失败：' + err.message, 'err');
    renderNodeDetail();
    return false;
  }
}

$('#dwClear').addEventListener('click', () => {
  if (!state.drawer) return;
  $('#dwApqc').value = '';
  state.drawer.status = 'unset';
  state.drawer.note = '';
  $('#dwNote').value = '';
  renderStatusBtns();
  renderDerive();
  toast('已清除（点击「保存」生效）');
});

$('#dwClose').addEventListener('click', closeDrawer);
$('#overlay').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.drawer) closeDrawer();
});

/* ═════════════════════════ 主题同步 ═════════════════════════ */
(function syncTheme() {
  try {
    if (window.parent && window.parent !== window) {
      const parentEl = window.parent.document.documentElement;
      const apply = () => {
        if (parentEl.hasAttribute('data-ds-dark-theme')) { document.documentElement.setAttribute('data-theme', 'dark'); return; }
        const t = parentEl.getAttribute('data-ds-theme')
          || parentEl.getAttribute('data-theme')
          || parentEl.getAttribute('data-color-mode');
        if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
      };
      apply();
      // 监听父页面主题变化
      try {
        new MutationObserver(apply).observe(parentEl, { attributes: true, attributeFilter: ['data-theme', 'data-ds-theme', 'data-ds-dark-theme', 'data-color-mode', 'class'] });
      } catch { /* ignore */ }
    }
  } catch { /* cross-origin */ }
})();
