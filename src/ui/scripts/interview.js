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

/* 访谈作用域：未选择套件时读写「未分配桶」（与全局流程图同哲学：FDE 进场先记录，建套件后认领） */
const IV_UNASSIGNED = '_unassigned';
function ivScope() { return state.currentSuiteId || IV_UNASSIGNED; }
async function loadInterviewScope() {
  const list = await api('/api/suites/' + encodeURIComponent(ivScope()) + '/interviews');
  state.interviews = list || [];
  if (state.currentSuiteId) {
    // 选中套件时同时拉取未分配桶供「认领」分组展示；桶为空不视为错误
    try { state.unassignedInterviews = await api('/api/suites/' + IV_UNASSIGNED + '/interviews') || []; }
    catch { state.unassignedInterviews = []; }
  } else {
    state.unassignedInterviews = [];
  }
  return state.interviews;
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
    wrap.innerHTML = '<div class="empty-hint"><div><div class="big">🗂️</div>流程框架加载中或加载失败</div></div>';
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

/* 作用域相关 UI 同步：未分配桶模式下禁用需真实套件的动作，对象选择器降级为自由文本 */
function ivSyncScopeUI() {
  const noSuite = !state.currentSuiteId;
  const draft = $('#ivDraft'), exp = $('#ivExport');
  if (draft) { draft.disabled = noSuite; draft.title = noSuite ? '需先选择套件（桶内记录认领后再生成草稿）' : '把本套件全部访谈记录生成为一个独立画板草稿（角色/规则/参与关系自动预填）'; }
  if (exp) { exp.disabled = noSuite; exp.title = noSuite ? '需先选择套件' : '导出全部访谈记录为 Markdown 纪要（gap 项可辨识）'; }
  const nameInput = $('#ivEntityName'), entSel = $('#ivEntity');
  if (nameInput) nameInput.style.display = noSuite ? '' : 'none';
  if (entSel) entSel.style.display = noSuite ? 'none' : '';
}

function selectInterviewNode(code) {
  iv.selectedCode = code;
  const rec = ivRecordOf(code);
  iv.currentId = rec ? rec.id : null;
  renderInterviewForm();
  renderInterviewTree();
  renderIvRightList();
  ivLoadEvidence();
}

function renderInterviewForm() {
  const node = iv.selectedCode ? ivFindNode(iv.selectedCode) : null;
  const empty = $('#ivEmpty'), form = $('#ivForm');
  ivSyncScopeUI();
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
  const enInput = $('#ivEntityName');
  if (enInput) enInput.value = (obj && obj.value && obj.entityName) || '';
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
    entityName: ($('#ivEntityName') ? $('#ivEntityName').value.trim() : '') || undefined,
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
  } else if (!state.currentSuiteId) {
    el.className = 'iv-project';
    el.textContent = '📥 未分配桶模式：记录先存入桶中，认领进套件并绑定实体后才会投影参与关系。';
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
    const saved = await api(`/api/suites/${encodeURIComponent(ivScope())}/interviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ivCollectForm()),
    });
    const idx = state.interviews.findIndex(r => r.id === saved.id);
    if (idx >= 0) state.interviews[idx] = saved; else state.interviews.push(saved);
    iv.currentId = saved.id;
    renderInterviewForm();
    renderInterviewTree();
    renderIvRightList();
    ivLoadEvidence(true);
    const proj = saved.answers.hasObject?.value && saved.answers.hasObject.entityId && saved.answers.hasObject.op;
    toast(proj ? '已保存，参与关系已自动投影' : (state.currentSuiteId ? '已保存访谈记录' : '已保存到未分配桶（建套件后可认领）'), 'ok');
  } catch (err) {
    toast('保存失败：' + err.message, 'err');
  } finally { btn.disabled = false; }
});

$('#ivDelete') && $('#ivDelete').addEventListener('click', async () => {
  if (!iv.currentId) return;
  if (!confirm('确定删除该节点的访谈记录？投影关系将随之消失。')) return;
  try {
    await api(`/api/suites/${encodeURIComponent(ivScope())}/interviews/${encodeURIComponent(iv.currentId)}`, { method: 'DELETE' });
    state.interviews = state.interviews.filter(r => r.id !== iv.currentId);
    iv.currentId = null;
    renderInterviewForm();
    renderInterviewTree();
    renderIvRightList();
    ivLoadEvidence(true);
    toast('已删除访谈记录', 'ok');
  } catch (err) { toast('删除失败：' + err.message, 'err'); }
});

$('#ivGoFlow') && $('#ivGoFlow').addEventListener('click', () => {
  if (!iv.selectedCode) { toast('请先选择要访谈的节点', 'err'); return; }
  const code = iv.selectedCode;
  switchTab('flowchart');
  const mounted = flow.list.find(f => f.apqcCode === code && (f.suiteId === state.currentSuiteId || !f.suiteId));
  if (mounted) openFlowchart(mounted.id);
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

/* 认领：把桶内记录迁入当前套件（保留 apqcCode/answers/note；id 由服务端重新生成，派生关系读取时重算无悬挂引用） */
async function ivClaimRecords(recs) {
  if (!state.currentSuiteId || !recs.length) return;
  const allBtn = $('#ivClaimAll'); if (allBtn) allBtn.disabled = true;
  let ok = 0, fail = 0;
  for (const rec of recs) {
    try {
      await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/interviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apqcCode: rec.apqcCode, answers: rec.answers, note: rec.note }),
      });
      await api(`/api/suites/${IV_UNASSIGNED}/interviews/${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
      ok++;
    } catch { fail++; }
  }
  try { await loadInterviewScope(); } catch { /* 重拉失败不阻断 */ }
  renderInterviewTree();
  renderIvRightList();
  if (fail) toast(`认领完成：成功 ${ok} 条，失败 ${fail} 条`, ok === 0 ? 'err' : '');
  else toast(`已认领 ${ok} 条记录到当前套件`, 'ok');
}

function ivItemHtml(r, claimable) {
  const a = r.answers || {};
  const bits = [];
  if (a.hasRole?.value && a.hasRole.roleRef) bits.push(`👤 ${esc(a.hasRole.roleRef)}`);
  if (a.hasObject?.value && (a.hasObject.entityId || a.hasObject.entityName) && a.hasObject.op) {
    const ent = a.hasObject.entityId ? ivEntityById(a.hasObject.entityId) : null;
    bits.push(`📄 ${esc(ent ? ent.name : (a.hasObject.entityName || a.hasObject.entityId))} × ${IV_OP_SHORT[a.hasObject.op] || ''}`);
  }
  if (a.hasRule?.value && a.hasRule.ruleRef) bits.push(`📏 ${esc(a.hasRule.ruleRef)}`);
  else if (a.hasRule && !a.hasRule.value) bits.push('📏 客户未提');
  if (a.hasBehavior?.value && a.hasBehavior.behaviorRef) bits.push(`⚙️ ${esc(a.hasBehavior.behaviorRef)}`);
  const proj = !!(a.hasObject?.value && a.hasObject.entityId && a.hasObject.op);
  return `<div class="iv-item ${!claimable && r.apqcCode === iv.selectedCode ? 'selected' : ''}" data-code="${esc(r.apqcCode)}" ${claimable ? 'data-ua="1"' : ''}>
    <div class="ii-code">${esc(r.apqcCode)}</div>
    <div class="ii-name">${esc(ivNodeLabelOf(r.apqcCode))}</div>
    <div class="ii-sum">${bits.join('<br>') || '—'}</div>
    ${proj ? '<span class="ii-badge">⇒ 已自动投影</span>' : ''}
    ${claimable ? `<button class="ii-claim" data-iid="${esc(r.id)}" title="把这条记录认领进当前套件">⇩ 认领</button>` : ''}
    <button class="ii-del" data-iid="${esc(r.id)}" title="删除记录">✕</button>
  </div>`;
}

function renderIvRightList() {
  const box = $('#ivList');
  const list = state.interviews || [];
  $('#ivCount').textContent = list.length ? `${list.length} 条` : '';
  $('#cntInterviews').textContent = list.length || '';
  const ua = state.currentSuiteId ? (state.unassignedInterviews || []) : [];
  if (!list.length && !ua.length) {
    const hint = state.currentSuiteId
      ? '暂无访谈记录<br>从左侧选择 L3/L4 节点开始四问'
      : '未分配桶为空<br>从左侧选择 L3/L4 节点开始四问，记录将存入桶中';
    box.innerHTML = `<div class="empty-hint" style="height:160px"><div><div class="big">🎤</div>${hint}</div></div>`;
    return;
  }
  let html = list.map(r => ivItemHtml(r, false)).join('');
  if (ua.length) {
    html += `<div class="iv-ua-sep"><span>📥 未分配桶 · ${ua.length} 条（进场期记录）</span>
      <button class="btn" id="ivClaimAll" title="把桶内全部记录认领进当前套件">全部认领</button></div>`
      + ua.map(r => ivItemHtml(r, true)).join('');
  }
  box.innerHTML = html;
}

$('#ivList') && $('#ivList').addEventListener('click', async (e) => {
  // 认领（单条）
  const claim = e.target.closest('.ii-claim');
  if (claim) {
    const rec = (state.unassignedInterviews || []).find(r => r.id === claim.dataset.iid);
    if (rec) await ivClaimRecords([rec]);
    return;
  }
  // 全部认领
  if (e.target.closest('#ivClaimAll')) {
    await ivClaimRecords((state.unassignedInterviews || []).slice());
    return;
  }
  const del = e.target.closest('.ii-del');
  if (del) {
    const item = del.closest('.iv-item');
    const inBucket = !!(item && item.dataset.ua === '1');
    const src = inBucket ? (state.unassignedInterviews || []) : (state.interviews || []);
    const rec = src.find(r => r.id === del.dataset.iid);
    if (!rec) return;
    if (!confirm(`删除 ${rec.apqcCode} 的访谈记录？`)) return;
    try {
      const scope = inBucket ? IV_UNASSIGNED : ivScope();
      await api(`/api/suites/${encodeURIComponent(scope)}/interviews/${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
      if (inBucket) {
        state.unassignedInterviews = state.unassignedInterviews.filter(r => r.id !== rec.id);
      } else {
        state.interviews = state.interviews.filter(r => r.id !== rec.id);
        if (iv.currentId === rec.id) { iv.currentId = null; renderInterviewForm(); }
        renderInterviewTree();
      }
      renderIvRightList();
      toast('已删除访谈记录', 'ok');
    } catch (err) { toast('删除失败：' + err.message, 'err'); }
    return;
  }
  const item = e.target.closest('.iv-item');
  if (item && item.dataset.ua !== '1') selectInterviewNode(item.dataset.code);
});

/* ─────────── 右栏：证据板（流程图 + 本体同屏） ─────────── */
const ivEv = { code: null, flow: null, meta: null };

function ivL3Of(code) { return String(code || '').split('.').slice(0, 3).join('.'); }

function ivMountedFlow(code) {
  const list = (flow.list || []).filter(f => !f.suiteId || f.suiteId === state.currentSuiteId);
  return list.find(f => f.apqcCode === code)
    || (code !== ivL3Of(code) ? list.find(f => f.apqcCode === ivL3Of(code)) : null)
    || null;
}

function ivEvFlowSvg(data) {
  const nodes = data.nodes || [], edges = data.edges || [];
  if (!nodes.length) return '<div class="iv-ev-empty">画板为空</div>';
  /* 紧凑排版：按原画板的 x 坐标分列、列内按 y 排序，忽略绝对尺寸，
     这样在 300px 窄栏里节点文字仍然可读（直接缩放眼图会缩成不可读的小字） */
  const cols = [];
  nodes.slice().sort((a, b) => a.x - b.x).forEach(n => {
    const last = cols[cols.length - 1];
    if (!last || n.x - last.x0 > 60) { const c = [n]; c.x0 = n.x; cols.push(c); }
    else last.push(n);
  });
  cols.forEach(c => c.sort((a, b) => a.y - b.y));
  const W = 300, GAP = 14;
  const NW = Math.min(104, Math.floor((W - 16 - (cols.length - 1) * GAP) / Math.max(cols.length, 1)));
  const NH = 26;
  const rows = Math.max(...cols.map(c => c.length), 1);
  const H = rows * (NH + 8) + 12;
  const totalW = cols.length * NW + (cols.length - 1) * GAP;
  const startX = Math.max(8, (W - totalW) / 2);
  const pos = new Map();
  cols.forEach((col, ci) => {
    const x = startX + ci * (NW + GAP);
    const y0 = (H - (col.length * (NH + 8) - 8)) / 2;
    col.forEach((n, ri) => pos.set(n.id, { x, y: y0 + ri * (NH + 8) }));
  });
  const acts = (data.semantics && data.semantics.activities) || {};
  const parts = (data.semantics && data.semantics.participations) || [];
  const filled = (id) => {
    const a = acts[id];
    if (a && (a.roleRef || (a.behaviorRefs || []).length || (a.guardRules || []).length)) return true;
    return parts.some(p => p.nodeId === id);
  };
  const edgeSvg = edges.map(ed => {
    const a = pos.get(ed.from), b = pos.get(ed.to);
    if (!a || !b) return '';
    return `<line x1="${a.x + NW / 2}" y1="${a.y + NH / 2}" x2="${b.x + NW / 2}" y2="${b.y + NH / 2}" stroke="#c9c2b4" stroke-width="1" marker-end="url(#ivEvArrow)"/>`;
  }).join('');
  const maxChars = Math.max(3, Math.floor((NW - 8) / 9));
  const nodeSvg = nodes.map(n => {
    const p = pos.get(n.id), on = filled(n.id);
    const label = (n.name || n.label || '').slice(0, maxChars);
    const stroke = on ? '#c9873a' : '#c9c2b4';
    const fill = on ? 'rgba(201,135,58,.14)' : '#fff';
    const cx = p.x + NW / 2, cy = p.y + NH / 2;
    const shape = n.type === 'decision'
      ? `<polygon points="${cx},${p.y} ${p.x + NW},${cy} ${cx},${p.y + NH} ${p.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
      : `<rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.2" ${on ? '' : 'stroke-dasharray="3 3"'}/>`;
    return `<g class="iv-onto-node" data-fnode="${esc(n.id)}">${shape}<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" fill="#4b5563">${esc(label)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <defs><marker id="ivEvArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c9c2b4"/></marker></defs>
    ${edgeSvg}${nodeSvg}</svg>`;
}

function ivEvOntoIds() {
  const ids = new Set();
  const byName = (name) => (state.suite ? state.suite.entities.find(e => e.name === name) : null);
  if ($('#ivEntity').value) ids.add($('#ivEntity').value);
  [['#ivRole'], ['#ivRule'], ['#ivBehavior']].forEach(([sel]) => {
    const v = ($(sel).value || '').trim();
    if (!v) return;
    const e = byName(v);
    if (e) ids.add(e.id);
  });
  if (ivEv.flow) (ivEv.flow.semantics?.participations || []).forEach(p => ids.add(p.entityId));
  const all = state.suite ? state.suite.entities : [];
  return [...ids].filter(id => all.some(e => e.id === id)).slice(0, 9);
}

function ivEvOntoSvg(ids) {
  const ents = ids.map(id => state.suite.entities.find(e => e.id === id)).filter(Boolean);
  const W = 300, H = 152, cx = W / 2, cy = H / 2;
  const pos = new Map();
  const n = ents.length;
  ents.forEach((e, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
    const r = n <= 1 ? 0 : (n <= 4 ? 40 : 54);
    pos.set(e.id, { x: cx + Math.cos(ang) * r * 1.5, y: cy + Math.sin(ang) * r });
  });
  const rels = (state.suite.relations || []).filter(r => pos.has(r.from) && pos.has(r.to));
  const lines = rels.map(r => {
    const a = pos.get(r.from), b = pos.get(r.to);
    return `<path d="M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 12} ${b.x} ${b.y}" fill="none" stroke="#c9c2b4" stroke-width="1"/>`;
  }).join('');
  const circles = ents.map(e => {
    const p = pos.get(e.id);
    const color = (typeof KIND_COLORS !== 'undefined' && KIND_COLORS[e.kind]) || '#9ca3af';
    return `<g class="iv-onto-node" data-eid="${esc(e.id)}">
      <circle cx="${p.x}" cy="${p.y}" r="11" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="1.4"/>
      <text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="7.5" fill="#374151">${esc((e.name || '').slice(0, 2))}</text>
      <text x="${p.x}" y="${p.y + 22}" text-anchor="middle" font-size="7" fill="#6b7280">${esc((e.name || '').slice(0, 7))}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${lines}${circles}</svg>`;
}

function ivRenderEvidence() {
  if (!$('#ivEvidence')) return;
  const flowBox = $('#ivEvFlow'), ontoBox = $('#ivEvOnto');
  const code = iv.selectedCode, meta = ivEv.meta;

  $('#ivEvFlowMeta').textContent = meta ? meta.name : (code ? '未挂载' : '—');
  if (!code) {
    flowBox.innerHTML = '<div class="iv-ev-empty">从左栏选择 L3/L4 节点<br>这里同时显示该流程的画板与本体</div>';
    $('#ivEvFlowNote').textContent = '';
  } else if (!meta) {
    flowBox.innerHTML = `<div class="iv-ev-empty">${esc(ivL3Of(code))} 还没有挂载画板<button class="btn" id="ivEvGoFlow">去画板补画</button></div>`;
    $('#ivEvFlowNote').textContent = '访谈记录仍会投影为参与关系，只是暂时没有图形。';
  } else if (!ivEv.flow) {
    flowBox.innerHTML = '<div class="iv-ev-empty">加载画板…</div>';
    $('#ivEvFlowNote').textContent = '';
  } else {
    const f = ivEv.flow;
    flowBox.innerHTML = ivEvFlowSvg(f);
    const nodeN = (f.nodes || []).length, partN = (f.semantics?.participations || []).length;
    $('#ivEvFlowNote').innerHTML = `<b>${esc(meta.name)}</b> · ${nodeN} 节点 · ${partN} 条参与关系`
      + (meta.apqcCode !== code ? `（挂在 ${esc(meta.apqcCode)}）` : '');
  }

  const ids = state.suite ? ivEvOntoIds() : [];
  const relN = state.suite
    ? (state.suite.relations || []).filter(r => ids.includes(r.from) && ids.includes(r.to)).length
    : 0;
  $('#ivEvOntoMeta').textContent = ids.length ? `${ids.length} 个实体` : '—';
  if (!state.suite) ontoBox.innerHTML = '<div class="iv-ev-empty">未加载套件</div>';
  else if (!ids.length) ontoBox.innerHTML = '<div class="iv-ev-empty">还没有引用本体对象<br>填第②问或画板锚定后会亮起</div>';
  else ontoBox.innerHTML = ivEvOntoSvg(ids);

  const missing = [];
  if (!$('#ivHasRole').checked) missing.push('角色');
  if (!$('#ivHasObject').checked) missing.push('对象');
  if (!$('#ivHasRule').checked) missing.push('规则');
  if (!$('#ivHasBehavior').checked) missing.push('行为');
  $('#ivEvNote').innerHTML = state.suite
    ? `已引用 <b>${ids.length}</b> 个实体 · 关系 <b>${relN}</b> 条 · ${missing.length ? '未答：' + missing.join('/') : '四问已齐'}`
    : '';
}

async function ivLoadEvidence(force) {
  const code = iv.selectedCode;
  ivEv.code = code;
  if (!code) { ivEv.flow = null; ivEv.meta = null; ivRenderEvidence(); return; }
  const meta = ivMountedFlow(code);
  ivEv.meta = meta;
  if (!meta) { ivEv.flow = null; ivRenderEvidence(); return; }
  if (!force && ivEv.flow && ivEv.flow.id === meta.id) { ivRenderEvidence(); return; }
  ivEv.flow = null;
  ivRenderEvidence();
  try {
    const data = await api('/api/flowcharts/' + encodeURIComponent(meta.id));
    if (ivEv.code !== code) return;
    ivEv.flow = data;
  } catch (err) { ivEv.flow = null; }
  ivRenderEvidence();
}

let ivEvTimer = null;
function ivEvRefreshSoon() {
  clearTimeout(ivEvTimer);
  ivEvTimer = setTimeout(ivRenderEvidence, 200);
}

$('#ivSideSeg') && $('#ivSideSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-side]');
  if (!btn) return;
  [...$('#ivSideSeg').children].forEach(x => x.classList.toggle('on', x === btn));
  const ev = btn.dataset.side === 'evidence';
  $('#ivEvidence').style.display = ev ? '' : 'none';
  $('#ivList').style.display = ev ? 'none' : '';
});

$('#ivForm') && $('#ivForm').addEventListener('input', ivEvRefreshSoon);
$('#ivForm') && $('#ivForm').addEventListener('change', ivEvRefreshSoon);

$('#ivEvFlow') && $('#ivEvFlow').addEventListener('click', (e) => {
  if (e.target.closest('#ivEvGoFlow')) { $('#ivGoFlow').click(); return; }
  const g = e.target.closest('[data-fnode]');
  if (!g || !ivEv.flow) return;
  const id = g.dataset.fnode;
  const f = ivEv.flow;
  const n = (f.nodes || []).find(x => x.id === id);
  const a = (f.semantics?.activities || {})[id] || {};
  const objs = (f.semantics?.participations || []).filter(p => p.nodeId === id).map(p => {
    const en = state.suite ? state.suite.entities.find(x => x.id === p.entityId) : null;
    return en ? `${en.name}·${String(p.op || '').toUpperCase()}` : p.entityId;
  });
  $('#ivEvFlowNote').innerHTML = `选中 <b>${esc((n && n.name) || id)}</b>：角色 ${esc(a.roleRef || '—')}；规则 ${esc((a.guardRules || []).join('、') || '—')}；行为 ${esc((a.behaviorRefs || []).join('、') || '—')}`
    + (objs.length ? `；对象 ${esc(objs.join('、'))}` : '');
});

$('#ivEvOnto') && $('#ivEvOnto').addEventListener('click', (e) => {
  const g = e.target.closest('[data-eid]');
  if (!g || !state.suite) return;
  const ent = state.suite.entities.find(x => x.id === g.dataset.eid);
  if (!ent) return;
  const relN = (state.suite.relations || []).filter(r => r.from === ent.id || r.to === ent.id).length;
  $('#ivEvNote').innerHTML = `<b>${esc(ent.name)}</b> · ${esc(ent.kind)} · ${esc(ent.domain || '—')} · 关系 ${relN}`;
  // 直接开实体抽屉：与套件列表、流程地图的行为保持一致，且能顺手看框架路径 / 定位到流程地图
  openDrawer(ent.id);
});

/* ─────────── Tab 入口（switchTab 调用） ─────────── */
function renderInterviewTab() {
  renderIvEntitySelect();
  renderIvDatalists();
  renderInterviewTree();
  renderIvRightList();
  renderInterviewForm();
  if (!(flow.list && flow.list.length) && typeof refreshFlowList === 'function') {
    Promise.resolve(refreshFlowList()).then(() => ivLoadEvidence()).catch(() => ivLoadEvidence());
  } else {
    ivLoadEvidence();
  }
}
