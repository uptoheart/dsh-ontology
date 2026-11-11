/* ═══════════════════════════════════════════════════════════════════
   FDE 助手：现场交付驾驶舱
   确定性内核（阶段/门禁/指标/行动）+ 问题生成 + 决策台账 + 提示词工坊
   ═══════════════════════════════════════════════════════════════════ */

const AG_STAGES = [
  { id: 'prep', label: '进场准备' },
  { id: 'diagnose', label: '诊断对齐' },
  { id: 'flow', label: '流程显影' },
  { id: 'semantic', label: '语义固化' },
  { id: 'validate', label: '应用验证' },
  { id: 'handoff', label: '回带沉淀' },
];

const AG_SCENES = [
  { id: 'diagnose', label: '诊断会议提纲' },
  { id: 'interview', label: '访谈提纲' },
  { id: 'model', label: '本体建模草案' },
  { id: 'validate', label: '演示脚本与验收' },
  { id: 'handoff', label: '回带交接摘要' },
];

const AG_EXPORTS = [
  { kind: 'minutes', label: '导出纪要' },
  { kind: 'crud', label: '导出 CRUD' },
  { kind: 'gap', label: '导出缺口' },
  { kind: 'domain', label: '导出域覆盖' },
  { kind: 'package', label: '导出数据包' },
];

const AG_EXPORT_EXT = { minutes: 'md', crud: 'csv', gap: 'csv', domain: 'csv' };

function agStageLabel(stage) {
  const item = AG_STAGES.find(s => s.id === stage);
  return item ? item.label : stage;
}

function agentRt() {
  if (!state.agent) {
    state.agent = { suiteId: null, overview: null, questionSet: null, prompt: null, selectedCode: '' };
  }
  return state.agent;
}

function agQuery(path) {
  return path + (path.includes('?') ? '&' : '?') + 'suiteId=' + encodeURIComponent(state.currentSuiteId || '');
}

function agEsc(s) { return esc(s); }

/* ─────────────── 主渲染 ─────────────── */

async function renderAgentTab() {
  const rt = agentRt();
  if (!state.currentSuiteId) {
    $('#agSuiteMeta').textContent = '请先在「套件管理」选择一个套件';
    $('#agStageRail').innerHTML = '<div class="ag-empty">未选择套件</div>';
    $('#agMetrics').innerHTML = '';
    $('#agActions').innerHTML = '';
    $('#agRisks').innerHTML = '';
    $('#agExports').innerHTML = '';
    $('#agGates').innerHTML = '';
    $('#agQuestions').innerHTML = '';
    $('#agLedgerList').innerHTML = '';
    return;
  }

  if (rt.suiteId !== state.currentSuiteId) {
    rt.suiteId = state.currentSuiteId;
    rt.overview = null;
    rt.questionSet = null;
    rt.prompt = null;
    rt.selectedCode = '';
    $('#agQuestions').innerHTML = '';
    $('#agNodeMeta').innerHTML = '';
    $('#agPromptText').value = '';
  }

  $('#agSuiteMeta').textContent = '加载中…';
  try {
    const data = await api(agQuery('/api/agent/overview'));
    rt.overview = data;
    renderAgentOverview(data);
    renderAgentLedger(data);
    renderAgentExports(data);
    const code = renderAgentQuestionOptions(data);
    if (code) await loadAgentQuestions(code);
  } catch (err) {
    $('#agSuiteMeta').textContent = '加载失败：' + err.message;
    toast('FDE 助手加载失败：' + err.message, 'err');
  }
}

function renderAgentOverview(data) {
  const suite = state.suite;
  const name = (suite && suite.meta && (suite.meta.project || suite.meta.suiteId)) || data.suiteId;
  const passed = data.gates.filter(g => g.passed).length;
  $('#agSuiteMeta').textContent = `${name} · ${data.stageLabel} · 门禁 ${passed}/${data.gates.length} 通过`;

  renderAgentStages(data);
  renderAgentMetrics(data.metrics);
  renderAgentActions(data.actions, data);
  renderAgentRisks(data.risks);
  renderAgentGates(data.gates);
}

