/* ═════════════════════════ Tab3 流程地图 ═════════════════════════ */
function flattenFramework(fw) {
  const out = [];
  if (!fw) return out;
  for (const d of fw.domains || []) {
    const root = { code: d.code, name: d.name, label: d.label, levelId: 'L1', definition: d.definition, children: d.children };
    const walk = (n, pathCodes, pathLabels) => {
      const codes = [...pathCodes, n.code];
      const labels = [...pathLabels, n.label];
      out.push({ code: n.code, name: n.name, label: n.label, levelId: n.levelId, definition: n.definition, pathCodes: codes, pathLabels: labels });
      (n.children || []).forEach(ch => walk(ch, codes, labels));
    };
    walk(root, [], []);
  }
  return out;
}

function findCoverageNode(code) {
  let found = null, path = [];
  const walk = (list, parents) => {
    for (const n of list) {
      if (n.code === code) { found = n; path = parents; return true; }
      if (n.children && walk(n.children, [...parents, n])) return true;
    }
    return false;
  };
  // fullTree 为全深度树（L1/L2 域轴 + L3+ 流程轴）；旧数据回退 tree
  walk(state.coverage ? (state.coverage.fullTree || state.coverage.tree) : [], []);
  if (found) found._path = path;
  return found;
}

function findFwDef(code) {
  return state.flatFw.find(n => n.code === code) || null;
}

/* 可见性：无查询 → 全部可见；有查询 → 自身命中（显示整棵子树）或后代命中（祖先链可见并展开） */
function matchState(node, q) {
  if (!q) return 'all';
  const hit = node.code.toLowerCase().includes(q)
    || node.label.toLowerCase().includes(q)
    || (node.name || '').toLowerCase().includes(q);
  const childHit = (node.children || []).some(ch => matchState(ch, q) !== 'no');
  if (hit) return 'subtree';
  if (childHit) return 'ancestor';
  return 'no';
}

/* 浏览模式索引：无套件时按框架定义合成的树（只读，带全局关联对象数） */
let browseIndex = new Map();
function buildBrowseTree() {
  const counts = new Map(); // apqcCode → Set(canonicalId)
  for (const l of (state.processLinks || [])) {
    if (l.frameworkId !== state.frameworkId) continue;
    if (!counts.has(l.apqcCode)) counts.set(l.apqcCode, new Set());
    counts.get(l.apqcCode).add(l.canonicalId);
  }
  const mapNode = (n, parents) => ({
    code: n.code,
    name: n.name || n.label,
    label: n.label || n.name,
    status: 'unset',
    entityCount: (counts.get(n.code) || new Set()).size,
    entities: [],
    levelId: n.levelId,
    _path: parents,
    children: (n.children || []).map(ch => mapNode(ch, [...parents, { code: n.code, label: n.label || n.name }])),
  });
  return (state.framework?.domains || []).map(d => mapNode(d, []));
}

function renderTree() {
  const wrap = $('#treeWrap');
  const c = state.coverage;
  const tree = c ? (c.fullTree || c.tree) : null;
  state.browseMode = !c && !!state.framework;
  if (state.browseMode) {
    browseIndex = new Map();
    const browseTree = buildBrowseTree();
    const index = (list) => { for (const n of list) { browseIndex.set(n.code, n); index(n.children || []); } };
    index(browseTree);
    const bq = state.treeQuery.trim().toLowerCase();
    wrap.innerHTML = browseTree.map(n => renderTreeNode(n, 0, bq)).join('') || '<div class="empty-hint"><div>无匹配节点</div></div>';
    return;
  }
  if (!tree || !tree.length) {
    wrap.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>请先选择套件</div></div>';
    return;
  }
  const q = state.treeQuery.trim().toLowerCase();
  const html = [];
  for (const root of tree) {
    html.push(renderTreeNode(root, 0, q));
  }
  wrap.innerHTML = html.join('') || '<div class="empty-hint"><div>无匹配节点</div></div>';
}

