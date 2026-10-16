/* ═════════════════════════ Tab1 本体管理：套件列表 + 实体列表 ═════════════════════════ */
const NEW_FW_LS_KEY = 'dsh-new-suite-fw';

function populateFwNewSelect() {
  const sel = $('#fwNewSelect');
  if (!sel) return;
  const saved = localStorage.getItem(NEW_FW_LS_KEY) || 'hw-style-pcf';
  sel.innerHTML = FW_LIST.map(f =>
    `<option value="${esc(f.frameworkId)}">${esc(f.name)}（${esc(f.frameworkId)}）</option>`).join('');
  sel.value = FW_LIST.some(f => f.frameworkId === saved) ? saved : (FW_LIST[0]?.frameworkId || '');
}

async function loadSuites() {
  state.suites = await api('/api/suites');
  populateFwNewSelect();
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
        框架：<b>${esc(fwNameOf(s.frameworkId))}</b> · 领域：<b>${esc(s.domain || '—')}</b><br>
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
    // 先取套件 meta 解析锁定框架，再并行拉取框架相关数据
    const suite = await api('/api/suites/' + encodeURIComponent(suiteId));
    const fwId = suiteFw(suite);
    // 下拉框同步显示当前套件锁定的框架
    const fwSel = $('#fwNewSelect');
    if (fwSel && FW_LIST.some(f => f.frameworkId === fwId)) fwSel.value = fwId;
    const [coverage, framework, dictionary, interviews] = await Promise.all([
      api('/api/coverage?suite=' + encodeURIComponent(suiteId) + '&framework=' + fwId),
      api('/api/frameworks/' + fwId),
      api('/api/dictionary?framework=' + fwId),
      api('/api/suites/' + encodeURIComponent(suiteId) + '/interviews'),
    ]);
    state.currentSuiteId = suiteId;
    state.suite = suite;
    state.frameworkId = fwId;
    state.coverage = coverage;
    state.framework = framework;
    state.dictionary = dictionary;
    state.interviews = interviews || [];
    iv.selectedCode = null; iv.currentId = null;
    iv.treeExpanded = new Set(); iv.treeQuery = ''; iv.seeded = false;
    $('#ivTreeSearch').value = '';
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
    const fwSel = $('#fwNewSelect');
    const result = await api('/api/suites/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true, framework: fwSel ? fwSel.value : undefined }),
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

/* ─────────── 流程框架切换 + 自定义框架导入（P4-3） ─────────── */
$('#fwNewSelect') && $('#fwNewSelect').addEventListener('change', async (e) => {
  const fwId = e.target.value;
  if (!fwId) return;
  const curFw = state.suite ? suiteFw(state.suite) : null;
  // 无当前套件（或框架未变化）：仅记录为新套件缺省框架（重新导入时使用）
  if (!state.currentSuiteId || !state.suite || curFw === fwId) {
    localStorage.setItem(NEW_FW_LS_KEY, fwId);
    return;
  }
  // 有当前套件：确认后切换套件锁定框架并重载（流程地图/覆盖度/域词典按新框架重建）
  const fwName = fwNameOf(fwId);
  if (!confirm(`将当前套件的流程框架切换为「${fwName}」？\n切换后流程地图与覆盖度按新框架展示；旧框架下的实体映射保留但不再参与统计，需按新框架重新锚定。`)) {
    e.target.value = curFw;
    return;
  }
  try {
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/framework', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frameworkId: fwId }),
    });
    localStorage.setItem(NEW_FW_LS_KEY, fwId);   // 同时作为重新导入时新套件的缺省框架
    toast(`流程框架已切换为「${fwName}」`, 'ok');
    await selectSuiteForce(state.currentSuiteId);
  } catch (err) {
    toast('切换框架失败：' + err.message, 'err');
    e.target.value = curFw;   // 失败回退显示
  }
});

$('#btnImportFw') && $('#btnImportFw').addEventListener('click', () => $('#fwFileInput').click());

