/* ═════════════════════════ Tab5 访谈清单：四问 checklist + 自动投影 ═════════════════════════ */
const iv = {
  selectedCode: null,   // 当前访谈的 L3/L4 编号
  currentId: null,      // 已保存记录 id（null = 新记录）
  treeExpanded: new Set(),
  treeQuery: '',
  seeded: false,        // 是否已播种 L1 默认展开
};

const IV_OPS = FLOW_OPS;  // 与流程画板同一套 op 口径（create/read/update/delete/approve）
const IV_OP_SHORT = { create: 'C', read: 'R', update: 'U', delete: 'D', approve: 'A' };

const ivFindNode = (code) => flowFindNode(code);
const ivLevelOf = (code) => levelNumOfCode(code);

function ivRecordOf(code) {
  return (state.interviews || []).find(r => r.apqcCode === code) || null;
}

/* 访谈完成度：done = 角色+对象双有效（可驱动覆盖度）；有记录但未齐 = 进行中 */
function ivStatusOf(code) {
  const rec = ivRecordOf(code);
  if (!rec) return 'none';
  const a = rec.answers || {};
  const hasRole = !!(a.hasRole && a.hasRole.value && a.hasRole.roleRef);
  const hasObj = !!(a.hasObject && a.hasObject.value && a.hasObject.entityId && a.hasObject.op);
  return hasRole && hasObj ? 'done' : 'doing';
}

/* 流程覆盖状态（L3+）：从 process 覆盖树收集 code → status，用于树行点缀 */
function ivCoverageMap() {
  const map = new Map();
  const walk = (list) => { for (const n of list || []) { map.set(n.code, n.status); walk(n.children); } };
  walk(state.coverage?.process?.tree || []);
  return map;
}

/* ─────────── 左栏：L3/L4 树 ─────────── */
function ivTreeNodeHtml(node, depth, q, covMap) {
  const lvl = ivLevelOf(node.code);
  const ms = q ? ((node.code + ' ' + (node.label || '')).toLowerCase().includes(q) ? 'self' : '') : 'root';
  let kidHtml = '';
  let kidHit = false;
  if (node.children && node.children.length) {
    const parts = node.children.map(ch => ivTreeNodeHtml(ch, depth + 1, q, covMap)).filter(Boolean);
    kidHit = parts.length > 0;
    kidHtml = parts.join('');
  }
  if (ms === '' && !kidHit) return '';
  if (lvl < 3 && !kidHtml && !kidHit) return '';
  const hasKids = !!(node.children && node.children.length);
  const expanded = q ? true : iv.treeExpanded.has(node.code);
  const pad = 8 + Math.min(depth, 4) * 18;
  const selectable = lvl >= 3;
  const st = selectable ? ivStatusOf(node.code) : null;
  const cov = selectable ? covMap.get(node.code) : null;
  const dot = selectable
    ? `<i class="iv-dot st-${st}" title="${st === 'done' ? '已完成' : st === 'doing' ? '进行中' : '未开始'}${cov ? ' · 覆盖:' + (cov === 'covered' ? '已覆盖' : cov === 'partial' ? '部分' : '缺口') : ''}"></i>`
    : '';
  const title = selectable ? '点击开始访谈' : '分组（点击展开）';
  let html = `<div class="iv-tree-row ${selectable ? 'sel-row' : 'grp-row'} ${iv.selectedCode === node.code ? 'selected' : ''}"
    data-code="${esc(node.code)}" style="padding-left:${pad}px" title="${esc(node.code)} ${esc(node.label || '')}（${title}）">
    <span class="caret ${expanded ? 'open' : ''} ${hasKids ? '' : 'leaf'}" data-caret="1">▶</span>
    <span class="code">${esc(node.code)}</span>
    <span class="t-label">${esc(node.label || '')}</span>${dot}
  </div>`;
  if (hasKids && expanded) html += kidHtml;
  return html;
}

function renderInterviewTree() {
  const wrap = $('#ivTreeWrap');
  if (!state.framework || !state.framework.domains) {
    wrap.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>请先在「套件管理」中选择套件</div></div>';
    $('#ivProgress').textContent = '—';
    return;
  }
  const q = iv.treeQuery.trim().toLowerCase();
  if (!iv.seeded) {
    for (const d of state.framework.domains) iv.treeExpanded.add(d.code);
    iv.seeded = true;
  }
  const covMap = ivCoverageMap();
  wrap.innerHTML = state.framework.domains.map(d => ivTreeNodeHtml(d, 0, q, covMap)).join('')
    || '<div class="empty-hint"><div>无匹配节点</div></div>';
  renderIvProgress();
}