function renderTreeNode(node, depth, q) {
  const ms = matchState(node, q);
  if (ms === 'no') return '';
  const hasKids = node.children && node.children.length > 0;
  const expanded = q ? true : state.expanded.has(node.code);
  const pad = 8 + depth * 18;
  const sel = state.selectedNode && state.selectedNode.code === node.code ? ' selected' : '';
  // 浏览模式为只读：不显示覆盖状态、不提供节点编辑、禁止拖拽
  const browse = state.browseMode;
  const ents = node.entityCount > 0
    ? `<span class="ent-chip" title="${browse ? '全局关联对象数' : '关联实体数'}">${node.entityCount}</span>` : '';
  const namePart = node.label === node.name ? '' : `<span class="t-name">${esc(node.name)}</span>`;
  const badge = browse ? '' : `<span class="badge st-${node.status}">${STATUS_LABEL[node.status]}</span>`;
  const ops = browse ? '' : `<span class="row-ops">
      <button class="rop" data-op="add" title="添加子节点">＋</button>
      <button class="rop" data-op="edit" title="编辑节点（编号/名称/说明）">✎</button>
      <button class="rop" data-op="del" title="删除节点（含子节点）">🗑</button>
    </span>`;
  let html = `<div class="tree-row${sel}" data-code="${esc(node.code)}" data-depth="${depth + 1}" draggable="${browse ? 'false' : 'true'}" style="padding-left:${pad}px">
    <span class="caret ${expanded ? 'open' : ''} ${hasKids ? '' : 'leaf'}" data-caret="1">▶</span>
    <span class="code">${esc(node.code)}</span>
    <span class="t-label">${esc(node.label)}</span>
    ${namePart}
    ${badge}
    ${ents}
    ${ops}
  </div>`;
  if (hasKids && expanded) {
    for (const ch of node.children) html += renderTreeNode(ch, depth + 1, q);
  }
  return html;
}

$('#treeWrap').addEventListener('click', (e) => {
  const op = e.target.closest('.rop');
  if (op) {
    const code = op.closest('.tree-row')?.dataset.code;
    if (!code) return;
    if (op.dataset.op === 'add') addFwChild(code);
    else if (op.dataset.op === 'edit') editFwNode(code);
    else delFwNode(code);
    return;
  }
  const row = e.target.closest('.tree-row');
  if (!row) return;
  const node = findCoverageNode(row.dataset.code) || (state.browseMode ? browseIndex.get(row.dataset.code) : null);
  if (!node) return;
  if (e.target.closest('.caret')) {
    if (node.children && node.children.length) {
      if (state.expanded.has(node.code)) state.expanded.delete(node.code);
      else state.expanded.add(node.code);
      renderTree();
    }
    return;
  }
  selectNode(node.code);
});

let searchTimer = null;
$('#treeSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.treeQuery = e.target.value;
    renderTree();
  }, 200);
});

function selectNode(code) {
  const node = findCoverageNode(code) || (state.browseMode ? browseIndex.get(code) : null);
  if (!node) return;
  state.selectedNode = node;
  renderTree();
  renderNodeDetail();
}

/* 流程覆盖状态（L3+）：从 process 覆盖树取节点状态；不在树中 = 未挂载 */
function procStatusOf(code) {
  let st = null;
  const walk = (list) => { for (const n of list || []) { if (n.code === code) { st = n.status; return true; } if (n.children && walk(n.children)) return true; } return false; };
  walk(state.coverage?.process?.tree || []);
  return st;
}

const PROC_ST_LABEL = { covered: '✅ 流程已覆盖', partial: '🟡 流程部分覆盖', gap: '🔴 未挂载/缺口', unset: '未标注' };

