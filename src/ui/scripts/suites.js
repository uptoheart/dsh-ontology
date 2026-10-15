/* ═════════════════════════ Tab1 本体管理：套件列表 + 实体列表 ═════════════════════════ */
async function loadSuites() {
  state.suites = await api('/api/suites');
  const sel = $('#suiteSelect');
  sel.innerHTML = state.suites.length
    ? state.suites.map(s => `<option value="${esc(s.suiteId)}">${esc(s.suiteId)} · ${esc(s.domain || '')}</option>`).join('')
    : '<option value="">— 暂无套件，请先「重新导入」 —</option>';
  if (state.currentSuiteId && state.suites.some(s => s.suiteId === state.currentSuiteId)) sel.value = state.currentSuiteId;
  $('#cntSuites').textContent = state.suites.length;
  $('#suiteExtra').textContent = state.suites.length ? `${state.suites.length} 个` : '';
  renderSuites();
}

function renderSuites() {
  const box = $('#suiteList');
  if (!state.suites.length) {
    box.innerHTML = `<div class="empty-hint" style="height:200px"><div><div class="big">📦</div>暂无已导入套件<br>点击右上角「📦 重新导入」从 datasource 解析数据</div></div>`;
    return;
  }
  box.innerHTML = state.suites.map(s => `
    <div class="suite-item ${s.suiteId === state.currentSuiteId ? 'selected' : ''}" data-sid="${esc(s.suiteId)}">
      <div class="si-name">${s.suiteId === state.currentSuiteId ? '<span class="check">✓</span>' : ''}${esc(s.suiteId)}</div>
      <div class="si-meta">
        领域：<b>${esc(s.domain || '—')}</b><br>
        <b>${s.entityCount ?? 0}</b> 实体 · <b>${s.relationCount ?? 0}</b> 关系 · 导入于 ${esc(fmtTime(s.importTime))}
      </div>
    </div>`).join('');
}

$('#suiteList').addEventListener('click', (e) => {
  const item = e.target.closest('.suite-item');
  if (item) selectSuite(item.dataset.sid);
});

$('#suiteSelect').addEventListener('change', (e) => selectSuite(e.target.value));

async function selectSuite(suiteId) {
  if (!suiteId || suiteId === state.currentSuiteId) { if (suiteId) { $('#suiteSelect').value = suiteId; } return; }
  state.loading = true;
  try {
    const [suite, coverage, framework] = await Promise.all([
      api('/api/suites/' + encodeURIComponent(suiteId)),
      api('/api/coverage?suite=' + encodeURIComponent(suiteId) + '&framework=' + DEFAULT_FW),
      api('/api/frameworks/' + DEFAULT_FW),
    ]);
    state.currentSuiteId = suiteId;
    state.suite = suite;
    state.coverage = coverage;
    state.framework = framework;
    state.flatFw = flattenFramework(framework);
    state.entityFilter = { kind: '', keyword: '' };
    state.entityPage = 1;
    state.treeQuery = '';
    state.selectedNode = null;
    state.expanded = new Set();
    $('#treeSearch').value = '';
    $('#suiteSelect').value = suiteId;
    $('#cntEntities').textContent = suite.entities.length;
    updateTabLock();
    renderAll();
    toast(`已选择套件 ${suiteId}（${suite.entities.length} 实体）`, 'ok');
  } catch (err) {
    toast('加载套件失败：' + err.message, 'err');
  } finally {
    state.loading = false;
  }
}

async function refreshAll() {
  try {
    await loadSuites();
    if (state.currentSuiteId) {
      await selectSuiteForce(state.currentSuiteId);
    }
    toast('已刷新', 'ok');
  } catch (err) { toast('刷新失败：' + err.message, 'err'); }
}

async function selectSuiteForce(suiteId) {
  state.currentSuiteId = null;           // 强制重新加载
  await selectSuite(suiteId);
}

