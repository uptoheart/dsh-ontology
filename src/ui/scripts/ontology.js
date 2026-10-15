/* ═════════════════════════ Tab4 本体：实体关系图 ═════════════════════════ */
const KIND_COLORS = {
  AGGREGATE_ROOT: '#f59e0b',
  ENTITY: '#3b82f6',
  DATA_DICTIONARY: '#14b8a6',
  BEHAVIOR: '#8b5cf6',
  RULE: '#ef4444',
  ACTOR: '#ec4899',
  ROLE: '#f97316',
  PERMISSION: '#84cc16',
  FLOW: '#06b6d4',
  ACTIVITY: '#6366f1',
  REPORT: '#a855f7',
  UI_MENU: '#64748b',
  UI_SCREEN: '#22c55e',
  DANGLING_REF: '#9ca3af',
};
const RELATION_LABELS = {
  REFERENCE: '引用',
  AGGREGATE_OWN_ENTITY: '聚合拥有',
  OWNED_BY: '所属聚合',
  USES_RULE: '应用规则',
  RULE_USED_BY: '被规则引用',
  TRIGGERS_BEHAVIOR: '触发行为',
  HAS_ROLE: '拥有角色',
  HAS_PERMISSION: '拥有权限',
  PERMISSION_TARGET: '权限目标',
  FLOW_CONTAINS_ACTIVITY: '流程包含活动',
  ACTIVITY_NEXT: '后续活动',
  ACTIVITY_CALLS_BEHAVIOR: '调用行为',
  ACTIVITY_ROLE: '活动角色',
  FLOW_BUSINESS_OBJECT: '流程业务对象',
  FLOW_ROLE: '流程角色',
  REPORT_SOURCE_OBJECT: '报表来源',
  REPORT_JOIN: '报表连接',
  REPORT_BEHAVIOR: '报表行为',
  MENU_CONTAINS_MENU: '菜单包含',
  MENU_SCREEN: '菜单屏幕',
  CUSTOM: '自定义',
};
const relLabel = (t) => RELATION_LABELS[t] || t;

const graph = {
  nodes: [],        // 可见节点 {id,name,kind,x,y,vx,vy,degree,fixed}
  edges: [],        // 可见边 {source,target,type}
  nodeById: new Map(), // id -> node（可见节点索引）
  allNodes: [],     // 全量（含隐藏）
  posMap: new Map(),// id -> {x,y}（跨筛选保留位置）
  visibleKinds: new Set(),
  alpha: 0,
  raf: 0,
  scale: 1, tx: 0, ty: 0,
  selectedId: null, hoverId: null,
  dragNode: null, panning: false, moved: false,
  lastMouse: { x: 0, y: 0 },
  width: 0, height: 0, dpr: 1,
};

function sizeCanvas() {
  const wrap = $('#graphWrap');
  const canvas = $('#ontoCanvas');
  const rect = wrap.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  graph.dpr = window.devicePixelRatio || 1;
  graph.width = rect.width;
  graph.height = rect.height;
  canvas.width = Math.round(rect.width * graph.dpr);
  canvas.height = Math.round(rect.height * graph.dpr);
  drawGraph();
}

function kindCounts(entities) {
  const m = new Map();
  for (const e of entities) m.set(e.kind, (m.get(e.kind) || 0) + 1);
  return m;
}

function renderLegend() {
  if (!state.suite) { $('#kindLegend').innerHTML = ''; return; }
  const counts = kindCounts(state.suite.entities);
  $('#kindLegend').innerHTML = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `
    <button class="lg-chip ${graph.visibleKinds.has(k) ? '' : 'off'}" data-kind="${esc(k)}" title="点击显示/隐藏该类型">
      <i style="background:${KIND_COLORS[k] || '#9ca3af'}"></i>${esc(k)} <b>${n}</b>
    </button>`).join('');
}

$('#kindLegend').addEventListener('click', (e) => {
  const chip = e.target.closest('.lg-chip');
  if (!chip) return;
  const k = chip.dataset.kind;
  if (graph.visibleKinds.has(k)) graph.visibleKinds.delete(k);
  else graph.visibleKinds.add(k);
  rebuildGraph(false);
  ensureSim(true);
  renderOntologyDetail(); // 全部关闭时 selectedId 被清空，右侧详情同步回空提示
});

