/* ═════════════════════════ Tab4 流程图 ═════════════════════════ */
const FLOW_CANVAS_W = 2400, FLOW_CANVAS_H = 1600;
const FLOW_NODE_SIZE = {
  task:     { w: 170, h: 48 },
  start:    { w: 96,  h: 40 },
  end:      { w: 96,  h: 40 },
  decision: { w: 140, h: 80 },
};

const flow = {
  nodes: [],          // {id,type,code,label,x,y}（x,y 为左上角）
  edges: [],          // {id,source,target}
  currentId: null,    // 正在编辑的已保存流程图 id（null = 新图）
  apqcCode: '',       // 整图挂载的 L3 编号（流程覆盖度来源）
  semantics: { activities: {}, participations: [] },  // 语义层：四问 + 参与关系
  selected: null,     // {kind:'node'|'edge', id}
  dragNode: null,     // 拖拽中的节点
  dragOff: { x: 0, y: 0 },
  linking: null,      // {sourceId} 连线中
  linkTarget: null,   // 连线悬停的目标节点元素
  seq: 1,             // 节点/连线 id 序列
  treeExpanded: new Set(),
  treeQuery: '',
  list: [],           // 已保存流程图元数据
};

const FLOW_OPS = ['create', 'read', 'update', 'delete', 'approve'];
const FLOW_OP_LABELS = { create: '创建 create', read: '读取 read', update: '更新 update', delete: '删除 delete', approve: '审批 approve' };

const flowSvg = $('#flowSvg');
const flowWrap = $('#flowCanvasWrap');
// SVG 无 width/height 属性时默认布局尺寸仅约 300x150，超出视口的节点会被裁剪——必须显式设定画布大小
flowSvg.setAttribute('width', FLOW_CANVAS_W);
flowSvg.setAttribute('height', FLOW_CANVAS_H);

const flowNodeById = (id) => flow.nodes.find(n => n.id === id);
const flowTrunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const flowSel = (kind, id) => flow.selected && flow.selected.kind === kind && flow.selected.id === id;

/* 从 framework 原始树查找节点（flatFw 压平后无 children，不能用于展开/折叠） */
function flowFindNode(code) {
  const walk = (list) => {
    for (const n of list || []) {
      if (n.code === code) return n;
      if (n.children) { const r = walk(n.children); if (r) return r; }
    }
    return null;
  };
  return state.framework ? walk(state.framework.domains) : null;
}

/* ─────────── 左栏：APQC 节点树（可拖拽） ─────────── */
function renderFlowTree() {
  const wrap = $('#flowTreeWrap');
  if (!state.framework || !state.framework.domains) {
    wrap.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>请先在「套件管理」中选择套件</div></div>';
    return;
  }
  const q = flow.treeQuery.trim().toLowerCase();
  const html = state.framework.domains.map(d => flowTreeNodeHtml(d, 0, q)).join('');
  wrap.innerHTML = html || '<div class="empty-hint"><div>无匹配节点</div></div>';
}

function flowTreeNodeHtml(node, depth, q) {
  const ms = matchState(node, q);
  if (ms === 'no') return '';
  const hasKids = node.children && node.children.length > 0;
  const expanded = q ? true : flow.treeExpanded.has(node.code);
  const pad = 8 + depth * 18;
  let html = `<div class="flow-tree-row" draggable="true" data-code="${esc(node.code)}"
    style="padding-left:${pad}px" title="${esc(node.code)} ${esc(node.label)}（拖拽到画布）">
    <span class="caret ${expanded ? 'open' : ''} ${hasKids ? '' : 'leaf'}" data-caret="1">▶</span>
    <span class="code">${esc(node.code)}</span>
    <span class="t-label">${esc(node.label)}</span>
    <span class="drag-hint">⠿ 拖</span>
  </div>`;
  if (hasKids && expanded) {
    for (const ch of node.children) html += flowTreeNodeHtml(ch, depth + 1, q);
  }
  return html;
}

$('#flowTreeWrap').addEventListener('click', (e) => {
  const row = e.target.closest('.flow-tree-row');
  if (!row || !e.target.closest('.caret')) return;
  const code = row.dataset.code;
  const node = flowFindNode(code);
  if (node && node.children && node.children.length) {
    if (flow.treeExpanded.has(code)) flow.treeExpanded.delete(code);
    else flow.treeExpanded.add(code);
    renderFlowTree();
  }
});