function renderIvProgress() {
  const codes = [];
  const walk = (list) => { for (const n of list || []) { if (ivLevelOf(n.code) === 3) codes.push(n.code); walk(n.children); } };
  walk(state.framework?.domains || []);
  let done = 0, doing = 0;
  for (const c of codes) { const s = ivStatusOf(c); if (s === 'done') done++; else if (s === 'doing') doing++; }
  $('#ivProgress').textContent = `进度 ${done + doing} / ${codes.length}（完成 ${done}）`;
}

$('#ivTreeSearch') && $('#ivTreeSearch').addEventListener('input', (e) => {
  clearTimeout(window.__ivSearchTimer);
  window.__ivSearchTimer = setTimeout(() => { iv.treeQuery = e.target.value; renderInterviewTree(); }, 200);
});

$('#ivTreeWrap') && $('#ivTreeWrap').addEventListener('click', (e) => {
  const row = e.target.closest('.iv-tree-row');
  if (!row) return;
  const code = row.dataset.code;
  if (e.target.closest('.caret')) {
    const node = ivFindNode(code);
    if (node && node.children && node.children.length) {
      if (iv.treeExpanded.has(code)) iv.treeExpanded.delete(code);
      else iv.treeExpanded.add(code);
      renderInterviewTree();
    }
    return;
  }
  if (ivLevelOf(code) >= 3) selectInterviewNode(code);
});

/* ─────────── 中栏：四问表单 ─────────── */
function ivEntityById(id) {
  return (state.suite?.entities || []).find(e => e.id === id) || null;
}

function renderIvEntitySelect() {
  const sel = $('#ivEntity');
  const list = (state.suite?.entities || [])
    .filter(e => DOMAIN_KINDS.has(e.kind))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  sel.innerHTML = '<option value="">— 选择单据/记录对象 —</option>'
    + list.map(e => `<option value="${esc(e.id)}">${esc(e.name)}（${esc(e.kind)}）</option>`).join('');
  const op = $('#ivOp');
  const curOp = op.value;
  op.innerHTML = '<option value="">— op —</option>'
    + IV_OPS.map(o => `<option value="${o}">${esc(FLOW_OP_LABELS[o])}</option>`).join('');
  if (curOp) op.value = curOp;
}

function renderIvDatalists() {
  const fill = (id, kinds) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = (state.suite?.entities || []).filter(e => kinds.includes(e.kind))
      .map(e => `<option value="${esc(e.name)}">`).join('');
  };
  fill('#ivRoleList', ['ACTOR', 'ROLE']);
  fill('#ivRuleList', ['RULE']);
  fill('#ivBehaviorList', ['BEHAVIOR']);
}

function selectInterviewNode(code) {
  iv.selectedCode = code;
  const rec = ivRecordOf(code);
  iv.currentId = rec ? rec.id : null;
  renderInterviewForm();
  renderInterviewTree();
  renderIvRightList();
}

function renderInterviewForm() {
  const node = iv.selectedCode ? ivFindNode(iv.selectedCode) : null;
  const empty = $('#ivEmpty'), form = $('#ivForm');
  if (!iv.selectedCode || !node) {
    iv.selectedCode = null; iv.currentId = null;
    empty.style.display = ''; form.style.display = 'none';
    $('#ivNodeCode').textContent = '—';
    $('#ivNodeLabel').textContent = '从左侧选择要访谈的 L3/L4 节点';
    $('#ivNodeStatus').textContent = '';
    return;
  }
  empty.style.display = 'none'; form.style.display = '';
  $('#ivNodeCode').textContent = node.code;
  $('#ivNodeLabel').textContent = node.label || '';
  const st = ivStatusOf(node.code);
  const stEl = $('#ivNodeStatus');
  stEl.className = 'iv-node-status st-' + st;
  stEl.textContent = st === 'done' ? '✅ 已完成' : st === 'doing' ? '🔄 进行中' : '⬜ 未开始';
  $('#ivDelete').disabled = !iv.currentId;

  const rec = ivRecordOf(node.code);
  const a = (rec && rec.answers) || {};
  const setQ = (key, cbSel, fieldSel, val) => {
    const ans = a[key];
    const cb = $(cbSel);
    cb.checked = !!(ans && ans.value);
    $(fieldSel).value = (ans && ans.value && val(ans)) || '';
    $(cbSel).closest('.iv-q').classList.toggle('off', !cb.checked);
  };
  setQ('hasRole', '#ivHasRole', '#ivRole', x => x.roleRef);
  setQ('hasRule', '#ivHasRule', '#ivRule', x => x.ruleRef);
  setQ('hasBehavior', '#ivHasBehavior', '#ivBehavior', x => x.behaviorRef);
  const objCb = $('#ivHasObject');
  const obj = a.hasObject;
  objCb.checked = !!(obj && obj.value);
  objCb.closest('.iv-q').classList.toggle('off', !objCb.checked);
  $('#ivEntity').value = (obj && obj.value && obj.entityId) || '';
  $('#ivOp').value = (obj && obj.value && obj.op) || '';
  $('#ivNote').value = (rec && rec.note) || '';
  renderIvProjectLine();
}