function renderNodeDetail() {
  const box = $('#fwDetail');
  if (state.browseMode) { renderBrowseDetail(box); return; }
  // 覆盖度变化（挂载/摘除实体）后 state.selectedNode 是旧快照，这里按 code 重新解析
  if (state.selectedNode) {
    const fresh = findCoverageNode(state.selectedNode.code);
    if (fresh) state.selectedNode = fresh;
  }
  const node = state.selectedNode;
  if (!node) {
    box.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>点击左侧节点查看详情</div></div>';
    return;
  }
  const def = findFwDef(node.code);
  const pathHtml = node._path && node._path.length
    ? node._path.map(p => `${esc(p.code)} ${esc(p.label)}`).join('<span class="sep">›</span>') + '<span class="sep">›</span>'
    : '';
  // 关联实体 = 覆盖度推导结果 ∪ 显式锚定到该编号的实体（后者挂载后立即出现）
  // 新格式：entityFrameMapping[eid] = { [fwId]: { apqcCode, note, mappedAt } }，按 state.frameworkId 取
  const explicitIds = Object.keys((state.suite.annotations && state.suite.annotations.entityFrameMapping) || {})
    .filter(eid => { const e = fwEntryOf(eid); return e && e.apqcCode === node.code; });
  const explicit = (eid) => { const e = fwEntryOf(eid); return !!(e && e.apqcCode === node.code); };
  // 证据推导（只读派生，不写库）：访谈四问的「对象」按编号归集。
  // 这些是名词实体，按轴向规则不能反向锚定到 L3+ 流程节点，只能作为证据展示。
  const evidenceSrc = new Map();
  const underNode = (c) => !!c && (c === node.code || String(c).startsWith(node.code + '.'));
  for (const itv of (state.interviews || [])) {
    const a = itv.answers && itv.answers.hasObject;
    if (a && a.value && a.entityId && underNode(itv.apqcCode) && !evidenceSrc.has(a.entityId)) {
      evidenceSrc.set(a.entityId, `访谈 ${itv.apqcCode}`);
    }
  }
  const ents = [...new Set([...(node.entities || []), ...explicitIds, ...evidenceSrc.keys()])];
  const entChips = ents.slice(0, 50).map(eid => {
    const ent = state.suite.entities.find(x => x.id === eid);
    if (!ent) return '';
    const tail = explicit(ent.id)
      ? `<span class="ent-x" data-unmap="${esc(ent.id)}" title="解除与当前编号的锚定">×</span>`
      : (evidenceSrc.has(ent.id) ? `<span class="e-src" title="由证据推导，未持久锚定">${esc(evidenceSrc.get(ent.id))}</span>` : '');
    return `<button class="ent-link" data-eid="${esc(ent.id)}">
      <span>${esc(ent.name)}</span>
      <span class="kind-tag">${esc(ent.kind)}</span>
      ${tail || `<span class="e-id">${esc(ent.rawId)}</span>`}
    </button>`;
  }).join('');
  const mountBlock = `
    <div class="fw-mount" id="fwMount" style="display:none">
      <input id="fwMountQ" placeholder="搜索实体名称 / ID">
      <div class="fw-mount-hits" id="fwMountHits"></div>
    </div>`;

  /* L3+ 流程工作区：挂载流程列表 + 流程覆盖状态 + 跳转；L4/L5 四问徽标 */
  const lvl = levelNumOfCode(node.code);
  if (lvl >= 3) {
    const mounted = (state.coverage.process?.mountedFlows || []).filter(f => f.apqcCode === node.code);
    const mountedHtml = mounted.length
      ? mounted.map(f => `<button class="fw-flow-item" data-fid="${esc(f.flowId)}" title="点击在流程画板打开">
          <span class="fi-name">${esc(f.name)}</span>
          <span class="fi-meta">${f.nodeCount} 节点 · ${f.participationCount} 参与</span></button>`).join('')
      : '<div class="rel-empty">尚无流程图挂载到该节点</div>';
    const itvRec = ivRecordOf(node.code);
    const itvSt = ivStatusOf(node.code);
    const itvBits = [];
    if (itvRec) {
      const a = itvRec.answers || {};
      if (a.hasRole?.value && a.hasRole.roleRef) itvBits.push(`👤 ${esc(a.hasRole.roleRef)}`);
      if (a.hasObject?.value && a.hasObject.entityId && a.hasObject.op) itvBits.push(`📄 ${esc((state.suite.entities.find(e => e.id === a.hasObject.entityId) || {}).name || a.hasObject.entityId)} × ${esc(a.hasObject.op)}`);
      if (a.hasRule && !a.hasRule.value) itvBits.push('📏 客户未提');
      else if (a.hasRule?.value && a.hasRule.ruleRef) itvBits.push(`📏 ${esc(a.hasRule.ruleRef)}`);
      if (a.hasBehavior?.value && a.hasBehavior.behaviorRef) itvBits.push(`⚙️ ${esc(a.hasBehavior.behaviorRef)}`);
    }
    const procSt = procStatusOf(node.code);
    box.innerHTML = `
      <div class="fw-detail">
        <h2><span class="code">${esc(node.code)}</span>${esc(node.label)}<span class="en">${esc(node.name)}</span></h2>
        <div class="crumbs">${pathHtml}<b>${esc(node.code)} ${esc(node.label)}</b><span class="badge st-${node.status}" style="margin-left:8px">${STATUS_LABEL[node.status]}</span></div>
        ${def && def.definition ? `<div class="def">${esc(def.definition)}</div>` : ''}
        <div class="stat-line">
          <div class="stat-pill">关联实体 <b>${ents.length}</b></div>
          <div class="stat-pill" style="color:var(--st-covered)">已覆盖 <b>${node.coveredCount}</b></div>
          <div class="stat-pill" style="color:var(--st-partial)">部分 <b>${node.partialCount}</b></div>
          <div class="stat-pill" style="color:var(--st-gap)">缺口 <b>${node.gapCount}</b></div>
        </div>
        <h3 class="section-title">流程覆盖 <span class="badge ${procSt ? 'st-' + procSt : 'st-unset'}">${PROC_ST_LABEL[procSt] || '未纳入流程覆盖'}</span></h3>
        <div class="fw-flows">${mountedHtml}</div>
        <h3 class="section-title">四问访谈 <span class="badge st-${itvSt === 'done' ? 'covered' : itvSt === 'doing' ? 'partial' : 'unset'}">${itvSt === 'done' ? '✅ 已完成' : itvSt === 'doing' ? '🔄 进行中' : '⬜ 未开始'}</span></h3>
        ${itvBits.length ? `<div class="itv-brief">${itvBits.join('　')}</div>` : '<div class="rel-empty">该节点尚未访谈——四问：谁做？动哪些单据？什么规矩？怎么处理？</div>'}
        <div class="fw-jumps">
          <button class="btn" data-jump="flow">✏️ 去画板补画</button>
          <button class="btn" data-jump="interview">🎤 去访谈</button>
        </div>
        <h3 class="section-title">关联实体（${ents.length}${ents.length > 50 ? '，显示前 50' : ''}）
          <button class="btn" data-mount="1" style="float:right;font-size:11px;padding:2px 8px;font-weight:400">＋ 挂载实体</button>
        </h3>
        ${mountBlock}
        <div class="ent-links">${entChips || '<div style="color:var(--text-dim);font-size:12px">还没有实体挂到该编号。访谈里记的「对象」会自动出现在这里；也可点右上角手动挂载流程类实体</div>'}</div>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="fw-detail">
      <h2><span class="code">${esc(node.code)}</span>${esc(node.label)}<span class="en">${esc(node.name)}</span></h2>
      <div class="crumbs">${pathHtml}<b>${esc(node.code)} ${esc(node.label)}</b><span class="badge st-${node.status}" style="margin-left:8px">${STATUS_LABEL[node.status]}</span></div>
      ${def && def.definition ? `<div class="def">${esc(def.definition)}</div>` : ''}
      <div class="stat-line">
        <div class="stat-pill">关联实体 <b>${node.entityCount}</b></div>
        <div class="stat-pill" style="color:var(--st-covered)">已覆盖 <b>${node.coveredCount}</b></div>
        <div class="stat-pill" style="color:var(--st-partial)">部分 <b>${node.partialCount}</b></div>
        <div class="stat-pill" style="color:var(--st-gap)">缺口 <b>${node.gapCount}</b></div>
      </div>
      <div class="cov-bar" title="域覆盖进度：已覆盖/部分/缺口/未标注">
        <i class="cb-covered" style="width:${pct(node.coveredCount, node.entityCount)}%"></i>
        <i class="cb-partial" style="width:${pct(node.partialCount, node.entityCount)}%"></i>
        <i class="cb-gap" style="width:${pct(node.gapCount, node.entityCount)}%"></i>
      </div>
      <h3 class="section-title">域实体（${ents.length}${ents.length > 50 ? '，显示前 50' : ''}）
        <button class="btn" data-mount="1" style="float:right;font-size:11px;padding:2px 8px;font-weight:400">＋ 挂载实体</button>
      </h3>
      ${mountBlock}
      <div class="ent-links">${entChips || '<div style="color:var(--text-dim);font-size:12px">暂无关联实体，点右上角「挂载实体」把名词实体锚定到该编号</div>'}</div>
    </div>`;
}

/* 浏览模式详情：只读展示全局「本体↔流程」关联，不出现覆盖状态 */
function renderBrowseDetail(box) {
  const node = state.selectedNode;
  if (!node) {
    box.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>点击左侧节点查看全局关联</div></div>';
    return;
  }
  const def = findFwDef(node.code);
  const pathHtml = node._path && node._path.length
    ? node._path.map(p => `${esc(p.code)} ${esc(p.label)}`).join('<span class="sep">›</span>') + '<span class="sep">›</span>'
    : '';
  // 该节点及其子树的全局关联，按 canonical 实体聚合，保留来源套件
  const underNode = (code) => !!code && (code === node.code || String(code).startsWith(node.code + '.'));
  const byCanon = new Map();
  for (const l of (state.processLinks || [])) {
    if (l.frameworkId !== state.frameworkId || !underNode(l.apqcCode)) continue;
    const cur = byCanon.get(l.canonicalId) || { name: l.entityName, kind: l.entityKind, suites: new Set() };
    cur.suites.add(l.suiteId);
    byCanon.set(l.canonicalId, cur);
  }
  const chips = Array.from(byCanon.entries()).slice(0, 50).map(([, e]) => `
    <button class="ent-link" title="来源套件：${esc(Array.from(e.suites).join('、'))}">
      <span>${esc(e.name)}</span>
      <span class="kind-tag">${esc(e.kind)}</span>
      <span class="e-id">${esc(Array.from(e.suites).join(' · '))}</span>
    </button>`).join('');
  box.innerHTML = `
    <div class="fw-detail">
      <h2><span class="code">${esc(node.code)}</span>${esc(node.label)}<span class="en">${esc(node.name)}</span></h2>
      <div class="crumbs">${pathHtml}<b>${esc(node.code)} ${esc(node.label)}</b>
        <span class="badge st-unset" style="margin-left:8px">浏览模式 · 不含覆盖状态</span></div>
      ${def && def.definition ? `<div class="def">${esc(def.definition)}</div>` : ''}
      <div class="stat-line">
        <div class="stat-pill">全局关联对象 <b>${byCanon.size}</b></div>
      </div>
      <h3 class="section-title">关联对象（跨套件合并）</h3>
      <div class="ent-links">${chips || '<div style="color:var(--text-dim);font-size:12px">还没有任何套件把流程类对象锚定到该编号</div>'}</div>
      <div class="fw-jumps">
        <button class="btn" data-browse-global="1">🌐 去全局图谱查看</button>
      </div>
      <div style="color:var(--text-dim);font-size:12px;margin-top:8px">
        选择套件后可查看该编号的覆盖状态、访谈证据与流程画板。
      </div>
    </div>`;
}

/* 「挂载实体」候选：按当前节点的轴向过滤，名称/ID 模糊匹配，最多 8 条 */
function renderMountHits(q) {
  const box = $('#fwMountHits');
  if (!box || !state.selectedNode) return;
  const node = state.selectedNode;
  const needAxis = levelNumOfCode(node.code) <= 2 ? 'domain' : 'process';
  const kw = (q || '').trim().toLowerCase();
  const hits = state.suite.entities.filter(ent => {
    if (kindAxis(ent.kind) !== needAxis) return false;
    const m = fwEntryOf(ent.id);
    if (m && m.apqcCode === node.code) return false; // 已挂到当前编号
    if (!kw) return true;
    return (ent.name || '').toLowerCase().includes(kw) || (ent.rawId || '').toLowerCase().includes(kw);
  }).slice(0, 8);
  box.innerHTML = hits.length
    ? hits.map(ent => {
        const m = fwEntryOf(ent.id);
        return `<button class="fw-hit" data-eid="${esc(ent.id)}">
          <span class="fh-name">${esc(ent.name)}</span>
          <span class="kind-tag">${esc(ent.kind)}</span>
          <span class="fh-id">${esc(ent.rawId)}</span>
          ${m && m.apqcCode ? `<span class="fh-warn">已挂 ${esc(m.apqcCode)}</span>` : ''}
        </button>`;
      }).join('')
    : `<div class="fw-mount-empty">${needAxis === 'domain'
        ? '无可挂载的名词实体（L1/L2 仅接受 ENTITY / AGGREGATE_ROOT / RULE / ACTOR / ROLE / REPORT 类型）'
        : '无可挂载的流程实体（L3-L5 仅接受 FLOW / ACTIVITY，通常由流程图参与关系推导）'}</div>`;
}

$('#fwDetail').addEventListener('click', (e) => {
  const browseGlobal = e.target.closest('[data-browse-global]');
  if (browseGlobal) { switchTab('global'); return; }
  const mountBtn = e.target.closest('[data-mount]');
  if (mountBtn) {
    const box = $('#fwMount');
    if (!box) return;
    const open = box.style.display === 'none';
    box.style.display = open ? '' : 'none';
    if (open) { renderMountHits(''); $('#fwMountQ').focus(); }
    return;
  }
  const unmap = e.target.closest('[data-unmap]');
  if (unmap) { setEntityMapping(unmap.dataset.unmap, ''); return; }
  const hit = e.target.closest('.fw-hit');
  if (hit && state.selectedNode) { setEntityMapping(hit.dataset.eid, state.selectedNode.code); return; }
  const jump = e.target.closest('[data-jump]');
  if (jump && state.selectedNode) {
    const code = state.selectedNode.code;
    if (jump.dataset.jump === 'flow') {
      switchTab('flowchart');
      const mounted = (state.coverage.process?.mountedFlows || []).find(f => f.apqcCode === code);
      if (mounted) openFlowchart(mounted.flowId);
      else toast(`画板尚无挂载 ${code} 的流程图，可「新建」后在挂载下拉框选择`, '');
    } else if (jump.dataset.jump === 'interview') {
      switchTab('interview');
      selectInterviewNode(code);
    }
    return;
  }
  const flowItem = e.target.closest('.fw-flow-item');
  if (flowItem) { switchTab('flowchart'); openFlowchart(flowItem.dataset.fid); return; }
  const link = e.target.closest('.ent-link');
  if (link) goEntity(link.dataset.eid);
});

$('#fwDetail').addEventListener('input', (e) => {
  if (e.target.id === 'fwMountQ') renderMountHits(e.target.value);
});

/* ═══════════════ 框架节点编辑（增删改 / 拖拽排序 / 递归重编号） ═══════════════ */
const MAX_FW_DEPTH = 8;

function fwSortedLevels() {
  return (state.framework?.levels || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
function levelIdForDepth(depth) {
  const l = fwSortedLevels()[depth - 1];
  return l ? l.id : `L${depth}`;
}
/* 层级不足时自动扩展 levels（如 hw-style 默认 3 级，可直接加 L4/L5 节点） */
function ensureLevelsForDepth(depth) {
  const fw = state.framework;
  while (fw.levels.length < depth) {
    const n = fw.levels.length + 1;
    fw.levels.push({ id: `L${n}`, name: `Level ${n}`, label: `第${n}级`, order: n });
  }
}
/* L1 域采用 N.0 编号形式，其子节点前缀去掉 .0（与内置框架一致：1.0 → 1.1 → 1.1.1） */
function childPrefixOf(code, depth) {
  return depth === 1 && /\.0$/.test(code) ? code.slice(0, -2) : code;
}

/* 在 state.framework 中定位节点：返回 {node, list, index, parent, depth}（L1 的 parent 为 null） */
function locateFwNode(code) {
  const fw = state.framework;
  if (!fw) return null;
  const walk = (list, parent, depth) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.code === code) return { node: n, list, index: i, parent, depth };
      const r = n.children ? walk(n.children, n, depth + 1) : null;
      if (r) return r;
    }
    return null;
  };
  return walk(fw.domains, null, 1);
}