let flowTreeSearchTimer = null;
$('#flowTreeSearch').addEventListener('input', (e) => {
  clearTimeout(flowTreeSearchTimer);
  flowTreeSearchTimer = setTimeout(() => { flow.treeQuery = e.target.value; renderFlowTree(); }, 200);
});

$('#flowTreeWrap').addEventListener('dragstart', (e) => {
  const row = e.target.closest('.flow-tree-row');
  if (!row) return;
  const def = flowFindNode(row.dataset.code);
  if (!def) return;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'apqc', code: def.code, label: def.label || def.name, name: def.name || '' }));
});

$('#flowTreeWrap').addEventListener('dragend', (e) => {
  const row = e.target.closest('.flow-tree-row');
  if (row) row.classList.remove('dragging');
});

/* ─────────── 画布：放置 / 渲染 ─────────── */
flowWrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });

flowWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  let data = null;
  try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { /* ignore */ }
  if (!data || data.kind !== 'apqc') return;
  const p = flowSvgPoint(e);
  addFlowNode('task', p.x, p.y, { code: data.code, label: data.label || data.code });
});

function flowSvgPoint(e) {
  const r = flowSvg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function addFlowNode(type, cx, cy, extra = {}) {
  const s = FLOW_NODE_SIZE[type] || FLOW_NODE_SIZE.task;
  const x = Math.max(0, Math.min(FLOW_CANVAS_W - s.w, cx - s.w / 2));
  const y = Math.max(0, Math.min(FLOW_CANVAS_H - s.h, cy - s.h / 2));
  const node = { id: 'n' + (++flow.seq), type, label: extra.label || type, x: Math.round(x), y: Math.round(y), ...extra };
  flow.nodes.push(node);
  renderFlow();
  return node;
}

function addFlowEdge(sourceId, targetId) {
  if (sourceId === targetId) return false;
  if (flow.edges.some(e => e.source === sourceId && e.target === targetId)) { toast('两节点间已存在该方向的连线'); return false; }
  flow.edges.push({ id: 'e' + (++flow.seq), source: sourceId, target: targetId });
  renderFlow();
  return true;
}

function renderFlow() {
  $('#flowNodes').innerHTML = flow.nodes.map(flowNodeSvg).join('');
  $('#flowEdges').innerHTML = flow.edges.map(flowEdgeSvg).join('');
  $('#flowEmpty').classList.toggle('hidden', flow.nodes.length > 0);
}

function flowNodeSvg(n) {
  const s = FLOW_NODE_SIZE[n.type] || FLOW_NODE_SIZE.task;
  const sel = flowSel('node', n.id) ? ' selected' : '';
  let body;
  if (n.type === 'decision') {
    body = `<polygon class="n-body" points="${s.w / 2},0 ${s.w},${s.h / 2} ${s.w / 2},${s.h} 0,${s.h / 2}"></polygon>`;
  } else {
    const rx = (n.type === 'start' || n.type === 'end') ? s.h / 2 : 8;
    body = `<rect class="n-body" width="${s.w}" height="${s.h}" rx="${rx}"></rect>`;
  }
  const codeLine = n.code
    ? `<text class="n-code" x="${s.w / 2}" y="17" text-anchor="middle">${esc(n.code)}</text>`
    : '';
  const labelY = n.code ? s.h - 12 : s.h / 2 + 4.5;
  const maxLen = n.type === 'decision' ? 9 : (n.code ? 12 : 14);
  return `<g class="flow-node${sel}" data-id="${esc(n.id)}" transform="translate(${n.x},${n.y})">
    <title>${esc(n.code ? n.code + ' ' : '')}${esc(n.label)}</title>
    ${body}
    ${codeLine}
    <text class="n-label" x="${s.w / 2}" y="${labelY}" text-anchor="middle">${esc(flowTrunc(n.label, maxLen))}</text>
    <circle class="n-port" data-port="${esc(n.id)}" cx="${s.w}" cy="${s.h / 2}" r="5.5"></circle>
  </g>`;
}

/* 边端点：从两节点中心连线与节点包围盒的交点 */
function flowRectIntersect(from, to, n) {
  const s = FLOW_NODE_SIZE[n.type] || FLOW_NODE_SIZE.task;
  const dx = to.x - from.x, dy = to.y - from.y;
  let t = Infinity;
  if (dx !== 0) t = Math.min(t, (dx > 0 ? n.x + s.w - from.x : n.x - from.x) / dx);
  if (dy !== 0) t = Math.min(t, (dy > 0 ? n.y + s.h - from.y : n.y - from.y) / dy);
  if (!isFinite(t)) t = 0;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

function flowEdgeEnds(a, b) {
  const sa = FLOW_NODE_SIZE[a.type] || FLOW_NODE_SIZE.task;
  const sb = FLOW_NODE_SIZE[b.type] || FLOW_NODE_SIZE.task;
  const ac = { x: a.x + sa.w / 2, y: a.y + sa.h / 2 };
  const bc = { x: b.x + sb.w / 2, y: b.y + sb.h / 2 };
  return [flowRectIntersect(ac, bc, a), flowRectIntersect(bc, ac, b)];
}

function flowEdgeSvg(ed) {
  const a = flowNodeById(ed.source), b = flowNodeById(ed.target);
  if (!a || !b) return '';
  const [p1, p2] = flowEdgeEnds(a, b);
  const sel = flowSel('edge', ed.id) ? ' selected' : '';
  const marker = sel ? 'url(#flowArrowHi)' : 'url(#flowArrow)';
  const coords = `x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"`;
  return `<g class="flow-edge${sel}" data-id="${esc(ed.id)}">
    <line class="e-hit" ${coords} stroke="transparent" stroke-width="10" pointer-events="stroke"></line>
    <line class="e-line" ${coords} marker-end="${marker}" pointer-events="none"></line>
  </g>`;
}

/* ─────────── 画布：鼠标交互（拖动 / 连线 / 选择） ─────────── */
flowSvg.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const port = e.target.closest('.n-port');
  if (port) {
    flow.linking = { sourceId: port.dataset.port };
    flowSvg.classList.add('linking');
    const temp = $('#flowTempEdge');
    const p = flowSvgPoint(e);
    temp.setAttribute('x1', p.x); temp.setAttribute('y1', p.y);
    temp.setAttribute('x2', p.x); temp.setAttribute('y2', p.y);
    temp.style.display = '';
    e.preventDefault();
    return;
  }
  const nodeEl = e.target.closest('.flow-node');
  if (nodeEl) {
    const node = flowNodeById(nodeEl.dataset.id);
    if (!node) return;
    flow.selected = { kind: 'node', id: node.id };
    const p = flowSvgPoint(e);
    flow.dragNode = node;
    flow.dragOff = { x: p.x - node.x, y: p.y - node.y };
    flow.moved = false;
    flowSvg.classList.add('dragging');
    renderFlow();
    renderFlowProps();
    e.preventDefault();
    return;
  }
  const edgeEl = e.target.closest('.flow-edge');
  if (edgeEl) {
    flow.selected = { kind: 'edge', id: edgeEl.dataset.id };
    renderFlow();
    renderFlowProps();
    e.preventDefault();
    return;
  }
  setFlowSelection(null);
});