$('#fwFileInput') && $('#fwFileInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';                       // 允许重复选择同一文件
  if (!file) return;
  let fw;
  try { fw = JSON.parse(await file.text()); } catch (err) { toast('不是合法的 JSON 文件：' + err.message, 'err'); return; }
  const btn = $('#btnImportFw');
  btn.disabled = true; btn.textContent = '⏳ 校验中…';
  try {
    const res = await fetch('/api/frameworks/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: fw }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) {
      const errs = (json && json.errors) || [];
      console.warn('[dsh-ontology] framework import failed:', errs);
      toast((json && json.message || '框架导入失败') + (errs.length ? '：' + errs[0] + (errs.length > 1 ? ` 等 ${errs.length} 条` : '') : ''), 'err');
      return;
    }
    const d = json.data;
    toast(`框架「${d.name}」已导入：${d.domains} 个 L1 / ${d.nodes} 节点 / 最大 ${d.maxDepth} 层`, 'ok');
    FW_LIST = await api('/api/frameworks?light=1');   // 免刷新下拉与框架名映射
    populateFwNewSelect();
  } catch (err) {
    toast('框架导入失败：' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🗂 导入框架';
  }
});

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
      <button class="btn" id="btnBatchImport" title="粘贴客户单据清单批量入库">📋 批量导入</button>
      <button class="btn" id="btnExportPkg" title="导出套件现场数据包（.dshont.json：实体+标注+访谈+流程图）">📤 导出数据包</button>
      <button class="btn" id="btnImportPkg" title="导入现场数据包（按套件 ID 整体覆盖本地同名套件）">📥 导入数据包</button>
      <span class="count">${list.length} / ${state.suite.entities.length} 个实体 · 每页 ${PAGE_SIZE} 条 · 点击行打开标注抽屉</span>
    </div>
    <table class="ent-table">
      <thead><tr><th>序号</th><th>名称 / ID</th><th>Kind</th><th>框架编号</th><th>覆盖状态</th></tr></thead>
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
  $('#btnBatchImport').addEventListener('click', renderBatchImport);
  $('#btnExportPkg').addEventListener('click', downloadPackage);
  $('#btnImportPkg').addEventListener('click', importPackageFromFile);
}

/* ─────────── 现场数据包（P5-4 .dshont.json） ─────────── */
async function downloadPackage() {
  if (!state.currentSuiteId) { toast('请先选择套件', 'err'); return; }
  try {
    const res = await fetch('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/package');
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const name = state.currentSuiteId.replace(/[^\w.-]/g, '_') + '.dshont.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出现场数据包：' + name, 'ok');
  } catch (err) {
    toast('数据包导出失败：' + err.message, 'err');
  }
}

function importPackageFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    let pkg;
    try { pkg = JSON.parse(await file.text()); } catch (err) { toast('不是合法的 JSON 文件：' + err.message, 'err'); return; }
    const sid = pkg && pkg.suite && pkg.suite.meta && pkg.suite.meta.suiteId;
    if (!sid) { toast('不是合法的现场数据包（缺少 suite.meta.suiteId）', 'err'); return; }
    if (!confirm(`将用数据包整体覆盖本地套件「${sid}」（实体/标注/访谈/流程图全部替换），确定继续？`)) return;
    try {
      const r = await api('/api/suites/import-package', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: pkg }),
      });
      toast(`数据包已导入：${r.suiteId}（实体 ${r.entities} · 访谈 ${r.interviews} · 流程图 ${r.flowcharts}）`, 'ok');
      await loadSuites();
      await selectSuiteForce(r.suiteId);
    } catch (err) {
      toast('数据包导入失败：' + err.message, 'err');
    }
  };
  inp.click();
}

$('#entityPane').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-eid]');
  if (tr) openDrawer(tr.dataset.eid);
});

/* ─────────── 批量导入（P5-1 表证单书清单） ─────────── */
let batchItems = null;   // 解析预览结果
let batchText = '';

/* 名称命中域词典 → 建议 L1/L2 编号（最长匹配优先） */
function batchDictSuggest(name) {
  const entries = (state.dictionary && state.dictionary.entries) || [];
  let best = null;
  for (const e of entries) {
    const cands = [e.label, ...(e.aliases || [])];
    for (const c of cands) {
      if (c && c.length >= 2 && (name.includes(c) || c.includes(name))) {
        if (!best || c.length > best.matchLen) best = { entry: e, matchLen: c.length };
      }
    }
  }
  return best ? best.entry : null;
}

function batchParseText(text) {
  const existing = new Set((state.suite ? state.suite.entities : []).map(e => e.name));
  const seen = new Set();
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,，\t]/).map(s => s.trim());
    const name = parts[0] || '';
    const kind = parts[1] || '';
    const domain = parts[2] || '';
    let status = 'ok';
    if (!name) status = 'empty';
    else if (seen.has(name)) status = 'dup-in-list';
    else if (existing.has(name)) status = 'exists';
    if (name) seen.add(name);
    rows.push({ name, kind, domain, sug: name ? batchDictSuggest(name) : null, status });
  }
  return rows;
}