/* 根节点到 code 的祖先链（用于保存重载后恢复展开与选中） */
function fwPathCodes(code) {
  const path = [];
  const walk = (list) => {
    for (const n of list) {
      if (n.code === code) return true;
      path.push(n.code);
      if (n.children && walk(n.children)) return true;
      path.pop();
    }
    return false;
  };
  walk(state.framework?.domains || []);
  return path;
}

/* 后代编号前缀替换：oldBase → newBase（递归） */
function replaceDescPrefix(node, oldBase, newBase) {
  for (const ch of node.children || []) {
    if (ch.code.startsWith(oldBase + '.')) ch.code = newBase + ch.code.slice(oldBase.length);
    replaceDescPrefix(ch, oldBase, newBase);
  }
}

/* 兄弟顺序 → 编号：children 依当前数组顺序编为 前缀.1..n，后代递归换前缀 */
function renumberChildren(parent, childDepth) {
  const prefix = childPrefixOf(parent.code, childDepth - 1);
  (parent.children || []).forEach((ch, i) => {
    const old = ch.code;
    const nw = `${prefix}.${i + 1}`;
    if (old !== nw) { ch.code = nw; replaceDescPrefix(ch, old, nw); }
    ch.levelId = levelIdForDepth(childDepth);
  });
}