window.addEventListener('mousemove', (e) => {
  if (flow.dragNode) {
    const p = flowSvgPoint(e);
    const s = FLOW_NODE_SIZE[flow.dragNode.type] || FLOW_NODE_SIZE.task;
    const nx = Math.max(0, Math.min(FLOW_CANVAS_W - s.w, p.x - flow.dragOff.x));
    const ny = Math.max(0, Math.min(FLOW_CANVAS_H - s.h, p.y - flow.dragOff.y));
    if (nx !== flow.dragNode.x || ny !== flow.dragNode.y) {
      flow.dragNode.x = Math.round(nx); flow.dragNode.y = Math.round(ny);
      flow.moved = true;
      const el = flowSvg.querySelector(`.flow-node[data-id="${CSS.escape(flow.dragNode.id)}"]`);
      if (el) el.setAttribute('transform', `translate(${flow.dragNode.x},${flow.dragNode.y})`);
      flowUpdateEdgesFor(flow.dragNode.id);
    }
  } else if (flow.linking) {
    const p = flowSvgPoint(e);
    const temp = $('#flowTempEdge');
    temp.setAttribute('x2', p.x); temp.setAttribute('y2', p.y);
    // 高亮悬停目标节点
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = under && under.closest ? under.closest('.flow-node') : null;
    const targetId = nodeEl && nodeEl.dataset.id !== flow.linking.sourceId ? nodeEl.dataset.id : null;
    if (flow.linkTarget && (!targetId || flow.linkTarget.dataset.id !== targetId)) {
      flow.linkTarget.classList.remove('link-target');
      flow.linkTarget = null;
    }
    if (targetId && !flow.linkTarget) {
      flow.linkTarget = flowSvg.querySelector(`.flow-node[data-id="${CSS.escape(targetId)}"]`);
      if (flow.linkTarget) flow.linkTarget.classList.add('link-target');
    }
  }
});