function renderAgentStages(data) {
  const rail = $('#agStageRail');
  rail.innerHTML = AG_STAGES.map((stage, idx) => {
    const gate = data.gates.find(g => g.stage === stage.id);
    const done = gate && gate.passed;
    const current = data.stage === stage.id;
    const cls = ['ag-stage', done ? 'done' : '', current ? 'current' : ''].filter(Boolean).join(' ');
    const sub = gate ? gate.criteria : '尚未计算';
    return `<button class="${cls}" data-stage="${stage.id}" title="${agEsc(sub)}">
      <span><span class="ag-stage-idx">${idx + 1}</span><span class="ag-stage-label">${stage.label}</span></span>
      <div class="ag-stage-sub">${done ? '已达成' : '未达成'}</div>
    </button>`;
  }).join('');

  const currentGate = data.gates.find(g => g.stage === data.stage);
  $('#agGateSummary').innerHTML = `门禁 <b>${data.gates.filter(g => g.passed).length}/${data.gates.length}</b> 通过 · 当前：${agEsc(data.stageLabel)}`
    + (currentGate && !currentGate.passed ? ` · 还差：${agEsc(currentGate.criteria)}` : '');

  if (data.nextStage) {
    $('#agNextStage').innerHTML = `<button class="btn primary ag-next-btn" data-advance="${data.nextStage}">进入「${agStageLabel(data.nextStage)}」</button>`;
  } else if (currentGate && currentGate.passed) {
    $('#agNextStage').innerHTML = '<span class="ag-next-btn">闭环已达成</span>';
  } else {
    $('#agNextStage').innerHTML = '';
  }
}

function renderAgentMetrics(metrics) {
  $('#agMetrics').innerHTML = metrics.map(m => `
    <div class="ag-metric ${m.status}">
      <div class="ag-m-label">${agEsc(m.label)}</div>
      <div class="ag-m-value">${agEsc(m.value)}</div>
      <div class="ag-m-detail">${agEsc(m.detail)}</div>
    </div>`).join('');
}

function renderAgentActions(actions, data) {
  const box = $('#agActions');
  if (!actions.length) {
    const gate = data.gates.find(g => g.stage === data.stage);
    box.innerHTML = `<div class="ag-empty">${gate && gate.passed
      ? '当前阶段门禁已达成，闭环可交付。'
      : '当前阶段暂无自动行动建议，请检查套件数据。'}</div>`;
    return;
  }
  box.innerHTML = actions.map(a => `
    <div class="ag-item">
      <span class="ag-prio ${a.priority}">${a.priority}</span>
      <div class="ag-item-main">
        <div class="ag-item-title">${agEsc(a.title)}${a.count ? ` <span class="kind-tag">${a.count}</span>` : ''}</div>
        <div class="ag-item-why">${agEsc(a.why)}</div>
      </div>
      <div class="ag-item-cta">
        <button class="btn" data-action-id="${a.id}">${agEsc(a.cta.label)}</button>
      </div>
    </div>`).join('');
}

function renderAgentRisks(risks) {
  const box = $('#agRisks');
  if (!risks.length) {
    box.innerHTML = '<div class="ag-empty">暂无全局风险：违规映射、未挂载访谈、待确认口径均为 0。</div>';
    return;
  }
  box.innerHTML = risks.map(r => `
    <div class="ag-item risk">
      <div class="ag-item-main">
        <div class="ag-item-title">${agEsc(r.title)}</div>
        <div class="ag-item-why">${agEsc(r.detail)}</div>
      </div>
      <div class="ag-item-cta">
        <button class="btn" data-risk-id="${r.id}">去处理</button>
      </div>
    </div>`).join('');
}