/* L1 域重编号：按顺序编为 1.0 / 2.0 / …，后代递归换前缀 */
function renumberDomains() {
  state.framework.domains.forEach((d, i) => {
    const oldBase = d.code.replace(/\.0$/, '');
    const newBase = String(i + 1);
    if (d.code !== `${newBase}.0`) { d.code = `${newBase}.0`; replaceDescPrefix(d, oldBase, newBase); }
  });
}

/* 跨层级移动后修正子树 levelId */
function relevelSubtree(node, depth) {
  node.levelId = levelIdForDepth(depth);
  for (const ch of node.children || []) relevelSubtree(ch, depth + 1);
}

function subtreeMaxDepth(node) {
  let m = 0;
  const walk = (n, d) => { m = Math.max(m, d); for (const c of n.children || []) walk(c, d + 1); };
  walk(node, 1);
  return m;
}

/* 收集除 root 子树外的全部编号（编号唯一性校验用） */
function collectCodesExcept(root) {
  const set = new Set();
  const walk = (n) => {
    if (n === root) return;
    set.add(n.code);
    for (const c of n.children || []) walk(c);
  };
  for (const d of state.framework?.domains || []) walk(d);
  return set;
}

function snapshotFramework() { state._fwSnap = JSON.stringify(state.framework); }
function restoreFramework() { try { state.framework = JSON.parse(state._fwSnap); } catch { /* ignore */ } }