window.addEventListener('mouseup', (e) => {
  if (flow.linking) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = under && under.closest ? under.closest('.flow-node') : null;
    if (nodeEl && nodeEl.dataset.id !== flow.linking.sourceId) {
      addFlowEdge(flow.linking.sourceId, nodeEl.dataset.id);
    }
    flowCancelLink();
  }
  flow.dragNode = null;
  flowSvg.classList.remove('dragging');
});

function flowCancelLink() {
  flow.linking = null;
  if (flow.linkTarget) { flow.linkTarget.classList.remove('link-target'); flow.linkTarget = null; }
  $('#flowTempEdge').style.display = 'none';
  flowSvg.classList.remove('linking');
}

function flowUpdateEdgesFor(nodeId) {
  for (const ed of flow.edges) {
    if (ed.source !== nodeId && ed.target !== nodeId) continue;
    const a = flowNodeById(ed.source), b = flowNodeById(ed.target);
    if (!a || !b) continue;
    const [p1, p2] = flowEdgeEnds(a, b);
    const line = flowSvg.querySelector(`.flow-edge[data-id="${CSS.escape(ed.id)}"] .e-line`);
    if (line) {
      line.setAttribute('x1', p1.x.toFixed(1)); line.setAttribute('y1', p1.y.toFixed(1));
      line.setAttribute('x2', p2.x.toFixed(1)); line.setAttribute('y2', p2.y.toFixed(1));
      const hit = flowSvg.querySelector(`.flow-edge[data-id="${CSS.escape(ed.id)}"] .e-hit`);
      if (hit) {
        hit.setAttribute('x1', p1.x.toFixed(1)); hit.setAttribute('y1', p1.y.toFixed(1));
        hit.setAttribute('x2', p2.x.toFixed(1)); hit.setAttribute('y2', p2.y.toFixed(1));
      }
    }
  }
}

function setFlowSelection(sel) {
  flow.selected = sel;
  renderFlow();
  renderFlowProps();
}

function deleteFlowSelection() {
  if (!flow.selected) { toast('请先点击选中节点或连线'); return; }
  if (flow.selected.kind === 'node') {
    const id = flow.selected.id;
    flow.nodes = flow.nodes.filter(n => n.id !== id);
    flow.edges = flow.edges.filter(e => e.source !== id && e.target !== id);
    // 同步清理语义层
    delete flow.semantics.activities[id];
    flow.semantics.participations = flow.semantics.participations.filter(p => p.nodeId !== id);
  } else {
    flow.edges = flow.edges.filter(e => e.id !== flow.selected.id);
  }
  setFlowSelection(null);
}

document.addEventListener('keydown', (e) => {
  if (!$('#tab-flowchart').classList.contains('active')) return;
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteFlowSelection(); e.preventDefault(); }
  else if (e.key === 'Escape' && flow.linking) flowCancelLink();
});

/* ─────────── 语义层：挂载选择 + 节点属性（四问） ─────────── */
function flowResetSemantics() {
  flow.apqcCode = '';
  flow.semantics = { activities: {}, participations: [] };
}

/* L3 选项：从 framework 原始树收集（L1 → L2 → L3 分组） */
function renderMountSelect() {
  const sel = $('#flowMount');
  const cur = flow.apqcCode || '';
  const opts = ['<option value="">挂载框架 L3…</option>'];
  for (const d of state.framework?.domains || []) {
    for (const l2 of d.children || []) {
      for (const l3 of l2.children || []) {
        opts.push(`<option value="${esc(l3.code)}" ${l3.code === cur ? 'selected' : ''}>${esc(d.code)} ${esc(d.label)} / ${esc(l3.code)} ${esc(l3.label)}</option>`);
      }
    }
  }
  sel.innerHTML = opts.join('');
}

