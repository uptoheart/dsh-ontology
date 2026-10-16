/* ═════════════════════════ Tab 覆盖度：双指标（域覆盖 + 流程覆盖） ═════════════════════════ */
function matrixFromTree(tree) {
  const rows = new Map(); // levelId -> counts
  const leaf = { covered: 0, partial: 0, gap: 0, unset: 0, total: 0 };
  const bump = (m, k) => { let r = m.get(k); if (!r) { r = { covered: 0, partial: 0, gap: 0, unset: 0, total: 0 }; m.set(k, r); } return r; };
  const walk = (node) => {
    const r = bump(rows, node.levelId);
    r[node.status]++; r.total++;
    if (node.children && node.children.length) node.children.forEach(walk);
    else { leaf[node.status]++; leaf.total++; }
  };
  tree.forEach(walk);
  return { rows, leaf };
}

function leafStatsOf(node) {
  const s = { covered: 0, partial: 0, gap: 0, unset: 0, total: 0 };
  const walk = (n) => {
    if (n.children && n.children.length) n.children.forEach(walk);
    else { s[n.status] = (s[n.status] || 0) + 1; s.total++; }
  };
  walk(node);
  return s;
}

function renderCoverage() {
  const panel = $('#tab-coverage');
  const c = state.coverage;
  if (!c || !state.suite) {
    panel.innerHTML = '<div class="empty-hint"><div><div class="big">📊</div>请先在「套件管理」中选择一个套件</div></div>';
    return;
  }
  if (!c.tree || !c.tree.length) {
    panel.innerHTML = '<div class="empty-hint"><div><div class="big">📊</div>该套件暂无覆盖度数据（框架为空）</div></div>';
    return;
  }
  const { rows, leaf } = matrixFromTree(c.tree);
  const levelOrder = (c.levels || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const lvLabel = (id) => { const l = (c.levels || []).find(x => x.id === id); return l ? `${l.id} · ${l.label}` : id; };

  let matrixRows = '';
  for (const lv of levelOrder) {
    const r = rows.get(lv.id);
    if (!r) continue;
    matrixRows += `<tr>
      <td>${esc(lvLabel(lv.id))}</td>
      <td class="num-covered">${r.covered}</td><td class="num-partial">${r.partial}</td>
      <td class="num-gap">${r.gap}</td><td class="num-unset">${r.unset}</td>
      <td class="pct">${pct(r.covered, r.total)}%</td>
    </tr>`;
  }
  matrixRows += `<tr class="row-leaf">
    <td>叶子节点（L2）</td>
    <td class="num-covered">${leaf.covered}</td><td class="num-partial">${leaf.partial}</td>
    <td class="num-gap">${leaf.gap}</td><td class="num-unset">${leaf.unset}</td>
    <td class="pct">${pct(leaf.covered, leaf.total)}%</td>
  </tr>`;

  const domainRows = c.tree.slice().sort((a, b) =>
    (b.coveredCount - a.coveredCount) || a.code.localeCompare(b.code, undefined, { numeric: true })
  ).map(d => {
    const ls = leafStatsOf(d);
    const seg = (n, cls) => ls.total > 0 ? `<span class="seg-${cls}" style="width:${(n / ls.total * 100).toFixed(2)}%"></span>` : '';
    return `<div class="domain-row" data-code="${esc(d.code)}" title="点击在流程地图中查看">
      <div class="d-label"><span class="code">${esc(d.code)}</span>${esc(d.label)}</div>
      <div class="bar">${seg(ls.covered, 'covered')}${seg(ls.partial, 'partial')}${seg(ls.gap, 'gap')}${seg(ls.unset, 'unset')}</div>
      <div class="d-val">${ls.covered} / ${ls.total} · ${STATUS_LABEL[d.status]}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    ${renderViolatedBanner()}
    <div class="section-block export-bar">
      <b>现场交付物导出</b><span class="dim">（内容与页面同口径，浏览器直接下载）</span>
      <button class="btn" data-exp="domain">⬇ 域覆盖度 CSV</button>
      <button class="btn" data-exp="crud">⬇ CRUD 矩阵 CSV</button>
      <button class="btn" data-exp="gap">⬇ 缺口清单 CSV</button>
    </div>
    <div class="section-block metric-block">
      <div class="metric-head">
        <h2>域覆盖度</h2>
        <span class="metric-sub">实体 × L1/L2 · 人工锚定（名词轴）</span>
      </div>
      <div class="stat-cards">
        <div class="stat-card c-total"><div class="k">L2 节点总数</div><div class="v">${c.leafTotal}</div><div class="p">实体 ${c.domainEntityCount ?? 0}/${c.totalEntities} 个参与统计 · ${esc(c.frameworkId)}</div></div>
        <div class="stat-card c-covered"><div class="k">已覆盖</div><div class="v">${c.leafCovered}</div><div class="p">${pct(c.leafCovered, c.leafTotal)}%</div></div>
        <div class="stat-card c-partial"><div class="k">部分覆盖</div><div class="v">${c.leafPartial}</div><div class="p">${pct(c.leafPartial, c.leafTotal)}%</div></div>
        <div class="stat-card c-gap"><div class="k">缺口</div><div class="v">${c.leafGap}</div><div class="p">${pct(c.leafGap, c.leafTotal)}%</div></div>
        <div class="stat-card c-unset"><div class="k">未标注</div><div class="v">${c.leafUnset}</div><div class="p">${pct(c.leafUnset, c.leafTotal)}%</div></div>
      </div>
    </div>
    <div class="section-block metric-block">
      <div class="metric-head">
        <h2>流程覆盖度</h2>
        <span class="metric-sub">L3-L5 · 由流程挂载与参与关系自动推导（动词轴）</span>
      </div>
      ${renderProcessSection()}
    </div>
    <div class="section-block">
      <h3 class="section-title">按层级聚合矩阵（域轴）</h3>
      <table class="matrix">
        <thead><tr><th>层级</th><th>已覆盖</th><th>部分</th><th>缺口</th><th>未标注</th><th>覆盖%</th></tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
    </div>
    <div class="section-block">
      <h3 class="section-title">各 Domain 覆盖</h3>
      ${domainRows}
    </div>
    ${renderDictPanel()}`;
}

/* ─────────── 违规存量映射（P1 迁移提示：只标记不删除） ─────────── */
function renderViolatedBanner() {
  const list = (state.coverage && state.coverage.violatedMappings) || [];
  if (!list.length) return '';
  const items = list.slice(0, 20).map(v => `
    <div class="violated-item" data-veid="${esc(v.entityId)}" title="点击打开标注抽屉迁移">
      <span class="kind-tag">${esc(v.kind)}</span>
      <b>${esc(v.entityName)}</b>
      <span class="mono">→ ${esc(v.apqcCode)}</span>
      <span class="reason">${esc(v.reason)}</span>
      <span class="go">迁移 ›</span>
    </div>`).join('');
  return `
    <div class="section-block violated-banner">
      <div class="vb-head">⚠ 检测到 <b>${list.length}</b> 条存量映射不符合「实体→L1/L2、流程→L3-L5」分流规则<span class="dim">（旧数据未删除，点击条目打开抽屉迁移或清除）</span></div>
      ${items}
      ${list.length > 20 ? `<div class="vb-more">…其余 ${list.length - 20} 条同类型问题</div>` : ''}
    </div>`;
}

/* ─────────── 流程覆盖度（自动推导，只读） ─────────── */
function renderProcessSection() {
  const p = state.coverage && state.coverage.process;
  if (!p) {
    return `<div class="process-placeholder"><div class="pp-main">流程覆盖数据加载中或不可用</div></div>`;
  }
  const seg = (n, cls) => p.l3Total > 0 ? `<span class="seg-${cls}" style="width:${(n / p.l3Total * 100).toFixed(2)}%"></span>` : '';
  const mounted = (p.mountedFlows || []).map(f => `
    <div class="mounted-flow">
      <span class="mf-code">${esc(f.apqcCode)}</span>
      <b>${esc(f.name)}</b>
      <span class="mf-meta">${f.nodeCount} 节点 · 🔗 ${f.participationCount} 参与${f.participationCount ? '' : ' · ⚠ 无参与关系'}</span>
      <span class="mf-open" data-flowid="${esc(f.flowId)}">打开画板 ›</span>
    </div>`).join('');
  const gaps = (p.gapList || []).slice(0, 12).map(g => `
    <div class="gap-item" data-gcode="${esc(g.code)}" title="${esc((g.path || []).join(' / '))}">
      <span class="mf-code">${esc(g.code)}</span>${esc(g.label)}
    </div>`).join('');

  return `
    <div class="stat-cards">
      <div class="stat-card c-total"><div class="k">L3 流程总数</div><div class="v">${p.l3Total}</div><div class="p">挂载点 = 流程画板的整图挂载</div></div>
      <div class="stat-card c-covered"><div class="k">已覆盖</div><div class="v">${p.l3Covered}</div><div class="p">挂载 + 参与关系非空</div></div>
      <div class="stat-card c-partial"><div class="k">部分覆盖</div><div class="v">${p.l3Partial}</div><div class="p">已挂载、暂无参与</div></div>
      <div class="stat-card c-unset"><div class="k">未挂载</div><div class="v">${p.l3Unmounted}</div><div class="p">${pct(p.l3Unmounted, p.l3Total)}% · 访谈/画板工作入口</div></div>
    </div>
    <div class="process-bar">${seg(p.l3Covered, 'covered')}${seg(p.l3Partial, 'partial')}${seg(p.l3Unmounted, 'unset')}</div>
    ${mounted ? `<div class="mounted-list"><div class="fp-sep">已挂载流程图</div>${mounted}</div>` : ''}
    ${gaps ? `<div class="gap-list"><div class="fp-sep">未覆盖 L3（前 12 个，共 ${p.gapList.length}）</div><div class="gap-grid">${gaps}</div></div>` : ''}`;
}

/* ─────────── 域词典（只读面板，P2 起支持别名编辑） ─────────── */
function renderDictPanel() {
  const d = state.dictionary;
  if (!d || !d.entries || !d.entries.length) return '';
  const l1Entries = d.entries.filter(e => e.level === 'L1');
  const body = l1Entries.map(l1 => {
    const kids = d.entries.filter(e => e.level === 'L2' && e.parentCode === l1.code);
    return `<div class="dict-l1">
      <div class="dict-row l1"><span class="code">${esc(l1.code)}</span>${esc(l1.label)}</div>
      ${kids.map(k => `<div class="dict-row l2"><span class="code">${esc(k.code)}</span>${esc(k.label)}${k.aliases && k.aliases.length ? `<span class="alias">别名：${esc(k.aliases.join('、'))}</span>` : ''}</div>`).join('')}
    </div>`;
  }).join('');
  return `
    <details class="section-block dict-panel">
      <summary>📖 域词典（只读）· ${d.entries.length} 条 · 来源 ${esc(d.frameworkId)}</summary>
      <div class="dict-body">${body}</div>
    </details>`;
}

$('#tab-coverage').addEventListener('click', (e) => {
  const expBtn = e.target.closest('[data-exp]');
  if (expBtn) { downloadExport(expBtn.dataset.exp); return; }
  const vRow = e.target.closest('.violated-item');
  if (vRow) { goEntity(vRow.dataset.veid); return; }
  const openBtn = e.target.closest('.mf-open');
  if (openBtn) {
    switchTab('flowchart');
    openFlowchart(openBtn.dataset.flowid);
    return;
  }
  const gapItem = e.target.closest('.gap-item');
  if (gapItem) {
    // 跳到 APQC 地图并定位该 L3（工作入口）
    switchTab('framework');
    const node = findCoverageNode(gapItem.dataset.gcode);
    if (node) selectNode(node.code);
    return;
  }
  const row = e.target.closest('.domain-row');
  if (!row) return;
  switchTab('framework');
  const node = findCoverageNode(row.dataset.code);
  if (node) selectNode(node.code);
});