/* 保存：白底遮罩 → PUT 全量框架 → 强制重载套件（覆盖度/词典/地图按新框架重建）→ 恢复焦点；失败回滚快照 */
async function persistFramework(focusCode) {
  const ov = $('#fwSaving');
  ov && ov.classList.add('show');
  try {
    await api('/api/frameworks/' + encodeURIComponent(state.frameworkId), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: state.framework }),
    });
    toast('流程框架已更新', 'ok');
    if (state.currentSuiteId) {
      await selectSuiteForce(state.currentSuiteId);
      if (focusCode && locateFwNode(focusCode)) {
        state.expanded = new Set(fwPathCodes(focusCode));
        selectNode(focusCode);
      }
    }
  } catch (err) {
    restoreFramework();
    toast('框架保存失败：' + err.message, 'err');
  } finally {
    ov && ov.classList.remove('show');
  }
}

/* ── 增：在某节点下添加子节点（编号取兄弟最大序号 + 1） ── */
function addFwChild(code) {
  const loc = locateFwNode(code);
  if (!loc) return;
  if (loc.depth >= MAX_FW_DEPTH) { toast(`最深支持 ${MAX_FW_DEPTH} 级，无法继续添加子节点`, 'err'); return; }
  snapshotFramework();
  ensureLevelsForDepth(loc.depth + 1);
  const prefix = childPrefixOf(loc.node.code, loc.depth);
  let maxSeg = 0;
  for (const ch of loc.node.children || []) {
    const last = parseInt(String(ch.code).split('.').pop(), 10) || 0;
    if (last > maxSeg) maxSeg = last;
  }
  const node = { code: `${prefix}.${maxSeg + 1}`, name: 'New Node', label: '新节点', levelId: levelIdForDepth(loc.depth + 1), children: [] };
  loc.node.children = loc.node.children || [];
  loc.node.children.push(node);
  state.expanded.add(loc.node.code);
  persistFramework(node.code);
}