function flowEntityById(id) {
  return (state.suite?.entities || []).find(e => e.id === id) || null;
}

function renderFlowProps() {
  const empty = $('#fpEmpty'), body = $('#fpBody');
  const isNode = flow.selected && flow.selected.kind === 'node';
  $('#fpCode').textContent = '';
  if (!isNode) { empty.style.display = ''; body.style.display = 'none'; return; }
  const node = flowNodeById(flow.selected.id);
  if (!node) { empty.style.display = ''; body.style.display = 'none'; return; }
  empty.style.display = 'none'; body.style.display = '';
  $('#fpCode').textContent = node.code ? node.code : '（无框架编号）';

  // 角色候选：ROLE / ACTOR 实体
  $('#fpRoleList').innerHTML = (state.suite?.entities || [])
    .filter(e => e.kind === 'ROLE' || e.kind === 'ACTOR')
    .map(e => `<option value="${esc(e.name)}"></option>`).join('');

  const act = flow.semantics.activities[node.id] || {};
  $('#fpRole').value = act.roleRef || '';
  $('#fpRules').value = (act.guardRules || []).join('\n');
  $('#fpBehaviors').value = (act.behaviorRefs || []).join('\n');

  const parts = flow.semantics.participations.map((p, idx) => ({ p, idx })).filter(x => x.p.nodeId === node.id);
  const entOpts = (selectedId) => {
    const ents = [...(state.suite?.entities || [])].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return ['<option value="">选择对象实体…</option>']
      .concat(ents.map(e => `<option value="${esc(e.id)}" ${e.id === selectedId ? 'selected' : ''}>${esc(e.name)}（${esc(e.kind)}）</option>`))
      .join('');
  };
  $('#fpParts').innerHTML = parts.length
    ? parts.map(({ p, idx }) => `
      <div class="fp-part" data-idx="${idx}">
        <select class="fp-ent">${entOpts(p.entityId)}</select>
        <select class="fp-op">${FLOW_OPS.map(op => `<option value="${op}" ${op === p.op ? 'selected' : ''}>${esc(FLOW_OP_LABELS[op])}</option>`).join('')}</select>
        <button class="fp-del" title="移除该参与关系">✕</button>
      </div>`).join('')
    : '<div class="fp-none dim">尚无参与关系——该活动动哪些单据？</div>';
}

function flowSelectedNode() {
  if (!flow.selected || flow.selected.kind !== 'node') return null;
  return flowNodeById(flow.selected.id) || null;
}

function flowWriteActivity(nodeId, patch) {
  const cur = flow.semantics.activities[nodeId] || {};
  flow.semantics.activities[nodeId] = { ...cur, ...patch };
}

$('#fpRole').addEventListener('change', () => {
  const n = flowSelectedNode(); if (!n) return;
  flowWriteActivity(n.id, { roleRef: $('#fpRole').value.trim() || undefined });
});
$('#fpRules').addEventListener('change', () => {
  const n = flowSelectedNode(); if (!n) return;
  const rules = $('#fpRules').value.split('\n').map(s => s.trim()).filter(Boolean);
  flowWriteActivity(n.id, { guardRules: rules.length ? rules : undefined });
});
$('#fpBehaviors').addEventListener('change', () => {
  const n = flowSelectedNode(); if (!n) return;
  const refs = $('#fpBehaviors').value.split('\n').map(s => s.trim()).filter(Boolean);
  flowWriteActivity(n.id, { behaviorRefs: refs.length ? refs : undefined });
});
$('#fpAddPart').addEventListener('click', () => {
  const n = flowSelectedNode(); if (!n) return;
  flow.semantics.participations.push({ nodeId: n.id, entityId: '', op: 'create' });
  renderFlowProps();
});
$('#fpParts').addEventListener('change', (e) => {
  const row = e.target.closest('.fp-part'); if (!row) return;
  const part = flow.semantics.participations[+row.dataset.idx]; if (!part) return;
  if (e.target.classList.contains('fp-ent')) part.entityId = e.target.value;
  if (e.target.classList.contains('fp-op')) part.op = e.target.value;
});
$('#fpParts').addEventListener('click', (e) => {
  const btn = e.target.closest('.fp-del'); if (!btn) return;
  const row = btn.closest('.fp-part');
  flow.semantics.participations.splice(+row.dataset.idx, 1);
  renderFlowProps();
});
$('#flowMount').addEventListener('change', (e) => { flow.apqcCode = e.target.value; });