function renderAgentGates(gates) {
  $('#agGates').innerHTML = gates.map(g => `
    <div class="ag-gate-row ${g.passed ? 'passed' : ''}">
      <span class="ag-gate-dot"></span>
      <span>${agEsc(g.label)}</span>
      <span class="ag-grow"></span>
      <span>${agEsc(g.criteria)}</span>
    </div>`).join('');
}

/* ─────────────── 阶段 / 行动 / 风险 ─────────────── */

async function agentSetStage(stage) {
  if (!stage || !state.currentSuiteId) return;
  try {
    await agentSaveState({ stage });
    toast(`已切换到「${agStageLabel(stage)}」`, 'ok');
    await renderAgentTab();
  } catch (err) {
    toast('切换阶段失败：' + err.message, 'err');
  }
}

async function agentDoAction(action) {
  if (!action) return;
  const code = action.cta && action.cta.code;
  switch (action.id) {
    case 'anchor-entities':
      switchTab('suites');
      toast('在实体表中补齐 L1/L2 锚定', 'ok');
      break;
    case 'fix-mapping':
      switchTab('coverage');
      toast('在覆盖度页的违规映射横幅中逐条迁移', 'ok');
      break;
    case 'interview-gaps':
    case 'complete-four-questions':
      switchTab('interview');
      if (code && typeof selectInterviewNode === 'function') {
        setTimeout(() => selectInterviewNode(code), 30);
        toast(`已选择节点 ${code}`, 'ok');
      } else {
        toast('在左侧访谈清单选择目标节点', 'ok');
      }
      break;
    case 'generate-flow-draft':
      await agentGenerateFlowDraft();
      break;
    case 'resolve-decisions':
      $('#agLedgerCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#agDecTopic').focus();
      break;
    case 'export-deliverables':
      $('#agDeliverCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    default:
      break;
  }
}

async function agentGenerateFlowDraft() {
  if (!state.currentSuiteId) return;
  if (!state.interviews || !state.interviews.length) {
    toast('本套件暂无访谈记录，先做四问', 'err');
    return;
  }
  if (!confirm(`将本套件 ${state.interviews.length} 条访谈记录生成为一个独立画板草稿？\n（已有挂载流程的 L3 编号会跳过）`)) return;
  try {
    const res = await api('/api/suites/' + encodeURIComponent(state.currentSuiteId) + '/flow-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const skipTxt = res.skipped && res.skipped.length ? `；跳过 ${res.skipped.length} 条` : '';
    toast(`已生成画板草稿「${res.draft.name}」${skipTxt}`, 'ok');
    state.coverage = await api('/api/coverage?suite=' + encodeURIComponent(state.currentSuiteId) + '&framework=' + encodeURIComponent(state.frameworkId));
    renderCoverage();
    switchTab('flowchart');
    openFlowchart(res.draft.id);
  } catch (err) {
    toast('生成草稿失败：' + err.message, 'err');
  }
}

function agentHandleRisk(risk) {
  if (!risk) return;
  if (risk.tab === 'agent') {
    $('#agLedgerCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#agDecTopic').focus();
    return;
  }
  switchTab(risk.tab);
  if (risk.code && typeof selectInterviewNode === 'function' && risk.tab === 'interview') {
    setTimeout(() => selectInterviewNode(risk.code), 30);
  }
}

/* ─────────────── 访谈问题生成器 ─────────────── */

function agentNodeOptions() {
  const list = (state.flatFw || []).filter(n => n.levelId === 'L3' || n.levelId === 'L4' || n.levelId === 'L5');
  return list.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), 'zh-CN', { numeric: true }));
}