/* ── 删：删除节点（含子树）；L1 至少保留一个 ── */
function delFwNode(code) {
  const loc = locateFwNode(code);
  if (!loc) return;
  if (loc.depth === 1 && state.framework.domains.length <= 1) { toast('至少保留一个 L1 流程类别', 'err'); return; }
  const cnt = (loc.node.children || []).length;
  if (!confirm(`删除节点「${loc.node.code} ${loc.node.label}」${cnt ? `及其 ${cnt} 个子节点` : ''}？\n编号不会自动回填补位；已锚定到该编号的实体/流程/访谈需重新调整。`)) return;
  snapshotFramework();
  loc.list.splice(loc.index, 1);
  persistFramework(null);
}

/* ── 改：右侧面板编辑表单（编号 / 中文名 / 英文名 / 说明） ── */
function editFwNode(code) {
  const loc = locateFwNode(code);
  if (!loc) return;
  const n = loc.node;
  $('#fwDetail').innerHTML = `
    <div class="fw-detail fw-edit">
      <h3 class="section-title">✏️ 编辑节点 <span class="code">${esc(n.code)}</span></h3>
      <div class="edit-form">
        <label>编号（数字点分；修改后其子节点编号将递归更新）
          <input id="efCode" value="${esc(n.code)}" autocomplete="off">
        </label>
        <label>中文名称
          <input id="efLabel" value="${esc(n.label)}">
        </label>
        <label>英文名称
          <input id="efName" value="${esc(n.name || '')}">
        </label>
        <label>说明
          <textarea id="efDef" rows="3" placeholder="该流程/域的口径说明…">${esc(n.definition || '')}</textarea>
        </label>
        <div class="map-warn" id="efWarn" style="display:none"></div>
        <div class="edit-actions">
          <button class="btn" id="efCancel">取消</button>
          <button class="btn primary" id="efSave">保存</button>
        </div>
      </div>
    </div>`;
  $('#efCancel').addEventListener('click', () => renderNodeDetail());
  $('#efSave').addEventListener('click', () => saveNodeEdit(loc));
}