/* ─────────── 常用控制 ─────────── */
$('#tab-flowchart').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const type = btn.dataset.add;
  const label = { start: '开始', end: '结束', decision: '判断', task: '任务节点' }[type] || type;
  // 放置在当前视口中心
  const cx = flowWrap.scrollLeft + flowWrap.clientWidth / 2;
  const cy = flowWrap.scrollTop + flowWrap.clientHeight / 2;
  addFlowNode(type, Math.max(120, cx), Math.max(80, cy), { label });
});

$('#flowDelSel').addEventListener('click', deleteFlowSelection);

/* 新建：提示保存当前画布内容（保存或不保存），随后清空画布绘制新图 */
async function newFlow() {
  if (flow.nodes.length || flow.edges.length) {
    if (confirm('当前画布内容尚未保存，是否先保存？\n「确定」保存后新建，「取消」放弃保存')) {
      const name = $('#flowName').value.trim();
      if (!name) { toast('请先填写流程图名称再保存', 'err'); $('#flowName').focus(); return; }
      await saveFlow();
    } else if (!confirm('不保存将丢失当前画布内容，确定直接新建？')) {
      return;
    }
  }
  flow.nodes = []; flow.edges = [];
  flow.currentId = null; flow.selected = null;
  flowResetSemantics();
  $('#flowName').value = '';
  renderMountSelect();
  renderFlow();
  renderFlowProps();
  renderFlowList();
  flowWrap.scrollTop = 0; flowWrap.scrollLeft = 0;
  toast('已新建空白流程图，可从左侧拖入框架节点', 'ok');
}
$('#flowNew').addEventListener('click', newFlow);

$('#flowClear').addEventListener('click', () => {
  if (flow.nodes.length && !confirm('确定清空画布？未保存的内容将丢失')) return;
  flow.nodes = []; flow.edges = [];
  flow.currentId = null; flow.selected = null;
  flowResetSemantics();
  $('#flowName').value = '';
  renderMountSelect();
  renderFlow();
  renderFlowProps();
});

/* ─────────── 保存 / 导出 PNG ─────────── */
async function saveFlow() {
  const name = $('#flowName').value.trim();
  if (!name) { toast('请先填写流程图名称', 'err'); $('#flowName').focus(); return; }
  if (!flow.nodes.length) { toast('画布为空，请先添加节点', 'err'); return; }
  // 清理无对象的参与关系（entityId 为空的行不落盘）
  const participations = flow.semantics.participations.filter(p => p.entityId);
  const semantics = {
    activities: flow.semantics.activities,
    participations,
  };
  const btn = $('#flowSave');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const saved = await api('/api/flowcharts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: flow.currentId || undefined, name,
        suiteId: state.currentSuiteId || undefined,
        apqcCode: flow.apqcCode || undefined,
        nodes: flow.nodes, edges: flow.edges, semantics,
      }),
    });
    flow.currentId = saved.id;
    const projCount = participations.length;
    toast(projCount || flow.apqcCode
      ? `已保存${flow.apqcCode ? ' · 挂载 ' + flow.apqcCode : ''}${projCount ? ' · ' + projCount + ' 条参与关系已投影' : ''}`
      : '流程图已保存', 'ok');
    await refreshFlowList();
  } catch (err) {
    toast('保存失败：' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 保存';
  }
}
$('#flowSave').addEventListener('click', saveFlow);

/* 导出：克隆 SVG → 内联计算样式 → Image → Canvas(2x) → PNG 下载 */
function flowInlineStyles(clone, source) {
  const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
    'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing'];
  const srcEls = [source, ...source.querySelectorAll('*')];
  const dstEls = [clone, ...clone.querySelectorAll('*')];
  dstEls.forEach((el, i) => {
    const cs = getComputedStyle(srcEls[i]);
    if (!cs) return;
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) el.style.setProperty(p, v);
    }
    el.removeAttribute('class');
  });
}

