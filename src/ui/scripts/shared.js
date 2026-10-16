/* ═════════════════════════ 工具（全局共享） ═════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
const fmtTime = (ts) => { try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }); } catch { return '—'; } };

const STATUS_LABEL = { covered: '已覆盖', partial: '部分', gap: '缺口', unset: '未标注' };
const PAGE_SIZE = 300;
const DEFAULT_FW = 'apqc-process';

let toastTimer = null;
function toast(msg, type) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.error)) || (res.status + ' ' + res.statusText));
  }
  return json ? json.data : null;
}

/* 与后端 deriveOntologyCode 一致：ONT-{L1}-{L2}-{L3}，不足 3 段补 0 */
function deriveOntologyCodeLocal(apqcCode) {
  const parts = apqcCode.split('.').map(s => s.trim()).filter(Boolean);
  if (!parts.length || !parts.every(p => /^\d+$/.test(p))) return null;
  while (parts.length < 3) parts.push('0');
  return 'ONT-' + parts.slice(0, 3).join('-');
}

/* ═══════════ APQC 映射按 kind 分流（与后端 DOMAIN_KINDS/PROCESS_KINDS 一致） ═══════════ */
const DOMAIN_KINDS = new Set(['AGGREGATE_ROOT', 'ENTITY', 'DATA_DICTIONARY', 'RULE', 'ACTOR', 'ROLE', 'REPORT']);
const PROCESS_KINDS = new Set(['FLOW', 'ACTIVITY']);

/* kind 轴向：'domain'=名词层只允许 L1/L2；'process'=动词层只允许 L3-L5；null=不参与映射 */
function kindAxis(kind) {
  if (DOMAIN_KINDS.has(kind)) return 'domain';
  if (PROCESS_KINDS.has(kind)) return 'process';
  return null;
}

function levelNumOfCode(code) {
  return String(code || '').split('.').map(s => s.trim()).filter(Boolean).length;
}

/* 校验 kind 是否允许映射到该 APQC 编号 */
function checkMappingAllowed(kind, code) {
  const axis = kindAxis(kind);
  if (!axis) return { ok: false, msg: `${kind} 类型暂不参与 APQC 映射` };
  const lvl = levelNumOfCode(code);
  if (axis === 'domain' && lvl > 2) return { ok: false, msg: '该实体类型仅允许映射到 L1/L2（L3+ 属流程轴，由流程与参与关系推导）' };
  if (axis === 'process' && lvl < 3) return { ok: false, msg: '该流程类型仅允许映射到 L3-L5（L1/L2 属域轴）' };
  return { ok: true };
}

/* 域词典查询：code → 词条 */
function dictEntryFor(code) {
  if (!state.dictionary || !code) return null;
  return (state.dictionary.entries || []).find(e => e.code === code) || null;
}

/* ═════════════════════════ 状态 ═════════════════════════ */
const state = {
  suites: [],
  currentSuiteId: null,
  suite: null,          // SuiteData {entities, relations, meta, annotations}
  framework: null,      // FrameworkDefinition
  coverage: null,       // CoverageMatrix
  dictionary: null,     // DomainDictionary（受控词表，只读）
  interviews: [],       // InterviewRecord[]（当前套件访谈记录）
  flatFw: [],           // 框架扁平索引（含 definition / path）
  entityFilter: { kind: '', keyword: '' },
  entityPage: 1,
  treeQuery: '',
  selectedNode: null,   // CoverageNodeInfo（含 _path）
  expanded: new Set(),  // 展开的节点 code
  drawer: null,         // {entityId, apqc, status, note}
  loading: false,
};

/* 实体标注快捷读取（套件页表格 + 本体详情共用） */
function entityApqc(eid) {
  const m = state.suite.annotations.entityFrameMapping[eid];
  return m && m.apqcCode ? m.apqcCode : null;
}
function entityStatus(eid) {
  const m = state.suite.annotations.coverageMarks[eid];
  return (m && m.status) || 'unset';
}

/* ═════════════════════════ Tab 切换 ═════════════════════════ */
function switchTab(name) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'framework') renderTree();
  if (name === 'flowchart') { renderFlowTree(); renderMountSelect(); refreshFlowList(); }
  if (name === 'interview') renderInterviewTab();
  if (name === 'ontology') { sizeCanvas(); ensureSim(false); }
}

$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn || btn.disabled) return;
  switchTab(btn.dataset.tab);
});

function updateTabLock() {
  const has = !!state.suite;
  document.querySelectorAll('nav.tabs button').forEach(b => {
    if (b.dataset.tab !== 'suites') b.disabled = !has;
  });
}

/* 从框架详情跳转到实体并打开抽屉（实体列表在「本体管理」右侧） */
function goEntity(entityId) {
  if (!state.suite) return;
  const ent = state.suite.entities.find(x => x.id === entityId);
  if (!ent) { toast('实体不存在：' + entityId, 'err'); return; }
  switchTab('suites');
  openDrawer(entityId);
}