function ivCollectForm() {
  const ans = {};
  const role = $('#ivRole').value.trim();
  ans.hasRole = { value: $('#ivHasRole').checked, roleRef: role || undefined };
  ans.hasObject = {
    value: $('#ivHasObject').checked,
    entityId: $('#ivEntity').value || undefined,
    op: $('#ivOp').value || undefined,
  };
  ans.hasRule = { value: $('#ivHasRule').checked, ruleRef: $('#ivRule').value.trim() || undefined };
  ans.hasBehavior = { value: $('#ivHasBehavior').checked, behaviorRef: $('#ivBehavior').value.trim() || undefined };
  return {
    id: iv.currentId || undefined,
    apqcCode: iv.selectedCode,
    note: $('#ivNote').value.trim() || undefined,
    answers: ans,
  };
}

function renderIvProjectLine() {
  const el = $('#ivProjectLine');
  if (!el) return;
  const on = $('#ivHasObject').checked && $('#ivEntity').value && $('#ivOp').value;
  if (on) {
    const ent = ivEntityById($('#ivEntity').value);
    const src = iv.currentId ? `interview:${iv.currentId}` : 'interview:保存后生成';
    el.className = 'iv-project on';
    el.innerHTML = `⚙️ 保存后自动派生参与关系：<b>${esc(ent ? ent.name : '')}</b> × ${esc($('#ivOp').value.toUpperCase())}
      → <span class="mono">ACTIVITY_OPERATES_OBJECT</span>（derivedFrom: <span class="mono">${esc(src)}</span>）`;
  } else {
    el.className = 'iv-project';
    el.textContent = '勾选 ② 并选择对象与操作后，保存即自动投影为参与关系（读取时推导，重导入不丢失）。';
  }
}

$('#ivForm') && $('#ivForm').addEventListener('change', (e) => {
  if (e.target.matches('input[type="checkbox"]')) {
    e.target.closest('.iv-q').classList.toggle('off', !e.target.checked);
  }
  renderIvProjectLine();
});
$('#ivEntity') && $('#ivEntity').addEventListener('change', renderIvProjectLine);
$('#ivOp') && $('#ivOp').addEventListener('change', renderIvProjectLine);