function saveNodeEdit(loc) {
  const n = loc.node;
  const newCode = $('#efCode').value.trim();
  const label = $('#efLabel').value.trim();
  const warn = $('#efWarn');
  const fail = (msg) => { warn.style.display = ''; warn.textContent = '⚠ ' + msg; };
  if (!label) { fail('中文名称不能为空'); return; }
  if (!/^\d+(\.\d+)*$/.test(newCode)) { fail('编号必须是数字点分格式（如 4.3.1）'); return; }
  if (loc.depth === 1 && !/^\d+(\.0)?$/.test(newCode)) { fail('L1 流程类别编号应为 1 或 1.0 形式'); return; }
  if (loc.depth > 1) {
    const pfx = childPrefixOf(loc.parent.code, loc.depth - 1);
    if (!newCode.startsWith(pfx + '.') || newCode.split('.').length !== pfx.split('.').length + 1) {
      fail(`编号必须为 ${pfx}.x 形式（父节点 + 一段）`); return;
    }
  }
  const others = collectCodesExcept(n);
  if (newCode !== n.code && others.has(newCode)) { fail(`编号「${newCode}」已存在`); return; }
  snapshotFramework();
  if (newCode !== n.code) {
    const oldBase = childPrefixOf(n.code, loc.depth);
    n.code = newCode;
    replaceDescPrefix(n, oldBase, childPrefixOf(newCode, loc.depth));
  }
  n.label = label;
  n.name = $('#efName').value.trim();
  n.definition = $('#efDef').value.trim() || undefined;
  persistFramework(n.code);
}

/* ── 拖拽排序：上 28% = 放其前 / 下 28% = 放其后 / 中间 = 放入其子 ── */
let dragFw = null;   // {code}
let dropFw = null;   // {code, depth, zone}
const DROP_CLS = ['drop-before', 'drop-after', 'drop-into'];

function clearDropMarks() {
  document.querySelectorAll('#treeWrap .drop-before, #treeWrap .drop-after, #treeWrap .drop-into, #treeWrap .dragging')
    .forEach(el => el.classList.remove(...DROP_CLS, 'dragging'));
}

$('#treeWrap').addEventListener('dragstart', (e) => {
  const row = e.target.closest('.tree-row');
  if (!row) return;
  dragFw = { code: row.dataset.code };
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', row.dataset.code); } catch { /* ignore */ }
  row.classList.add('dragging');
});
$('#treeWrap').addEventListener('dragend', () => { dragFw = null; dropFw = null; clearDropMarks(); });
$('#treeWrap').addEventListener('dragover', (e) => {
  if (!dragFw) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.target.closest('.tree-row');
  clearDropMarks();
  if (!row || row.dataset.code === dragFw.code) { dropFw = null; return; }
  const rect = row.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const zone = y < rect.height * 0.28 ? 'before' : y > rect.height * 0.72 ? 'after' : 'into';
  row.classList.add('drop-' + zone);
  dropFw = { code: row.dataset.code, depth: +row.dataset.depth, zone };
});
$('#treeWrap').addEventListener('drop', (e) => {
  e.preventDefault();
  if (dragFw && dropFw) moveFwNode(dragFw.code, dropFw);
  dragFw = null; dropFw = null; clearDropMarks();
});

function moveFwNode(srcCode, mark) {
  const src = locateFwNode(srcCode);
  const tgt = locateFwNode(mark.code);
  if (!src || !tgt) return;
  if (src.depth === 1 && mark.zone === 'into') { toast('L1 流程类别不能嵌入其他节点，仅可排序', 'err'); return; }
  if (tgt.node.code === src.node.code || tgt.node.code.startsWith(src.node.code + '.')) {
    toast('不能移动到自身或其子节点之下', 'err'); return;
  }
  snapshotFramework();
  src.list.splice(src.index, 1);        // 先摘出源节点
  let hostList, hostDepth;
  if (mark.zone === 'into') {
    tgt.node.children = tgt.node.children || [];
    hostList = tgt.node.children;
    hostDepth = tgt.depth + 1;
    hostList.push(src.node);            // 放入其子：追加到末尾
  } else {
    hostList = tgt.list;
    hostDepth = tgt.depth;
    hostList.splice(hostList.indexOf(tgt.node) + (mark.zone === 'after' ? 1 : 0), 0, src.node);
  }
  if (hostDepth > MAX_FW_DEPTH || hostDepth + subtreeMaxDepth(src.node) - 1 > MAX_FW_DEPTH) {
    restoreFramework();
    toast(`超出最大层级（${MAX_FW_DEPTH} 级）`, 'err'); return;
  }
  ensureLevelsForDepth(hostDepth + subtreeMaxDepth(src.node) - 1);
  relevelSubtree(src.node, hostDepth);
  /* 重编号：源容器与目标容器（跨层级移动时两处都变） */
  if (src.depth === 1) renumberDomains(); else renumberChildren(src.parent, src.depth);
  if (mark.zone === 'into') renumberChildren(tgt.node, hostDepth);
  else if (tgt.depth === 1) renumberDomains(); else renumberChildren(tgt.parent, tgt.depth);
  if (mark.zone === 'into') state.expanded.add(tgt.node.code);
  persistFramework(src.node.code);
}