const BATCH_ST_LABEL = {
  ok: '<span class="badge st-covered">可导入</span>',
  'dup-in-list': '<span class="badge st-unset">清单内重复</span>',
  exists: '<span class="badge st-partial">已存在，跳过</span>',
  empty: '<span class="badge st-gap">空名称</span>',
};

function renderBatchImport() {
  const pane = $('#entityPane');
  pane.innerHTML = `
    <div class="ent-toolbar"><b>📋 批量导入表证单书</b>
      <span class="count">每行一条：名称[,类型][,域编号] · 类型缺省 ENTITY · 支持中英文逗号 / Tab 分隔</span>
      <span style="flex:1"></span>
      <button class="btn" id="biBack">‹ 返回列表</button>
    </div>
    <textarea id="biText" rows="10" class="bi-textarea" placeholder="销售订单
销售订单,AGGREGATE_ROOT
采购入库单,,4.3
质检报告,REPORT,6.0"></textarea>
    <div class="bi-actions">
      <button class="btn primary" id="biPreview">🔍 解析预览</button>
      <label class="bi-anchor"><input type="checkbox" id="biAnchor" checked> 命中域词典时自动锚定到 L1/L2 节点</label>
      <span style="flex:1"></span>
      <button class="btn primary" id="biSubmit" disabled>✔ 确认导入</button>
    </div>
    <div id="biPreviewBox"></div>`;
  $('#biBack').addEventListener('click', () => { batchItems = null; renderEntities(); });
  $('#biText').addEventListener('input', (e) => { batchText = e.target.value; });
  $('#biPreview').addEventListener('click', () => {
    batchText = $('#biText').value;
    batchItems = batchParseText(batchText);
    const ok = batchItems.filter(r => r.status === 'ok');
    $('#biSubmit').disabled = !ok.length;
    $('#biPreviewBox').innerHTML = batchItems.length ? `
      <div class="count" style="margin:8px 0">共 ${batchItems.length} 行 · 可导入 <b>${ok.length}</b> · 跳过 ${batchItems.length - ok.length}</div>
      <table class="ent-table"><thead><tr><th>#</th><th>名称</th><th>类型</th><th>域编号</th><th>词典建议</th><th>状态</th></tr></thead>
      <tbody>${batchItems.slice(0, 300).map((r, i) => `
        <tr>
          <td class="idx">${i + 1}</td>
          <td>${esc(r.name) || '—'}</td>
          <td>${esc(r.kind || 'ENTITY')}</td>
          <td>${esc(r.domain || (r.status === 'ok' && r.sug ? r.sug.code : ''))}</td>
          <td>${r.sug ? `${esc(r.sug.code)} ${esc(r.sug.label)}` : '<span style="color:var(--text-dim)">未命中</span>'}</td>
          <td>${BATCH_ST_LABEL[r.status] || esc(r.status)}</td>
        </tr>`).join('')}</tbody></table>
      ${batchItems.length > 300 ? `<div class="count">…其余 ${batchItems.length - 300} 行略</div>` : ''}`
      : '<div class="count" style="margin:8px 0">未解析到有效行</div>';
  });
  $('#biSubmit').addEventListener('click', submitBatchImport);
}

async function submitBatchImport() {
  if (!batchItems || !state.currentSuiteId) return;
  const anchor = $('#biAnchor').checked;
  const items = batchItems.filter(r => r.status === 'ok').map(r => {
    const domain = r.domain || r.sug?.code || '';
    return { name: r.name, kind: r.kind || 'ENTITY', domain, anchor: anchor && !!domain };
  });
  const btn = $('#biSubmit');
  btn.disabled = true; btn.textContent = '⏳ 导入中…';
  try {
    const res = await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/entities/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const skipTxt = res.skipped?.length ? `，跳过 ${res.skipped.length}（${res.skipped.slice(0, 3).map(s => s.reason).join('、')}${res.skipped.length > 3 ? '…' : ''}）` : '';
    toast(`批量导入完成：新建 ${res.created} 个实体${res.anchored ? `，自动锚定 ${res.anchored} 个` : ''}${skipTxt}`, 'ok');
    batchItems = null;
    await loadSuites();
    await selectSuiteForce(state.currentSuiteId);
    switchTab('suites');
  } catch (err) {
    toast('批量导入失败：' + err.message, 'err');
    btn.disabled = false; btn.textContent = '✔ 确认导入';
  }
}