$('#ivSave') && $('#ivSave').addEventListener('click', async () => {
  if (!iv.selectedCode) { toast('请先选择要访谈的节点', 'err'); return; }
  const btn = $('#ivSave');
  btn.disabled = true;
  try {
    const saved = await api(`/api/suites/${encodeURIComponent(state.currentSuiteId)}/interviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ivCollectForm()),
    });
    const idx = state.interviews.findIndex(r => r.id === saved.id);
    if (idx >= 0) state.interviews[idx] = saved; else state.interviews.push(saved);
    iv.currentId = saved.id;
    renderInterviewForm();
    renderInterviewTree();
    renderIvRightList();
    const proj = saved.answers.hasObject?.value && saved.answers.hasObject.entityId && saved.answers.hasObject.op;
    toast(proj ? '已保存，参与关系已自动投影' : '已保存访谈记录', 'ok');
  } catch (err) {
    toast('保存失败：' + err.message, 'err');
  } finally { btn.disabled = false; }
});

$('#ivDelete') && $('#ivDelete').addEventListener('click', async () => {
  if (!iv.currentId) return;
  if (!confirm('确定删除该节点的访谈记录？投影关系将随之消失。')) return;
  try {
    await api(`/api/suites/${encodeURIComponent(state.currentSuiteId)}/interviews/${encodeURIComponent(iv.currentId)}`, { method: 'DELETE' });
    state.interviews = state.interviews.filter(r => r.id !== iv.currentId);
    iv.currentId = null;
    renderInterviewForm();
    renderInterviewTree();
    renderIvRightList();
    toast('已删除访谈记录', 'ok');
  } catch (err) { toast('删除失败：' + err.message, 'err'); }
});

$('#ivGoFlow') && $('#ivGoFlow').addEventListener('click', () => {
  if (!iv.selectedCode) { toast('请先选择要访谈的节点', 'err'); return; }
  const code = iv.selectedCode;
  switchTab('flowchart');
  const mounted = flow.list.find(f => f.apqcCode === code && (f.suiteId === state.currentSuiteId || !f.suiteId));
  if (mounted) openFlowchart(mounted.flowId);
  else toast(`画板尚无挂载 ${code} 的流程图，可「新建」后在挂载下拉框选择`, '');
});

$('#ivExport') && $('#ivExport').addEventListener('click', () => downloadExport('minutes'));

$('#ivDraft') && $('#ivDraft').addEventListener('click', async () => {
  if (!state.currentSuiteId) return;
  if (!state.interviews.length) { toast('本套件暂无访谈记录，先从左侧开始四问', 'err'); return; }
  if (!confirm(`将本套件 ${state.interviews.length} 条访谈记录生成为一个独立画板草稿？\n（已有挂载流程的 L3 编号会跳过；生成后可在画板中调整并保存）`)) return;
  try {
    const res = await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/flow-draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const skipTxt = res.skipped?.length ? `；跳过 ${res.skipped.length} 条（${res.skipped.map(s => s.code + ' ' + s.reason).join('；')}）` : '';
    toast(`已生成画板草稿「${res.draft.name}」，参与关系与角色/规则已预填${skipTxt}`, 'ok');
    // 参与关系变化 → 流程覆盖度刷新
    state.coverage = await api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + state.frameworkId);
    renderCoverage();
    switchTab('flowchart');
    openFlowchart(res.draft.id);
  } catch (err) {
    toast('生成草稿失败：' + err.message, 'err');
  }
});

/* ─────────── 右栏：记录列表 ─────────── */
function ivNodeLabelOf(code) {
  const n = ivFindNode(code);
  return n ? (n.label || '') : code;
}

function renderIvRightList() {
  const box = $('#ivList');
  const list = state.interviews || [];
  $('#ivCount').textContent = list.length ? `${list.length} 条` : '';
  $('#cntInterviews').textContent = list.length || '';
  if (!list.length) {
    box.innerHTML = '<div class="empty-hint" style="height:160px"><div><div class="big">🎤</div>暂无访谈记录<br>从左侧选择 L3/L4 节点开始四问</div></div>';
    return;
  }
  box.innerHTML = list.map(r => {
    const a = r.answers || {};
    const bits = [];
    if (a.hasRole?.value && a.hasRole.roleRef) bits.push(`👤 ${esc(a.hasRole.roleRef)}`);
    if (a.hasObject?.value && a.hasObject.entityId && a.hasObject.op) {
      const ent = ivEntityById(a.hasObject.entityId);
      bits.push(`📄 ${esc(ent ? ent.name : a.hasObject.entityId)} × ${IV_OP_SHORT[a.hasObject.op] || ''}`);
    }
    if (a.hasRule?.value && a.hasRule.ruleRef) bits.push(`📏 ${esc(a.hasRule.ruleRef)}`);
    else if (a.hasRule && !a.hasRule.value) bits.push('📏 客户未提');
    if (a.hasBehavior?.value && a.hasBehavior.behaviorRef) bits.push(`⚙️ ${esc(a.hasBehavior.behaviorRef)}`);
    const proj = !!(a.hasObject?.value && a.hasObject.entityId && a.hasObject.op);
    return `<div class="iv-item ${r.apqcCode === iv.selectedCode ? 'selected' : ''}" data-code="${esc(r.apqcCode)}">
      <div class="ii-code">${esc(r.apqcCode)}</div>
      <div class="ii-name">${esc(ivNodeLabelOf(r.apqcCode))}</div>
      <div class="ii-sum">${bits.join('<br>') || '—'}</div>
      ${proj ? '<span class="ii-badge">⇒ 已自动投影</span>' : ''}
      <button class="ii-del" data-iid="${esc(r.id)}" title="删除记录">✕</button>
    </div>`;
  }).join('');
}

$('#ivList') && $('#ivList').addEventListener('click', async (e) => {
  const del = e.target.closest('.ii-del');
  if (del) {
    const rec = (state.interviews || []).find(r => r.id === del.dataset.iid);
    if (!rec) return;
    if (!confirm(`删除 ${rec.apqcCode} 的访谈记录？`)) return;
    try {
      await api(`/api/suites/${encodeURIComponent(state.currentSuiteId)}/interviews/${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
      state.interviews = state.interviews.filter(r => r.id !== rec.id);
      if (iv.currentId === rec.id) { iv.currentId = null; renderInterviewForm(); }
      renderInterviewTree();
      renderIvRightList();
      toast('已删除访谈记录', 'ok');
    } catch (err) { toast('删除失败：' + err.message, 'err'); }
    return;
  }
  const item = e.target.closest('.iv-item');
  if (item) selectInterviewNode(item.dataset.code);
});

/* ─────────── Tab 入口（switchTab 调用） ─────────── */
function renderInterviewTab() {
  renderIvEntitySelect();
  renderIvDatalists();
  renderInterviewTree();
  renderIvRightList();
  renderInterviewForm();
}