async function reimport() {
  const btn = $('#btnReimport');
  btn.disabled = true; btn.textContent = '⏳ 导入中…';
  try {
    const result = await api('/api/suites/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    const parts = [];
    if (result.updated?.length) parts.push('更新 ' + result.updated.join(', '));
    if (result.skipped?.length) parts.push('跳过 ' + result.skipped.length + ' 个');
    toast('重新导入完成：' + (parts.join('；') || '无变更'), 'ok');
    await loadSuites();
    if (state.currentSuiteId) await selectSuiteForce(state.currentSuiteId);
  } catch (err) {
    toast('导入失败：' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '📦 重新导入';
  }
}

$('#btnRefresh').addEventListener('click', refreshAll);
$('#btnReimport').addEventListener('click', reimport);

/* ─────────── 右侧：实体列表 ─────────── */
function buildKindOptions() {
  const sel = $('#kindSelect');
  if (!sel) return;
  const kinds = Array.from(new Set((state.suite ? state.suite.entities : []).map(e => e.kind))).sort();
  sel.innerHTML = `<option value="">全部类型</option>` + kinds.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
  sel.value = state.entityFilter.kind;
}

function filteredEntities() {
  if (!state.suite) return [];
  let list = state.suite.entities;
  if (state.entityFilter.kind) list = list.filter(e => e.kind === state.entityFilter.kind);
  const kw = state.entityFilter.keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter(e =>
      e.name.toLowerCase().includes(kw)
      || e.rawId.toLowerCase().includes(kw)
      || (e.domain || '').toLowerCase().includes(kw));
  }
  return list;
}

function renderEntities() {
  const pane = $('#entityPane');
  if (!state.suite) {
    pane.innerHTML = '<div class="empty-hint"><div><div class="big">📦</div>请在左侧选择一个套件</div></div>';
    return;
  }
  const list = filteredEntities();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.entityPage > pages) state.entityPage = pages;
  const start = (state.entityPage - 1) * PAGE_SIZE;
  const pageList = list.slice(start, start + PAGE_SIZE);

  const rows = pageList.map((e, i) => {
    const apqc = entityApqc(e.id);
    const st = entityStatus(e.id);
    return `<tr data-eid="${esc(e.id)}">
      <td class="idx">${start + i + 1}</td>
      <td><div class="e-name">${esc(e.name)}</div><div class="e-id">${esc(e.rawId)}</div></td>
      <td><span class="kind-tag">${esc(e.kind)}</span></td>
      <td class="apqc-cell ${apqc ? '' : 'none'}">${apqc ? esc(apqc) : '—'}</td>
      <td><span class="badge st-${st}">${STATUS_LABEL[st]}</span></td>
    </tr>`;
  }).join('');

  pane.innerHTML = `
    <div class="ent-toolbar">
      <select id="kindSelect"></select>
      <input type="text" id="kwInput" placeholder="🔍 搜索名称 / ID / 领域…" value="${esc(state.entityFilter.keyword)}">
      <span class="count">${list.length} / ${state.suite.entities.length} 个实体 · 每页 ${PAGE_SIZE} 条 · 点击行打开标注抽屉</span>
    </div>
    <table class="ent-table">
      <thead><tr><th>序号</th><th>名称 / ID</th><th>Kind</th><th>APQC 编号</th><th>覆盖状态</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px">无匹配实体</td></tr>'}</tbody>
    </table>
    ${pages > 1 ? `<div class="pager">
      <button class="btn" id="pgPrev" ${state.entityPage <= 1 ? 'disabled' : ''}>‹ 上一页</button>
      <span>第 ${state.entityPage} / ${pages} 页</span>
      <button class="btn" id="pgNext" ${state.entityPage >= pages ? 'disabled' : ''}>下一页 ›</button>
    </div>` : ''}`;

  buildKindOptions();
  const kw = $('#kwInput');
  let kwTimer = null;
  kw.addEventListener('input', () => {
    clearTimeout(kwTimer);
    kwTimer = setTimeout(() => {
      state.entityFilter.keyword = kw.value;
      state.entityPage = 1;
      renderEntities();
      const el = $('#kwInput'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    }, 250);
  });
  $('#kindSelect').addEventListener('change', (e) => {
    state.entityFilter.kind = e.target.value;
    state.entityPage = 1;
    renderEntities();
  });
  const prev = $('#pgPrev'), next = $('#pgNext');
  if (prev) prev.addEventListener('click', () => { state.entityPage--; renderEntities(); });
  if (next) next.addEventListener('click', () => { state.entityPage++; renderEntities(); });
}

$('#entityPane').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-eid]');
  if (tr) openDrawer(tr.dataset.eid);
});