function rebuildGraph(resetView) {
  if (!state.suite) { graph.nodes = []; graph.edges = []; renderLegend(); drawGraph(); return; }
  if (resetView) {
    // 默认仅显示聚合根（AGGREGATE_ROOT）；其它类型由用户在图例中手动开启。
    // 套件中不存在聚合根时回退为全部显示；visibleKinds 被用户全部关闭时不自动恢复（画布留空）。
    const hasRoot = state.suite.entities.some(e => e.kind === 'AGGREGATE_ROOT');
    graph.visibleKinds = new Set(hasRoot ? ['AGGREGATE_ROOT'] : state.suite.entities.map(e => e.kind));
  }
  graph.allNodes = state.suite.entities.map(e => ({
    id: e.id, name: e.name, kind: e.kind,
    ...(graph.posMap.get(e.id) || { x: 0, y: 0 }),
    vx: 0, vy: 0, degree: 0, fixed: false,
  }));
  graph.nodes = graph.allNodes.filter(n => graph.visibleKinds.has(n.kind));
  graph.nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  graph.edges = state.suite.relations
    .filter(r => graph.nodeById.has(r.from) && graph.nodeById.has(r.to))
    .map(r => ({ source: r.from, target: r.to, type: r.type }));
  const deg = new Map();
  for (const ed of graph.edges) {
    deg.set(ed.source, (deg.get(ed.source) || 0) + 1);
    deg.set(ed.target, (deg.get(ed.target) || 0) + 1);
  }
  for (const n of graph.nodes) n.degree = deg.get(n.id) || 0;
  // 新节点没有历史位置 → 按类型聚簇初始化
  const kindsArr = Array.from(graph.visibleKinds);
  let fresh = 0;
  for (const n of graph.nodes) {
    if (!graph.posMap.has(n.id)) {
      const ki = Math.max(0, kindsArr.indexOf(n.kind));
      const ang = (ki / Math.max(1, kindsArr.length)) * Math.PI * 2;
      const rr = 40 + Math.random() * 60;
      n.x = Math.cos(ang) * rr + (Math.random() - 0.5) * 80;
      n.y = Math.sin(ang) * rr + (Math.random() - 0.5) * 80;
      fresh++;
    }
  }
  if (resetView) {
    graph.scale = 1; graph.tx = 0; graph.ty = 0;
    graph.alpha = 1;
  } else if (fresh > 0) {
    graph.alpha = Math.max(graph.alpha, 0.5);
  }
  graph.selectedId = graph.nodes.some(n => n.id === graph.selectedId) ? graph.selectedId : null;
  renderLegend();
  drawGraph();
}

function tickGraph() {
  const nodes = graph.nodes, edges = graph.edges, byId = graph.nodeById;
  const a = graph.alpha;
  if (!nodes.length) return;
  // 斥力（O(n²)，套件级规模可接受）
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      let dx = n1.x - n2.x, dy = n1.y - n2.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; d2 = 4; }
      if (d2 > 40000) continue; // 远距离截断
      const f = 1800 / d2 * a;
      const d = Math.sqrt(d2);
      const fx = dx / d * f, fy = dy / d * f;
      n1.vx += fx; n1.vy += fy;
      n2.vx -= fx; n2.vy -= fy;
    }
  }
  // 弹簧
  for (const ed of edges) {
    const s = byId.get(ed.source);
    const t = byId.get(ed.target);
    if (!s || !t) continue;
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - 72) * 0.03 * a;
    const fx = dx / d * f, fy = dy / d * f;
    s.vx += fx; s.vy += fy;
    t.vx -= fx; t.vy -= fy;
  }
  // 向心力 + 阻尼 + 位移
  for (const n of nodes) {
    n.vx -= n.x * 0.012 * a;
    n.vy -= n.y * 0.012 * a;
    if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= 0.85; n.vy *= 0.85;
    n.x += Math.max(-18, Math.min(18, n.vx));
    n.y += Math.max(-18, Math.min(18, n.vy));
    graph.posMap.set(n.id, { x: n.x, y: n.y });
  }
  graph.alpha *= 0.985;
  clampView();
}

function nodeRadius(n) { return 4.5 + Math.min(5, n.degree * 0.6); }

