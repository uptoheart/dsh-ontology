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

function renderTree() {
  const wrap = $('#treeWrap');
  const c = state.coverage;
  const tree = c ? (c.fullTree || c.tree) : null;
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
          <div class="stat-pill">关联实体 <b>${node.entityCount}</b></div>
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
        <h3 class="section-title">关联实体（${ents.length}${ents.length > 50 ? '，显示前 50' : ''}）</h3>
        <div class="ent-links">${entChips || '<div style="color:var(--text-dim);font-size:12px">该类型节点不直接挂名词实体（L3+ 由流程与参与关系推导覆盖度）</div>'}</div>
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
      <h3 class="section-title">域实体（${ents.length}${ents.length > 50 ? '，显示前 50' : ''}）</h3>
      <div class="ent-links">${entChips || '<div style="color:var(--text-dim);font-size:12px">暂无关联实体，可在「套件管理」的实体列表中为实体标注该 APQC 编号</div>'}</div>
    </div>`;
}

$('#fwDetail').addEventListener('click', (e) => {
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