/* ═════════════════════════ 标注抽屉 ═════════════════════════ */
function openDrawer(entityId) {
  const ent = state.suite.entities.find(x => x.id === entityId);
  if (!ent) return;
  const mapping = state.suite.annotations.entityFrameMapping[entityId];
  const mark = state.suite.annotations.coverageMarks[entityId];
  state.drawer = {
    entityId,
    apqc: (mapping && mapping.apqcCode) || '',
    status: (mark && mark.status) || 'unset',
    note: (mapping && mapping.note) || (mark && mark.note) || '',
  };
  $('#dwTitle').textContent = ent.name;
  $('#dwSub').textContent = `${state.currentSuiteId}:${ent.rawId}`;
  const desc = ent.description || (ent.properties && ent.properties.description) || '';
  $('#dwDesc').style.display = desc ? '' : 'none';
  $('#dwDesc').textContent = desc;
  $('#dwInfo').innerHTML = `
    <dt>Kind</dt><dd><span class="kind-tag">${esc(ent.kind)}</span></dd>
    <dt>轴向</dt><dd>${kindAxisLabel(ent.kind)}</dd>
    <dt>领域</dt><dd>${esc(ent.domain || '—')}</dd>
    <dt>来源</dt><dd class="mono" style="font-size:11px">${esc(ent.sourceFile || '—')}</dd>
    <dt>实体 ID</dt><dd class="mono" style="font-size:11px">${esc(ent.id)}</dd>`;
  const axis = kindAxis(ent.kind);
  const inp = $('#dwApqc');
  inp.disabled = !axis;
  inp.value = state.drawer.apqc;
  inp.placeholder = axis === 'domain' ? '如 4.3，仅可选 L1/L2…'
    : axis === 'process' ? '如 4.3.1，仅可选 L3-L5…'
    : `${ent.kind} 类型不参与 APQC 映射`;
  $('#dwNote').value = state.drawer.note;
  renderStatusBtns();
  renderDerive();
  hideSug();
  $('#overlay').classList.add('show');
  $('#drawer').classList.add('show');
}

function kindAxisLabel(kind) {
  const axis = kindAxis(kind);
  return axis === 'domain' ? '<span class="axis-tag axis-domain">名词轴 · L1/L2</span>'
    : axis === 'process' ? '<span class="axis-tag axis-process">动词轴 · L3-L5</span>'
    : '<span class="axis-tag axis-none">不参与映射</span>';
}

function closeDrawer() {
  state.drawer = null;
  $('#overlay').classList.remove('show');
  $('#drawer').classList.remove('show');
}

function renderStatusBtns() {
  const box = $('#dwStatus');
  box.innerHTML = (['covered', 'partial', 'gap', 'unset']).map(s =>
    `<button data-st="${s}" class="st-${s} ${state.drawer.status === s ? 'on' : ''}">${STATUS_LABEL[s]}</button>`).join('');
}

$('#dwStatus').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-st]');
  if (!btn || !state.drawer) return;
  state.drawer.status = btn.dataset.st;
  renderStatusBtns();
});

function renderDerive() {
  const el = $('#dwDerive');
  const warnEl = $('#dwWarn');
  const domEl = $('#dwDomain');
  const code = $('#dwApqc').value.trim();
  const ent = state.drawer ? state.suite.entities.find(x => x.id === state.drawer.entityId) : null;

  // 域归属（来自词典）：展示词条 label 与别名
  const entry = dictEntryFor(code);
  if (code && entry) {
    domEl.style.display = '';
    const aliasTxt = entry.aliases && entry.aliases.length ? `（别名：${esc(entry.aliases.join('、'))}）` : '';
    domEl.innerHTML = `域归属：<b>${esc(entry.code)} ${esc(entry.label)}</b>${aliasTxt}<span class="axis-tag">${esc(entry.level)}</span>`;
  } else if (code) {
    domEl.style.display = '';
    domEl.innerHTML = `域归属：<span class="dim">「${esc(code)}」不在域词典中</span>`;
  } else {
    domEl.style.display = 'none';
    domEl.innerHTML = '';
  }

  // 分流校验：违规即时提示
  if (code && ent) {
    const chk = checkMappingAllowed(ent.kind, code);
    if (!chk.ok) {
      warnEl.style.display = '';
      warnEl.innerHTML = `⚠ ${esc(chk.msg)}`;
    } else {
      warnEl.style.display = 'none';
      warnEl.innerHTML = '';
    }
  } else {
    warnEl.style.display = 'none';
    warnEl.innerHTML = '';
  }

  if (!code) { el.innerHTML = '<span style="opacity:.6">输入 APQC 编号后将自动推导 Ontology 编号</span>'; return; }
  const onto = deriveOntologyCodeLocal(code);
  el.innerHTML = onto
    ? `→ 推导 Ontology 编号：<b>${esc(onto)}</b>`
    : `→ <span style="color:var(--st-gap)">编号格式无效（应为 1.2.3 形式的数字分层）</span>`;
}

