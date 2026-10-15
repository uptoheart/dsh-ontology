/* ═════════════════════════ Tab2 覆盖度 ═════════════════════════ */
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
    panel.innerHTML = '<div class="empty-hint"><div><div class="big">📊</div>请先在「本体管理」中选择一个套件</div></div>';
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
    <td>叶子节点</td>
    <td class="num-covered">${leaf.covered}</td><td class="num-partial">${leaf.partial}</td>
    <td class="num-gap">${leaf.gap}</td><td class="num-unset">${leaf.unset}</td>
    <td class="pct">${pct(leaf.covered, leaf.total)}%</td>
  </tr>`;

  const domainRows = c.tree.slice().sort((a, b) =>
    (b.coveredCount - a.coveredCount) || a.code.localeCompare(b.code, undefined, { numeric: true })
  ).map(d => {
    const ls = leafStatsOf(d);
    const seg = (n, cls) => ls.total > 0 ? `<span class="seg-${cls}" style="width:${(n / ls.total * 100).toFixed(2)}%"></span>` : '';
    return `<div class="domain-row" data-code="${esc(d.code)}" title="点击在 APQC 框架中查看">
      <div class="d-label"><span class="code">${esc(d.code)}</span>${esc(d.label)}</div>
      <div class="bar">${seg(ls.covered, 'covered')}${seg(ls.partial, 'partial')}${seg(ls.gap, 'gap')}${seg(ls.unset, 'unset')}</div>
      <div class="d-val">${ls.covered} / ${ls.total} · ${STATUS_LABEL[d.status]}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="section-block">
      <div class="stat-cards">
        <div class="stat-card c-total"><div class="k">叶子节点总数</div><div class="v">${c.leafTotal}</div><div class="p">实体 ${c.totalEntities} 个 · ${esc(c.frameworkId)}</div></div>
        <div class="stat-card c-covered"><div class="k">已覆盖</div><div class="v">${c.leafCovered}</div><div class="p">${pct(c.leafCovered, c.leafTotal)}%</div></div>
        <div class="stat-card c-partial"><div class="k">部分覆盖</div><div class="v">${c.leafPartial}</div><div class="p">${pct(c.leafPartial, c.leafTotal)}%</div></div>
        <div class="stat-card c-gap"><div class="k">缺口</div><div class="v">${c.leafGap}</div><div class="p">${pct(c.leafGap, c.leafTotal)}%</div></div>
        <div class="stat-card c-unset"><div class="k">未标注</div><div class="v">${c.leafUnset}</div><div class="p">${pct(c.leafUnset, c.leafTotal)}%</div></div>
      </div>
    </div>
    <div class="section-block">
      <h3 class="section-title">按层级聚合矩阵</h3>
      <table class="matrix">
        <thead><tr><th>层级</th><th>已覆盖</th><th>部分</th><th>缺口</th><th>未标注</th><th>覆盖%</th></tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
    </div>
    <div class="section-block">
      <h3 class="section-title">各 Domain 覆盖</h3>
      ${domainRows}
    </div>`;
}

$('#tab-coverage').addEventListener('click', (e) => {
  const row = e.target.closest('.domain-row');
  if (!row) return;
  switchTab('framework');
  const node = findCoverageNode(row.dataset.code);
  if (node) selectNode(node.code);
});