/* 视图钳制：内容包围盒至少保留 edge 像素在画布内，平移/缩放都不能把图完全挪出左侧区域 */
function clampView() {
  if (!graph.nodes.length || !graph.width) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of graph.nodes) {
    const r = nodeRadius(n) + 14;
    if (n.x - r < minX) minX = n.x - r;
    if (n.x + r > maxX) maxX = n.x + r;
    if (n.y - r < minY) minY = n.y - r;
    if (n.y + r > maxY) maxY = n.y + r;
  }
  const s = graph.scale, W = graph.width, H = graph.height, edge = 48;
  // 水平：变换后 left = W/2 + tx + minX*s，right = W/2 + tx + maxX*s
  const loX = -W / 2 - maxX * s + edge;
  const hiX = W / 2 - minX * s - edge;
  if (hiX >= loX) graph.tx = Math.max(loX, Math.min(hiX, graph.tx));
  // 垂直：同理
  const loY = -H / 2 - maxY * s + edge;
  const hiY = H / 2 - minY * s - edge;
  if (hiY >= loY) graph.ty = Math.max(loY, Math.min(hiY, graph.ty));
}

function drawGraph() {
  const canvas = $('#ontoCanvas');
  const ctx = canvas.getContext('2d');
  if (!graph.width) return;
  const byId = graph.nodeById;
  const textCol = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
  ctx.setTransform(graph.dpr, 0, 0, graph.dpr, 0, 0);
  ctx.clearRect(0, 0, graph.width, graph.height);
  ctx.save();
  ctx.translate(graph.width / 2 + graph.tx, graph.height / 2 + graph.ty);
  ctx.scale(graph.scale, graph.scale);

  const sel = graph.selectedId;
  const hov = graph.hoverId;
  const borderCol = 'rgba(128,128,128,.28)';
  const hiCol = 'rgba(245,158,11,.75)';

  // 边
  for (const ed of graph.edges) {
    const s = byId.get(ed.source);
    const t = byId.get(ed.target);
    if (!s || !t) continue;
    const active = sel && (ed.source === sel || ed.target === sel);
    ctx.strokeStyle = active ? hiCol : borderCol;
    ctx.lineWidth = active ? 1.6 / graph.scale : 1 / graph.scale;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
  // 节点
  for (const n of graph.nodes) {
    const r = nodeRadius(n);
    const isSel = n.id === sel, isHov = n.id === hov;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = KIND_COLORS[n.kind] || '#9ca3af';
    ctx.fill();
    if (isSel) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f59e0b';
      ctx.lineWidth = 2.4 / graph.scale;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3 / graph.scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isHov) {
      ctx.strokeStyle = 'rgba(128,128,128,.8)';
      ctx.lineWidth = 1.6 / graph.scale;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2 / graph.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 标签：放大 / 悬停 / 选中时显示
    if (graph.scale >= 0.9 || isSel || isHov) {
      const label = n.name.length > 9 ? n.name.slice(0, 8) + '…' : n.name;
      ctx.font = `${isSel || isHov ? '600 ' : ''}10px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSel || isHov ? textCol : 'rgba(128,128,128,.95)';
      ctx.fillText(label, n.x, n.y + r + 5);
    }
  }
  ctx.restore();
}

function screenToGraph(mx, my) {
  return {
    x: (mx - graph.width / 2 - graph.tx) / graph.scale,
    y: (my - graph.height / 2 - graph.ty) / graph.scale,
  };
}

function pickNode(mx, my) {
  const p = screenToGraph(mx, my);
  let best = null, bestD = Infinity;
  for (const n of graph.nodes) {
    const dx = n.x - p.x, dy = n.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const hitR = nodeRadius(n) + 6 / graph.scale;
    if (d < hitR && d < bestD) { best = n; bestD = d; }
  }
  return best;
}

const canvasEl = $('#ontoCanvas');

canvasEl.addEventListener('mousedown', (e) => {
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  graph.moved = false;
  graph.lastMouse = { x: mx, y: my };
  const n = pickNode(mx, my);
  if (n) { graph.dragNode = n; n.fixed = true; }
  else { graph.panning = true; }
  canvasEl.classList.add('dragging');
});

canvasEl.addEventListener('mousemove', (e) => {
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const dx = mx - graph.lastMouse.x, dy = my - graph.lastMouse.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) graph.moved = true;
  if (graph.dragNode) {
    const p = screenToGraph(mx, my);
    // 节点拖拽钳制在可视区域内（留 12px 余量），防止拖出左侧画布找不回
    const tl = screenToGraph(0, 0), br = screenToGraph(graph.width, graph.height);
    const pad = 12 / graph.scale;
    graph.dragNode.x = Math.max(tl.x + pad, Math.min(br.x - pad, p.x));
    graph.dragNode.y = Math.max(tl.y + pad, Math.min(br.y - pad, p.y));
    graph.posMap.set(graph.dragNode.id, { x: graph.dragNode.x, y: graph.dragNode.y });
    graph.alpha = Math.max(graph.alpha, 0.25);
    ensureSim(true);
  } else if (graph.panning) {
    graph.tx += dx; graph.ty += dy;
    clampView();
    drawGraph();
  } else {
    const n = pickNode(mx, my);
    const prev = graph.hoverId;
    graph.hoverId = n ? n.id : null;
    canvasEl.classList.toggle('pointing', !!n);
    if (prev !== graph.hoverId) drawGraph();
  }
  graph.lastMouse = { x: mx, y: my };
});

window.addEventListener('mouseup', (e) => {
  if (graph.dragNode) {
    graph.dragNode.fixed = false;
    if (!graph.moved) selectOntoEntity(graph.dragNode.id);
    graph.dragNode = null;
  }
  graph.panning = false;
  canvasEl.classList.remove('dragging');
});

canvasEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const ns = Math.max(0.15, Math.min(4, graph.scale * k));
  // 以鼠标为中心缩放
  graph.tx = (graph.tx + graph.width / 2 - mx) * (ns / graph.scale) - graph.width / 2 + mx;
  graph.ty = (graph.ty + graph.height / 2 - my) * (ns / graph.scale) - graph.height / 2 + my;
  graph.scale = ns;
  clampView();
  drawGraph();
}, { passive: false });

$('#btnGraphReset').addEventListener('click', () => {
  graph.scale = 1; graph.tx = 0; graph.ty = 0;
  drawGraph();
});

function ensureSim(reheat) {
  if (graph.raf || !graph.nodes.length) return;
  if (reheat && graph.alpha < 0.015) graph.alpha = 0.3;
  if (graph.alpha < 0.015) { drawGraph(); return; }
  graph.raf = requestAnimationFrame(() => {
    graph.raf = 0;
    if (!$('#tab-ontology').classList.contains('active')) return;
    tickGraph();
    drawGraph();
    if (graph.alpha > 0.015) ensureSim(false);
  });
}

window.addEventListener('resize', () => {
  if ($('#tab-ontology').classList.contains('active')) sizeCanvas();
});

/* ═════════════════════════ Tab4 本体：右侧详情 ═════════════════════════ */
function entityRelations(eid) {
  // 返回 [{rel, other, dir}]  dir: 'out' | 'in'
  const out = [];
  for (const r of state.suite.relations) {
    if (r.from === eid) out.push({ rel: r, other: r.to, dir: 'out' });
    else if (r.to === eid) out.push({ rel: r, other: r.from, dir: 'in' });
  }
  return out;
}

function selectOntoEntity(eid) {
  if (!state.suite) return;
  graph.selectedId = eid;
  // 视图平移至该节点
  const n = graph.nodes.find(x => x.id === eid);
  if (n) {
    graph.tx = -n.x * graph.scale;
    graph.ty = -n.y * graph.scale;
    clampView();
  }
  drawGraph();
  renderOntologyDetail();
}

function renderOntologyDetail() {
  const box = $('#ontoDetail');
  const eid = graph.selectedId;
  const ent = eid && state.suite ? state.suite.entities.find(x => x.id === eid) : null;
  if (!ent) {
    box.innerHTML = '<div class="empty-hint"><div><div class="big">🧩</div>点击左侧实体节点，查看行为、规则与关联内容</div></div>';
    return;
  }
  const rels = entityRelations(ent.id);
  const entOf = (id) => state.suite.entities.find(x => x.id === id);
  const uniq = (arr) => {
    const seen = new Set();
    return arr.filter(it => { const k = it.other + '|' + it.rel.type + '|' + it.dir; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const behaviors = uniq(rels.filter(r => { const o = entOf(r.other); return o && o.kind === 'BEHAVIOR'; }));
  const rules = uniq(rels.filter(r => { const o = entOf(r.other); return o && o.kind === 'RULE'; }));
  const others = uniq(rels.filter(r => { const o = entOf(r.other); return o && o.kind !== 'BEHAVIOR' && o.kind !== 'RULE'; }));

  const relItem = (it) => {
    const o = entOf(it.other);
    if (!o) return '';
    const arrow = it.dir === 'out' ? '→' : '←';
    const selCls = o.id === graph.selectedId ? ' sel' : '';
    return `<button class="rel-item${selCls}" data-eid="${esc(o.id)}" title="${esc(relLabel(it.rel.type))} ${arrow} ${esc(o.name)}（${esc(o.kind)}）">
      <span class="dot" style="background:${KIND_COLORS[o.kind] || '#9ca3af'}"></span>
      <span class="arrow">${arrow}</span>
      <span>${esc(o.name)}</span>
    </button>`;
  };
  const groupByType = (list) => {
    const m = new Map();
    for (const it of list) {
      const k = it.rel.type;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    }
    return Array.from(m.entries()).map(([type, items]) => `
      <div class="rel-group">
        <h5>${esc(relLabel(type))} <span class="kind-tag">${esc(type)}</span> · ${items.length}</h5>
        <div class="rel-items">${items.map(relItem).join('')}</div>
      </div>`).join('');
  };

  const desc = ent.description || (ent.properties && ent.properties.description) || '';
  const apqc = entityApqc(ent.id);
  const st = entityStatus(ent.id);

  box.innerHTML = `
    <div class="onto-detail">
      <h2>
        <span class="dot" style="width:11px;height:11px;border-radius:50%;background:${KIND_COLORS[ent.kind] || '#9ca3af'};display:inline-block"></span>
        ${esc(ent.name)}
        <span class="kind-tag">${esc(ent.kind)}</span>
        <span class="badge st-${st}" style="margin-left:auto">${STATUS_LABEL[st]}</span>
        <button class="btn" id="odAnnotate" title="打开标注抽屉">🏷️ 标注</button>
      </h2>
      <div class="od-sub">${esc(ent.rawId)}${apqc ? ' · APQC ' + esc(apqc) : ''}</div>
      ${desc ? `<div class="ent-desc">${esc(desc)}</div>` : ''}
      <div class="detail-sec">
        <h4>实体信息</h4>
        <dl class="info-grid">
          <dt>领域</dt><dd>${esc(ent.domain || '—')}</dd>
          <dt>来源</dt><dd class="mono" style="font-size:11px">${esc(ent.sourceFile || '—')}</dd>
          <dt>实体 ID</dt><dd class="mono" style="font-size:11px">${esc(ent.id)}</dd>
          <dt>APQC 编号</dt><dd class="mono" style="font-size:11px">${apqc ? esc(apqc) : '未标注'}</dd>
          <dt>覆盖状态</dt><dd>${STATUS_LABEL[st]}</dd>
        </dl>
      </div>
      <div class="detail-sec">
        <h4>行为 <span class="sec-n">${behaviors.length}</span></h4>
        ${behaviors.length ? `<div class="rel-items">${behaviors.map(relItem).join('')}</div>` : '<div class="rel-empty">暂无关联行为</div>'}
      </div>
      <div class="detail-sec">
        <h4>规则 <span class="sec-n">${rules.length}</span></h4>
        ${rules.length ? `<div class="rel-items">${rules.map(relItem).join('')}</div>` : '<div class="rel-empty">暂无关联规则</div>'}
      </div>
      <div class="detail-sec">
        <h4>关联内容 <span class="sec-n">${others.length}</span></h4>
        ${others.length ? groupByType(others) : '<div class="rel-empty">暂无其他关联内容</div>'}
      </div>
    </div>`;
}

$('#ontoDetail').addEventListener('click', (e) => {
  if (e.target.closest('#odAnnotate')) {
    if (graph.selectedId) openDrawer(graph.selectedId);
    return;
  }
  const item = e.target.closest('.rel-item');
  if (item) selectOntoEntity(item.dataset.eid);
});