$('#dwApqc').addEventListener('input', () => { renderDerive(); showSug(); });
$('#dwApqc').addEventListener('focus', () => showSug());
$('#dwApqc').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = $('#dwSug .sug-item');
    if (first) { pickSug(first.dataset.code); }
    e.preventDefault();
  } else if (e.key === 'Escape') {
    hideSug();
  }
});

function pickSug(code) {
  $('#dwApqc').value = code;
  state.drawer.apqc = code;
  renderDerive();
  hideSug();
}

function showSug() {
  if (!state.drawer) return;
  const q = $('#dwApqc').value.trim().toLowerCase();
  const box = $('#dwSug');
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const ent = state.suite.entities.find(x => x.id === state.drawer.entityId);
  const axis = ent ? kindAxis(ent.kind) : null;
  if (!axis) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const lvNum = (id) => { const m = /^L(\d+)$/.exec(id || ''); return m ? +m[1] : 0; };
  const allowed = (n) => axis === 'domain' ? n >= 1 && n <= 2 : n >= 3;
  const lvLabel = (id) => { const l = (state.framework?.levels || []).find(x => x.id === id); return l ? l.id : id; };
  const hits = state.flatFw.filter(n => {
    const ln = lvNum(n.levelId) || levelNumOfCode(n.code);
    if (!allowed(ln)) return false;
    return n.code.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || (n.name || '').toLowerCase().includes(q);
  }).slice(0, 30);
  box.innerHTML = hits.length
    ? hits.map(n => `<div class="sug-item" data-code="${esc(n.code)}">
        <span class="s-code">${esc(n.code)}</span>
        <span class="s-label">${esc(n.label)}</span>
        <span class="s-lv">${esc(lvLabel(n.levelId))}</span>
      </div>`).join('')
    : `<div class="sug-empty">${axis === 'domain' ? '无匹配的 L1/L2 节点' : '无匹配的 L3-L5 节点'}</div>`;
  box.classList.add('show');
}

function hideSug() { const b = $('#dwSug'); b.classList.remove('show'); b.innerHTML = ''; }

$('#dwSug').addEventListener('mousedown', (e) => {
  const item = e.target.closest('.sug-item');
  if (item) { e.preventDefault(); pickSug(item.dataset.code); }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.apqc-box')) hideSug();
});

async function saveDrawer() {
  if (!state.drawer) return;
  const { entityId, status, note } = state.drawer;
  const apqc = $('#dwApqc').value.trim();
  if (apqc && !deriveOntologyCodeLocal(apqc)) { toast('APQC 编号格式无效', 'err'); return; }
  if (apqc) {
    const ent = state.suite.entities.find(x => x.id === entityId);
    const chk = ent ? checkMappingAllowed(ent.kind, apqc) : { ok: false, msg: '实体不存在' };
    if (!chk.ok) { toast('保存被拒绝：' + chk.msg, 'err'); renderDerive(); return; }
  }
  const btn = $('#dwSave');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const ann = state.suite.annotations;
    const now = Date.now();
    if (apqc) {
      ann.entityFrameMapping[entityId] = { frameworkId: DEFAULT_FW, apqcCode: apqc, note: note || undefined, mappedAt: now };
    } else {
      delete ann.entityFrameMapping[entityId];
    }
    ann.coverageMarks[entityId] = { status, note: note || undefined, updatedAt: now };
    await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann),
    });
    closeDrawer();
    toast('标注已保存', 'ok');
    // 刷新覆盖度（本地实体标注状态同步更新，无需重新拉取套件）
    state.coverage = await api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + DEFAULT_FW);
    renderCoverage();
    renderTree();
    renderNodeDetail();
    renderEntities();
    renderOntologyDetail();
  } catch (err) {
    toast('保存失败：' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '保存';
  }
}

$('#dwSave').addEventListener('click', saveDrawer);

$('#dwClear').addEventListener('click', () => {
  if (!state.drawer) return;
  $('#dwApqc').value = '';
  state.drawer.status = 'unset';
  state.drawer.note = '';
  $('#dwNote').value = '';
  renderStatusBtns();
  renderDerive();
  toast('已清除（点击「保存」生效）');
});

$('#dwClose').addEventListener('click', closeDrawer);
$('#overlay').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.drawer) closeDrawer();
});

/* ═════════════════════════ 主题同步 ═════════════════════════ */
(function syncTheme() {
  try {
    if (window.parent && window.parent !== window) {
      const parentEl = window.parent.document.documentElement;
      const apply = () => {
        if (parentEl.hasAttribute('data-ds-dark-theme')) { document.documentElement.setAttribute('data-theme', 'dark'); return; }
        const t = parentEl.getAttribute('data-ds-theme')
          || parentEl.getAttribute('data-theme')
          || parentEl.getAttribute('data-color-mode');
        if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
      };
      apply();
      // 监听父页面主题变化
      try {
        new MutationObserver(apply).observe(parentEl, { attributes: true, attributeFilter: ['data-theme', 'data-ds-theme', 'data-ds-dark-theme', 'data-color-mode', 'class'] });
      } catch { /* ignore */ }
    }
  } catch { /* cross-origin */ }
})();