function renderAgentQuestionOptions(overview) {
  const sel = $('#agQuestionNode');
  const options = agentNodeOptions();
  const rt = agentRt();
  if (!options.length) {
    sel.innerHTML = '<option value="">当前框架暂无 L3+ 节点</option>';
    sel.disabled = true;
    $('#agGenQuestions').disabled = true;
    return '';
  }
  sel.disabled = false;
  $('#agGenQuestions').disabled = false;

  const groups = new Map();
  for (const node of options) {
    const key = (node.pathLabels && node.pathLabels[0]) || '其他';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  sel.innerHTML = [...groups.entries()].map(([label, nodes]) => `
    <optgroup label="${agEsc(label)}">
      ${nodes.map(n => `<option value="${agEsc(n.code)}">${agEsc(n.code)} ${agEsc(n.label || n.name || '')}</option>`).join('')}
    </optgroup>`).join('');

  const gapCode = state.coverage && state.coverage.process && state.coverage.process.gapList
    && state.coverage.process.gapList[0] && state.coverage.process.gapList[0].code;
  const actionCode = (overview.actions || []).find(a => a.cta && a.cta.code)?.cta.code;
  const exists = code => options.some(n => n.code === code);
  let code = rt.selectedCode;
  if (!code || !exists(code)) code = actionCode && exists(actionCode) ? actionCode : '';
  if (!code && gapCode && exists(gapCode)) code = gapCode;
  if (!code) code = options[0].code;

  rt.selectedCode = code;
  sel.value = code;
  return code;
}

async function loadAgentQuestions(code) {
  if (!code || !state.currentSuiteId) return;
  const rt = agentRt();
  rt.selectedCode = code;
  $('#agQuestions').innerHTML = '<div class="ag-empty">生成中…</div>';
  try {
    const data = await api(agQuery('/api/agent/questions?code=' + encodeURIComponent(code)));
    rt.questionSet = data;
    renderAgentQuestions(data);
  } catch (err) {
    rt.questionSet = null;
    $('#agNodeMeta').innerHTML = '';
    $('#agQuestions').innerHTML = `<div class="ag-empty">${agEsc(err.message)}</div>`;
  }
}

function renderAgentQuestions(data) {
  const meta = [];
  meta.push(`<div class="ag-context">${agEsc(data.customerContext)}</div>`);
  if (data.path && data.path.length) {
    meta.push(`<div class="ag-chips"><span class="ag-chip">路径：${data.path.map(agEsc).join(' / ')}</span></div>`);
  }
  if (data.suggestedEntities && data.suggestedEntities.length) {
    meta.push(`<div class="ag-chips">${data.suggestedEntities.map(e => `<span class="ag-chip">${agEsc(e.name)} · ${agEsc(e.kind)}</span>`).join('')}</div>`);
  }
  if (data.suggestedRules && data.suggestedRules.length) {
    meta.push(`<div class="ag-chips">${data.suggestedRules.map(r => `<span class="ag-chip">规则：${agEsc(r)}</span>`).join('')}</div>`);
  }
  if (data.warnings && data.warnings.length) {
    meta.push(`<div class="ag-warnings">${data.warnings.map(w => `<div class="ag-warn">注意：${agEsc(w)}</div>`).join('')}</div>`);
  }
  $('#agNodeMeta').innerHTML = meta.join('');

  $('#agQuestions').innerHTML = data.questions.map(q => `
    <div class="ag-q">
      <div class="ag-q-title">${agEsc(q.title)}</div>
      <div class="ag-q-ask">${agEsc(q.ask)}</div>
      <div class="ag-q-why">为什么问：${agEsc(q.why)}</div>
      ${q.probes && q.probes.length ? `<ul class="ag-q-probes">${q.probes.map(p => `<li>${agEsc(p)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');
}

/* ─────────────── 决策台账 ─────────────── */

function renderAgentLedger(overview) {
  const decisions = (overview.state && overview.state.decisions) || [];
  const pending = decisions.filter(d => d.status === 'pending').length;
  const confirmed = decisions.filter(d => d.status === 'confirmed').length;
  $('#agLedgerStats').textContent = decisions.length ? `已确认 ${confirmed} · 待确认 ${pending}` : '暂无记录';

  const box = $('#agLedgerList');
  if (!decisions.length) {
    box.innerHTML = '<div class="ag-empty">还没有决策记录。先登记一条「待确认」，下次进场前必须闭环。</div>';
    return;
  }

  const parts = [];
  for (const stage of AG_STAGES) {
    const items = decisions.filter(d => d.stage === stage.id);
    if (!items.length) continue;
    parts.push(`<div class="ag-chips"><span class="ag-chip">${stage.label} · ${items.length} 条</span></div>`);
    for (const item of items) {
      const status = item.status === 'confirmed' ? '已确认' : '待确认';
      parts.push(`
        <div class="ag-dec">
          <div class="ag-dec-head">
            <span class="ag-dec-topic">${agEsc(item.topic || '未命名')}</span>
            <span class="ag-dec-status ${item.status}">${status}</span>
          </div>
          <div class="ag-dec-q">${agEsc(item.question || '—')}</div>
          ${item.answer ? `<div class="ag-dec-a">结论：${agEsc(item.answer)}</div>` : ''}
          <div class="ag-dec-foot">
            <span>${fmtTime(item.updatedAt)}</span>
            <button class="ag-mini" data-dec-id="${agEsc(item.id)}" data-dec-op="toggle">${item.status === 'confirmed' ? '改回待确认' : '确认'}</button>
            <button class="ag-mini" data-dec-id="${agEsc(item.id)}" data-dec-op="delete">删除</button>
          </div>
        </div>`);
    }
  }
  box.innerHTML = parts.join('');
}

async function agentAddDecision(e) {
  e.preventDefault();
  const topic = $('#agDecTopic').value.trim();
  const question = $('#agDecQuestion').value.trim();
  const answer = $('#agDecAnswer').value.trim();
  if (!topic || !question) { toast('请填写主题和要确认的问题', 'err'); return; }
  const overview = agentRt().overview;
  if (!overview) { toast('概览尚未加载', 'err'); return; }
  const now = Date.now();
  const decisions = [...(overview.state.decisions || []), {
    id: 'dec-' + now + '-' + Math.random().toString(36).slice(2, 6),
    stage: $('#agDecStage').value,
    topic,
    question,
    answer,
    status: $('#agDecStatus').value,
    createdAt: now,
    updatedAt: now,
  }];
  try {
    await agentSaveState({ decisions });
    $('#agDecTopic').value = '';
    $('#agDecQuestion').value = '';
    $('#agDecAnswer').value = '';
    toast('已登记决策', 'ok');
    await renderAgentTab();
  } catch (err) {
    toast('登记失败：' + err.message, 'err');
  }
}

async function agentToggleDecision(id, op) {
  const overview = agentRt().overview;
  if (!overview) return;
  let decisions = overview.state.decisions || [];
  if (op === 'delete') {
    if (!confirm('删除这条决策记录？')) return;
    decisions = decisions.filter(d => d.id !== id);
  } else {
    decisions = decisions.map(d => d.id === id
      ? { ...d, status: d.status === 'confirmed' ? 'pending' : 'confirmed', updatedAt: Date.now() }
      : d);
  }
  try {
    await agentSaveState({ decisions });
    await renderAgentTab();
  } catch (err) {
    toast('更新失败：' + err.message, 'err');
  }
}

async function agentSaveState(patch) {
  const body = { suiteId: state.currentSuiteId, ...patch };
  const next = await api('/api/agent/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const rt = agentRt();
  if (rt.overview) rt.overview.state = next;
  return next;
}

/* ─────────────── 交付物 ─────────────── */

function renderAgentExports(overview) {
  const exported = new Set(((overview.state && overview.state.exports) || []).map(e => e.kind));
  const kinds = ['minutes', 'crud', 'gap', 'domain'];
  const done = kinds.filter(k => exported.has(k)).length;
  const packageDone = exported.has('package');
  const ledgerDone = exported.has('ledger');

  $('#agExports').innerHTML = AG_EXPORTS.map(item => `
    <button class="btn" data-export-kind="${item.kind}">${item.label}${exported.has(item.kind) ? ' · 已导出' : ''}</button>
  `).join('') + `<div class="ag-export-note">四类交付物 ${done}/4；数据包${packageDone ? '已' : '未'}导出；决策台账${ledgerDone ? '已' : '未'}导出。</div>`;
}

async function agentDownload(kind) {
  if (!state.currentSuiteId) return;
  const enc = encodeURIComponent(state.currentSuiteId);
  const url = kind === 'package'
    ? `/api/suites/${enc}/package`
    : kind === 'ledger'
      ? agQuery('/api/agent/ledger')
      : `/api/suites/${enc}/export?kind=${kind}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const safe = state.currentSuiteId.replace(/[^\w.-]/g, '_');
    const name = kind === 'package'
      ? safe + '.dshont.json'
      : kind === 'ledger'
        ? safe + '-decisions.md'
        : safe + '-' + kind + '.' + (AG_EXPORT_EXT[kind] || 'txt');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);

    await agentRecordExport(kind);
    toast('已导出：' + name, 'ok');
    await renderAgentTab();
  } catch (err) {
    toast('导出失败：' + err.message, 'err');
  }
}

async function agentRecordExport(kind) {
  const overview = agentRt().overview;
  if (!overview) return;
  const exports = [...((overview.state && overview.state.exports) || []), { kind, at: Date.now() }];
  await agentSaveState({ exports });
}

/* ─────────────── 提示词工坊 ─────────────── */

async function agentGeneratePrompt() {
  if (!state.currentSuiteId) return;
  const scene = $('#agPromptScene').value;
  if (!scene) return;
  $('#agPromptText').value = '生成中…';
  try {
    const data = await api(agQuery('/api/agent/prompt?scene=' + encodeURIComponent(scene)));
    agentRt().prompt = data;
    $('#agPromptText').value = data.content;
    toast('已生成：' + data.title, 'ok');
  } catch (err) {
    $('#agPromptText').value = '';
    toast('生成提示词失败：' + err.message, 'err');
  }
}

async function copyAgentPrompt() {
  const text = $('#agPromptText').value;
  if (!text || text === '生成中…') { toast('先生成提示词', 'err'); return; }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('提示词已复制', 'ok');
  } catch (err) {
    toast('复制失败，请手动选择文本复制', 'err');
  }
}

/* ─────────────── 初始化 ─────────────── */

function initAgentPage() {
  $('#agDecStage').innerHTML = AG_STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  $('#agPromptScene').innerHTML = AG_SCENES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');

  $('#agReload').addEventListener('click', () => renderAgentTab());

  $('#agStageRail').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-stage]');
    if (btn) agentSetStage(btn.dataset.stage);
  });
  $('#agNextStage').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-advance]');
    if (btn) agentSetStage(btn.dataset.advance);
  });

  $('#agActions').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action-id]');
    if (!btn) return;
    const overview = agentRt().overview;
    const action = overview && overview.actions.find(a => a.id === btn.dataset.actionId);
    agentDoAction(action);
  });

  $('#agRisks').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-risk-id]');
    if (!btn) return;
    const overview = agentRt().overview;
    const risk = overview && overview.risks.find(r => r.id === btn.dataset.riskId);
    agentHandleRisk(risk);
  });

  $('#agGenQuestions').addEventListener('click', () => loadAgentQuestions($('#agQuestionNode').value));
  $('#agQuestionNode').addEventListener('change', () => loadAgentQuestions($('#agQuestionNode').value));

  $('#agDecForm').addEventListener('submit', agentAddDecision);
  $('#agLedgerList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dec-id]');
    if (btn) agentToggleDecision(btn.dataset.decId, btn.dataset.decOp);
  });
  $('#agLedgerExport').addEventListener('click', () => agentDownload('ledger'));

  $('#agExports').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-export-kind]');
    if (btn) agentDownload(btn.dataset.exportKind);
  });

  $('#agGenPrompt').addEventListener('click', agentGeneratePrompt);
  $('#agPromptCopy').addEventListener('click', copyAgentPrompt);
}

initAgentPage();