function exportFlowPng() {
  if (!flow.nodes.length) { toast('画布为空，请先添加节点', 'err'); return; }
  setFlowSelection(null); // 导出内容不含选中高亮
  // 内容包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of flow.nodes) {
    const s = FLOW_NODE_SIZE[n.type] || FLOW_NODE_SIZE.task;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + s.w); maxY = Math.max(maxY, n.y + s.h);
  }
  const pad = 28;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  const w = Math.min(FLOW_CANVAS_W - x, maxX - minX + pad * 2);
  const h = Math.min(FLOW_CANVAS_H - y, maxY - minY + pad * 2);

  const svg = $('#flowSvg');
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  // 必须先内联再删临时连线：内联依赖 clone 与 source 元素一一对应，先删会整体错位一格（节点取到默认黑色填充）
  flowInlineStyles(clone, svg);
  const temp = clone.querySelector('#flowTempEdge');
  if (temp) temp.remove();

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    try {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      // 透明背景：不填充底色（网格是容器 CSS 背景，不在 SVG 内，导出天然不含）
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) { toast('导出失败', 'err'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = ($('#flowName').value.trim() || 'flowchart') + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('已导出 PNG', 'ok');
      }, 'image/png');
    } catch (err) {
      URL.revokeObjectURL(url);
      toast('导出失败：' + err.message, 'err');
    }
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('导出失败：SVG 渲染出错', 'err'); };
  img.src = url;
}
$('#flowExportPng').addEventListener('click', exportFlowPng);

/* ─────────── 右栏：已保存流程图列表 ─────────── */
async function refreshFlowList() {
  try {
    flow.list = await api('/api/flowcharts');
  } catch (err) {
    flow.list = [];
    if ($('#tab-flowchart').classList.contains('active')) toast('加载流程图列表失败：' + err.message, 'err');
  }
  renderFlowList();
}

function renderFlowList() {
  const box = $('#flowList');
  $('#cntFlows').textContent = flow.list.length || '';
  $('#flowCount').textContent = flow.list.length ? `${flow.list.length} 个` : '';
  if (!flow.list.length) {
    box.innerHTML = '<div class="empty-hint" style="height:160px"><div><div class="big">🪢</div>暂无已保存的流程图</div></div>';
    return;
  }
  box.innerHTML = flow.list.map(f => `
    <div class="flow-item ${f.id === flow.currentId ? 'selected' : ''}" data-id="${esc(f.id)}">
      <div class="fi-name">${esc(f.name)}</div>
      <div class="fi-meta">${f.nodeCount} 节点 · ${f.edgeCount} 连线${f.apqcCode ? ' · 📍' + esc(f.apqcCode) : ''}${f.participationCount ? ' · 🔗' + f.participationCount : ''} · ${fmtTime(f.updatedAt)}</div>
      <button class="fi-del" title="删除该流程图">✕</button>
    </div>`).join('');
}

$('#flowList').addEventListener('click', async (e) => {
  const item = e.target.closest('.flow-item');
  if (!item) return;
  const id = item.dataset.id;
  if (e.target.closest('.fi-del')) {
    const meta = flow.list.find(f => f.id === id);
    if (!confirm(`确定删除流程图「${meta ? meta.name : id}」？`)) return;
    try {
      await api('/api/flowcharts/' + encodeURIComponent(id), { method: 'DELETE' });
      if (flow.currentId === id) flow.currentId = null;
      toast('已删除', 'ok');
      await refreshFlowList();
    } catch (err) { toast('删除失败：' + err.message, 'err'); }
    return;
  }
  openFlowchart(id);
});

async function openFlowchart(id) {
  try {
    const data = await api('/api/flowcharts/' + encodeURIComponent(id));
    flow.nodes = (data.nodes || []).map(n => ({ ...n }));
    flow.edges = (data.edges || []).map(e => ({ ...e }));
    flow.currentId = data.id;
    flow.seq = 1;
    for (const it of [...flow.nodes, ...flow.edges]) {
      const m = /^[a-z](\d+)$/.exec(it.id || '');
      if (m) flow.seq = Math.max(flow.seq, +m[1]);
    }
    flow.selected = null;
    flow.apqcCode = data.apqcCode || '';
    flow.semantics = {
      activities: data.semantics?.activities || {},
      participations: (data.semantics?.participations || []).map(p => ({ ...p })),
    };
    $('#flowName').value = data.name;
    renderMountSelect();
    renderFlow();
    renderFlowProps();
    renderFlowList();
    flowWrap.scrollTop = 0; flowWrap.scrollLeft = 0;
  } catch (err) {
    toast('载入失败：' + err.message, 'err');
  }
}
