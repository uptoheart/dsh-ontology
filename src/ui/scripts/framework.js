/* ═════════════════════════ Tab3 APQC 框架 ═════════════════════════ */
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
  walk(state.coverage ? state.coverage.tree : [], []);
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

function renderTree() {
  const wrap = $('#treeWrap');
  const c = state.coverage;
  if (!c || !c.tree || !c.tree.length) {
    wrap.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>请先选择套件</div></div>';
    return;
  }
  const q = state.treeQuery.trim().toLowerCase();
  const html = [];
  for (const root of c.tree) {
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
  const ents = node.entityCount > 0 ? `<span class="ent-chip" title="关联实体数">${node.entityCount}</span>` : '';
  const namePart = node.label === node.name ? '' : `<span class="t-name">${esc(node.name)}</span>`;
  let html = `<div class="tree-row${sel}" data-code="${esc(node.code)}" style="padding-left:${pad}px">
    <span class="caret ${expanded ? 'open' : ''} ${hasKids ? '' : 'leaf'}" data-caret="1">▶</span>
    <span class="code">${esc(node.code)}</span>
    <span class="t-label">${esc(node.label)}</span>
    ${namePart}
    <span class="badge st-${node.status}">${STATUS_LABEL[node.status]}</span>
    ${ents}
  </div>`;
  if (hasKids && expanded) {
    for (const ch of node.children) html += renderTreeNode(ch, depth + 1, q);
  }
  return html;
}

$('#treeWrap').addEventListener('click', (e) => {
  const row = e.target.closest('.tree-row');
  if (!row) return;
  const node = findCoverageNode(row.dataset.code);
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
  const node = findCoverageNode(code);
  if (!node) return;
  state.selectedNode = node;
  renderTree();
  renderNodeDetail();
}

function renderNodeDetail() {
  const box = $('#fwDetail');
  const node = state.selectedNode;
  if (!node) {
    box.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>点击左侧节点查看详情</div></div>';
    return;
  }
  const def = findFwDef(node.code);
  const pathHtml = node._path && node._path.length
    ? node._path.map(p => `${esc(p.code)} ${esc(p.label)}`).join('<span class="sep">›</span>') + '<span class="sep">›</span>'
    : '';
  const ents = node.entities || [];
  const entChips = ents.slice(0, 50).map(eid => {
    const ent = state.suite.entities.find(x => x.id === eid);
    if (!ent) return '';
    return `<button class="ent-link" data-eid="${esc(ent.id)}">
      <span>${esc(ent.name)}</span>
      <span class="kind-tag">${esc(ent.kind)}</span>
      <span class="e-id">${esc(ent.rawId)}</span>
    </button>`;
  }).join('');
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
      <h3 class="section-title">关联实体（${ents.length}${ents.length > 50 ? '，显示前 50' : ''}）</h3>
      <div class="ent-links">${entChips || '<div style="color:var(--text-dim);font-size:12px">暂无关联实体，可在「本体管理」的实体列表中为实体标注该 APQC 编号</div>'}</div>
    </div>`;
}

$('#fwDetail').addEventListener('click', (e) => {
  const link = e.target.closest('.ent-link');
  if (!link) return;
  goEntity(link.dataset.eid);
});
