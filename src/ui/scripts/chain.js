/* ═════════════════════════ 因果链路渲染（纯 SVG，无外部依赖） ═════════════════════════ */
const CHAIN_TYPE = {
  event:    { label: '事件', color: '#991b1b' },
  cause:    { label: '原因', color: '#b45309' },
  barrier:  { label: '屏障', color: '#16a34a' },
  evidence: { label: '证据', color: '#2563eb' },
  root:     { label: '根因', color: '#dc2626' },
};

function chainTruncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderChain(container, graph) {
  const nodes = (graph && graph.nodes) || [];
  const edges = (graph && graph.edges) || [];
  if (nodes.length === 0) {
    container.innerHTML = '<div class="chain-empty">没有可展示的因果节点</div>';
    return;
  }

  const NODE_W = 190;
  const NODE_H = 52;
  const GAP_X = 250;
  const GAP_Y = 74;
  const PAD = 26;

  const byLayer = new Map();
  for (const node of nodes) {
    const layer = Number.isFinite(node.layer) ? Math.max(0, Math.round(node.layer)) : 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(node);
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  const order = { event: 0, cause: 1, barrier: 2, root: 3, evidence: 4 };
  for (const layer of layers) {
    byLayer.get(layer).sort((a, b) =>
      (order[a.type] ?? 9) - (order[b.type] ?? 9) || String(a.id).localeCompare(String(b.id)));
  }

  const positions = new Map();
  let maxY = 0;
  for (const layer of layers) {
    const list = byLayer.get(layer);
    list.forEach((node, index) => {
      const x = PAD + layer * GAP_X;
      const y = PAD + index * GAP_Y;
      positions.set(node.id, { x, y, w: NODE_W, h: NODE_H, node });
      if (y + NODE_H > maxY) maxY = y + NODE_H;
    });
  }

  const width = PAD * 2 + (layers.length - 1) * GAP_X + NODE_W;
  const height = Math.max(300, maxY + PAD);
  const markerId = `chain-arrow-${Math.random().toString(36).slice(2, 8)}`;

  const edgeSvg = edges.map(edge => {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (!from || !to) return '';
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const c = Math.max(0.2, Math.min(1, Number(edge.confidence) || 0.6));
    const dash = c < 0.8 ? ' stroke-dasharray="5 4"' : '';
    const label = edge.label ? chainTruncate(edge.label, 8) : '';
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 6;
    return `<g class="chain-edge">
      <path d="${d}" stroke="#8a7e6b" stroke-width="1.6" stroke-opacity="${(0.35 + c * 0.6).toFixed(2)}"${dash} marker-end="url(#${markerId})"></path>
      ${label ? `<text class="e-label" x="${mx}" y="${my}" text-anchor="middle">${esc(label)} · ${c.toFixed(2)}</text>` : ''}
    </g>`;
  }).join('');

  const nodeSvg = [...positions.values()].map(({ x, y, w, h, node }) => {
    const meta = CHAIN_TYPE[node.type] || { label: node.type, color: '#57606a' };
    const unverified = node.unverified ? ' ∘' : '';
    const title = esc(`${node.label}${node.unverified ? '（待验证）' : ''}`);
    return `<g class="chain-node" transform="translate(${x},${y})">
      <title>${title}</title>
      <rect width="${w}" height="${h}" rx="7" fill="var(--card)" stroke="${meta.color}" stroke-width="1.6"></rect>
      <rect width="4" height="${h}" rx="2" fill="${meta.color}"></rect>
      <text class="n-title" x="12" y="21" fill="var(--text)">${esc(chainTruncate(node.label, 21))}${unverified}</text>
      <text class="n-type" x="12" y="38" fill="${meta.color}">${esc(meta.label)}${node.category ? ' · ' + esc(node.category) : ''}</text>
    </g>`;
  }).join('');

  container.innerHTML = `<svg class="chain-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="${markerId}" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#8a7e6b"></path>
      </marker>
    </defs>
    ${edgeSvg}
    ${nodeSvg}
  </svg>`;
}
