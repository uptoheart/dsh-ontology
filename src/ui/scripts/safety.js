/* ═════════════════════════ 化工安全应用 ═════════════════════════ */
const SAFETY_GRADE_LABEL = { red: '红', orange: '橙', yellow: '黄', blue: '蓝' };
const SAFETY_GRADE_ORDER = { red: 0, orange: 1, yellow: 2, blue: 3 };

const safetyState = {
  loaded: false,
  loading: false,
  tab: 'overview',
  overview: null,
  regulations: null,
  assets: null,
  operations: null,
  rules: null,
  assessment: null,
  incidents: [],
  chain: null,
};

function safetyChip(grade) {
  if (!grade) return '<span class="dim">—</span>';
  return `<span class="grade-chip grade-${esc(grade)}">${esc(SAFETY_GRADE_LABEL[grade] || grade)}</span>`;
}

function safetyScore(v) {
  return v === undefined || v === null ? '—' : Number(v).toFixed(1);
}

function safetyPenaltyText(result, limit) {
  const list = (result.penalties || []).map(p => p.message).filter(Boolean);
  if (list.length === 0) return '<span class="ok-tag">无扣分项</span>';
  const shown = list.slice(0, limit || 2).map(m => esc(m)).join('；');
  return list.length > (limit || 2) ? `${shown} <span class="dim">等 ${list.length} 项</span>` : shown;
}

function safetyScoreTable(title, list) {
  if (!list || list.length === 0) {
    return `<div class="card"><div class="card-head">${esc(title)}</div><div class="card-body dim">无数据</div></div>`;
  }
  const rows = list.map(item => `<tr>
    <td>${esc(item.entityName)}<div class="e-id">${esc(item.entityId)}</div></td>
    <td class="num">${safetyScore(item.score)}</td>
    <td>${safetyChip(item.grade)}</td>
    <td>${safetyPenaltyText(item)}</td>
  </tr>`).join('');
  return `<div class="card">
    <div class="card-head">${esc(title)} <span class="spacer"></span><span class="dim">${list.length} 项</span></div>
    <div class="card-body tight">
      <table class="safety-table">
        <thead><tr><th>对象</th><th>得分</th><th>等级</th><th>主要扣分</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// ─────────────── 总览 ───────────────

function renderSafetyOverview() {
  const el = $('#stab-overview');
  const o = safetyState.overview;
  if (!o) { el.innerHTML = '<div class="empty-hint">暂无安全套件数据</div>'; return; }
  const a = safetyState.assessment;
  const counts = o.counts || {};
  const summary = a ? a.summary : null;
  const pending = o.pendingControls || [];

  el.innerHTML = `
    <div class="safety-grid">
      <div class="kpi">
        <div class="k-label">厂区安全评级</div>
        <div class="k-value">${a ? safetyChip(a.plant.grade) : '<span class="dim">未评级</span>'}</div>
        <div class="k-note">${a ? '综合得分 ' + safetyScore(a.plant.score) : '点击右上角「运行评级」'}</div>
      </div>
      <div class="kpi">
        <div class="k-label">装置四色分布</div>
        <div class="k-value">${summary ? `${summary.red} / ${summary.orange} / ${summary.yellow} / ${summary.blue}` : '—'}</div>
        <div class="k-note">红 / 橙 / 黄 / 蓝（共 ${summary ? summary.total : 0} 套装置）</div>
      </div>
      <div class="kpi">
        <div class="k-label">未落实管控措施</div>
        <div class="k-value" style="color:${pending.length ? 'var(--st-gap)' : 'var(--st-covered)'}">${pending.length}</div>
        <div class="k-note">共 ${(o.counts.SAFETY_CONTROL || 0)} 项措施</div>
      </div>
      <div class="kpi">
        <div class="k-label">法规 / 条款</div>
        <div class="k-value">${counts.SAFETY_REGULATION || 0} / ${counts.SAFETY_CLAUSE || 0}</div>
        <div class="k-note">检查项 ${counts.SAFETY_CHECK_ITEM || 0} 项</div>
      </div>
      <div class="kpi">
        <div class="k-label">设备 / 作业 / 事件</div>
        <div class="k-value">${counts.SAFETY_EQUIPMENT || 0} / ${counts.SAFETY_OPERATION || 0} / ${o.incidents.length}</div>
        <div class="k-note">实体 ${Object.values(counts).reduce((s, n) => s + n, 0)} 个 · 关系 ${o.relationCount} 条</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">⚠ 待落实管控措施 <span class="spacer"></span><span class="dim">${pending.length} 项</span></div>
      <div class="card-body tight">
        ${pending.length ? `<table class="safety-table">
          <thead><tr><th>措施</th><th>层级</th><th>状态</th></tr></thead>
          <tbody>${pending.map(c => `<tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.level || '—')}</td>
            <td><span class="mini-tag bad">未落实</span></td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="card-body ok-tag">全部管控措施已落实</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-head">🧯 安全事件 <span class="spacer"></span><span class="dim">${o.incidents.length} 起</span></div>
      <div class="card-body tight">
        ${o.incidents.length ? `<table class="safety-table">
          <thead><tr><th>事件</th><th>时间</th><th>后果</th><th>操作</th></tr></thead>
          <tbody>${o.incidents.map(i => `<tr>
            <td>${esc(i.title)}<div class="e-id">${esc(i.id)}</div></td>
            <td class="num">${esc(i.occurredAt)}</td>
            <td>${esc(i.consequences || '—')}</td>
            <td><button class="btn js-rca" data-incident="${esc(i.id)}">根因链路</button></td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="card-body dim">暂无事件</div>'}
      </div>
    </div>`;

  el.querySelectorAll('.js-rca').forEach(btn => {
    btn.addEventListener('click', () => {
      const select = $('#rcaIncident');
      select.value = btn.dataset.incident;
      switchSafetyTab('rca');
      loadSafetyChain(false);
    });
  });
}

// ─────────────── 法规库 ───────────────

function renderSafetyRegulations() {
  const el = $('#stab-regulation');
  const data = safetyState.regulations;
  if (!data) { el.innerHTML = '<div class="empty-hint">暂无法规数据</div>'; return; }
  const blocks = data.regulations.map(reg => {
    const clauses = reg.clauses.map(c => {
      const controls = c.controls.map(ct =>
        `<span class="mini-tag ${ct.implemented ? 'good' : 'bad'}">${esc(ct.name)}${ct.implemented ? '' : ' · 未落实'}</span>`
      ).join('');
      const targets = c.appliesTo.length
        ? `<span>适用 ${c.appliesTo.length} 个对象</span>`
        : '';
      return `<div class="clause">
        <div class="clause-text">${esc(c.name)}　${esc(c.text || '')}</div>
        <div class="clause-meta">
          <span class="mini-tag ${c.mandatory ? 'bad' : ''}">${c.mandatory ? '强制' : '推荐'}</span>
          ${targets}
        </div>
        ${controls ? `<div class="tag-line" style="margin-top:5px">${controls}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="reg-block">
      <div class="reg-title">${esc(reg.name)} <span class="mini-tag">${esc(reg.type || '')}</span></div>
      <div class="reg-meta">${esc(reg.code)} · ${esc(reg.issuer || '')} · ${reg.clauses.length} 条条款</div>
      ${clauses}
    </div>`;
  }).join('');

  const checks = (data.checks || []).map(c => `<tr>
    <td>${esc(c.name)}</td>
    <td>${esc(c.frequency || '—')}</td>
    <td class="mono">${esc((c.clauseIds || []).join('、') || '—')}</td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="card">
      <div class="card-head">📚 法规与条款 <span class="spacer"></span><span class="dim">${data.regulations.length} 部法规</span></div>
      <div class="card-body tight">${blocks || '<div class="card-body dim">暂无数据</div>'}</div>
    </div>
    <div class="card">
      <div class="card-head">✅ 检查项</div>
      <div class="card-body tight">
        ${checks ? `<table class="safety-table"><thead><tr><th>检查项</th><th>频次</th><th>对应条款</th></tr></thead><tbody>${checks}</tbody></table>` : '<div class="card-body dim">暂无数据</div>'}
      </div>
    </div>`;
}

// ─────────────── 资产台账 ───────────────

function renderSafetyAssets() {
  const el = $('#stab-asset');
  const data = safetyState.assets;
  if (!data) { el.innerHTML = '<div class="empty-hint">暂无资产数据</div>'; return; }

  const areas = data.areas.map(area => {
    const unitBlocks = area.units.map(unit => {
      const equipments = unit.equipments.map(eq => `<tr>
        <td>${esc(eq.name)}<div class="e-id">${esc(eq.equipmentClass || '')}</div></td>
        <td>${esc(eq.status || '—')}</td>
        <td class="mono">${esc(eq.inspectionValidUntil || '—')}</td>
        <td class="num">${eq.stock ?? 0}</td>
        <td>${esc((eq.materials || []).join('、') || '—')}</td>
        <td>${esc((eq.hazards || []).join('、') || '—')}</td>
      </tr>`).join('');

      return `<tr class="unit-row"><td colspan="6">装置：${esc(unit.name)} <span class="dim">· ${esc(unit.process || '')} · 人数 ${unit.headcount ?? 0} · 存量 ${unit.stock ?? 0}</span></td></tr>
        ${equipments || '<tr><td colspan="6" class="dim">该装置暂无设备</td></tr>'}`;
    }).join('');

    return `<div class="asset-area">
      <div class="area-bar">📍 ${esc(area.name)}
        <span class="mini-tag">${esc(area.riskLevel || '—')}</span>
        <span class="dim">人数 ${area.headcount ?? 0} · 存量 ${area.stock ?? 0} · ${area.units.length} 套装置</span>
      </div>
      <table class="safety-table">
        <thead><tr><th>设备</th><th>状态</th><th>检验有效期</th><th>存量</th><th>物料</th><th>危险源</th></tr></thead>
        <tbody>${unitBlocks || '<tr><td colspan="6" class="dim">暂无装置</td></tr>'}</tbody>
      </table>
    </div>`;
  }).join('');

  const materials = data.materials.map(m => `<tr>
    <td>${esc(m.name)}</td>
    <td class="mono">${esc(m.cas || '—')}</td>
    <td class="num">${m.criticalQuantity ?? 0}</td>
    <td>${esc(m.hazardClass || '—')}</td>
  </tr>`).join('');

  const hazards = data.hazards.map(h => `<tr>
    <td>${esc(h.name)}</td>
    <td>${esc(h.category || '—')}</td>
    <td>${esc(h.accidentType || '—')}</td>
    <td>${esc((h.controls || []).join('、') || '—')}</td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="card">
      <div class="card-head">🏭 区域 / 装置 / 设备</div>
      <div class="card-body">${areas || '<div class="dim">暂无数据</div>'}</div>
    </div>
    <div class="card">
      <div class="card-head">🧪 危险化学品</div>
      <div class="card-body tight">
        ${materials ? `<table class="safety-table"><thead><tr><th>物料</th><th>CAS</th><th>临界量(t)</th><th>类别</th></tr></thead><tbody>${materials}</tbody></table>` : '<div class="card-body dim">暂无数据</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-head">☠ 危险源与控制措施</div>
      <div class="card-body tight">
        ${hazards ? `<table class="safety-table"><thead><tr><th>危险源</th><th>类别</th><th>事故类型</th><th>管控措施</th></tr></thead><tbody>${hazards}</tbody></table>` : '<div class="card-body dim">暂无数据</div>'}
      </div>
    </div>`;
}

// ─────────────── 作业分析 ───────────────

function renderSafetyOperations() {
  const el = $('#stab-operation');
  const data = safetyState.operations;
  if (!data) { el.innerHTML = '<div class="empty-hint">暂无作业数据</div>'; return; }

  const rows = data.operations.map(op => {
    const missing = (op.missingControlCodes || []).map(c => `<span class="mini-tag bad">${esc(c)}</span>`).join('');
    const permit = op.permitViolation === 'MISSING'
      ? '<span class="mini-tag bad">票证缺失</span>'
      : op.permitViolation === 'INVALID'
        ? '<span class="mini-tag bad">票证无效</span>'
        : '<span class="mini-tag good">票证合规</span>';
    return `<tr>
      <td>${esc(op.name)}<div class="e-id">${esc(op.operationType || '')} · ${esc(op.areaCode || '')}</div></td>
      <td>${esc((op.equipments || []).join('、') || '—')}</td>
      <td>${esc((op.hazards || []).join('、') || '—')}</td>
      <td>${permit}</td>
      <td>${missing || '<span class="ok-tag">措施齐备</span>'}</td>
      <td class="num">${(op.clauseViolations || []).length}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card">
      <div class="card-head">🔧 特殊作业清单 <span class="spacer"></span><span class="dim">${data.operations.length} 项作业</span></div>
      <div class="card-body tight">
        <table class="safety-table">
          <thead><tr><th>作业</th><th>作用设备</th><th>危险源</th><th>票证</th><th>缺失措施</th><th>违规条款</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="dim">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ─────────────── 评级 ───────────────

function renderSafetyAssessment() {
  const el = $('#stab-assessment');
  const a = safetyState.assessment;
  if (!a) {
    el.innerHTML = `<div class="card"><div class="card-body">
      <div class="dim">尚未生成评级快照。</div>
      <div style="margin-top:10px"><button class="btn primary" id="btnAssessInline">运行评级</button></div>
    </div></div>`;
    const btn = $('#btnAssessInline');
    if (btn) btn.addEventListener('click', runSafetyAssessment);
    return;
  }

  const componentRows = a.plant.components.map(c => `<tr>
    <td>${esc(c.label)}</td>
    <td class="num">${safetyScore(c.score)}</td>
    <td class="num">${c.weight}</td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="card">
      <div class="card-head">🏆 厂区安全评级 <span class="spacer"></span><span class="dim">${esc(fmtTime(a.createdAt))} · 模型 ${esc(a.modelVersion)}</span></div>
      <div class="card-body">
        <div class="assessment-summary">
          <div><div class="k-label dim">评级</div><div class="big-grade">${safetyChip(a.plant.grade)}</div></div>
          <div><div class="k-label dim">综合得分</div><div class="big-score">${safetyScore(a.plant.score)}</div></div>
          <div><div class="k-label dim">装置四色</div>
            <div class="tag-line" style="margin-top:6px">
              <span class="mini-tag bad">红 ${a.summary.red}</span>
              <span class="mini-tag" style="color:#d97706;border-color:#d97706">橙 ${a.summary.orange}</span>
              <span class="mini-tag">黄 ${a.summary.yellow}</span>
              <span class="mini-tag good">蓝 ${a.summary.blue}</span>
            </div>
          </div>
          <div><div class="k-label dim">规则命中</div><div class="big-score" style="font-size:22px">${a.ruleHits.length}</div></div>
        </div>
        <table class="safety-table" style="margin-top:12px">
          <thead><tr><th>评分分量</th><th>得分</th><th>权重</th></tr></thead>
          <tbody>${componentRows}</tbody>
        </table>
      </div>
    </div>
    ${safetyScoreTable('区域', a.areas)}
    ${safetyScoreTable('装置', a.units)}
    ${safetyScoreTable('设备', a.equipments)}
    ${safetyScoreTable('作业', a.operations)}`;
}

// ─────────────── 根因 ───────────────

function renderRcaIncidentOptions() {
  const select = $('#rcaIncident');
  if (!select) return;
  const current = select.value;
  select.innerHTML = safetyState.incidents
    .map(i => `<option value="${esc(i.id)}">${esc(i.title)}（${esc(i.occurredAt)}）</option>`)
    .join('') || '<option value="">暂无可分析事件</option>';
  if (current && safetyState.incidents.some(i => i.id === current)) select.value = current;
}

function renderSafetyRca(result) {
  const chainEl = $('#rcaChain');
  const sideEl = $('#rcaSide');
  if (!result) {
    chainEl.innerHTML = '<div class="empty-hint"><div><div class="big">🕸</div>选择事件后生成因果链路</div></div>';
    sideEl.innerHTML = '';
    $('#rcaMeta').textContent = '';
    return;
  }

  renderChain(chainEl, result.graph);
  const incident = safetyState.incidents.find(i => i.id === result.incidentId);
  $('#rcaMeta').textContent = `${incident ? incident.title : result.incidentId} · ${result.graph.nodes.length} 节点 / ${result.graph.edges.length} 边 · 模型 ${result.modelVersion}`;

  const roots = (result.roots || []).map((r, idx) => `<div class="root-item">
    <div class="root-head">
      <span class="root-rank">${idx + 1}</span>
      <span class="root-name">${esc(r.causeLabel)}</span>
      <span class="mini-tag">${esc(r.category)}</span>
    </div>
    <div class="root-meta">
      <span>排序分 <b class="mono">${Number(r.rankScore).toFixed(2)}</b></span>
      <span>路径 ${r.pathCount}</span>
      <span>证据 ${r.evidences.length}</span>
    </div>
    ${r.evidences.length ? `<div class="tag-line" style="margin-top:5px">${r.evidences.map(e => `<span class="mini-tag">${esc(e.text)}</span>`).join('')}</div>` : ''}
  </div>`).join('');

  const recs = (result.recommendations || []).map(rec => `<div class="rec-item">• ${esc(rec.text)}
    ${rec.targetClauseIds && rec.targetClauseIds.length ? `<div class="dim" style="font-size:11px">依据：${esc(rec.targetClauseIds.join('、'))}</div>` : ''}
  </div>`).join('');

  sideEl.innerHTML = `
    <div class="card">
      <div class="card-head">🎯 根因排序 <span class="spacer"></span><span class="dim">${result.roots.length} 项</span></div>
      <div class="card-body tight">${roots || '<div class="card-body dim">未识别到根因</div>'}</div>
    </div>
    <div class="card">
      <div class="card-head">🛠 整改建议</div>
      <div class="card-body tight">${recs || '<div class="card-body dim">暂无建议</div>'}</div>
    </div>
    ${(result.unverified || []).length ? `<div class="warn-box">⚠ ${result.unverified.length} 个原因尚未被事件事实或人工确认支撑，已在图中以 ∘ 标记。</div>` : ''}`;
}

async function loadSafetyChain(refresh) {
  const id = $('#rcaIncident').value;
  if (!id) { toast('请选择事件', 'err'); return; }
  const chainEl = $('#rcaChain');
  chainEl.innerHTML = '<div class="chain-empty">正在生成因果链路…</div>';
  try {
    const result = await api(`/api/safety/incidents/${encodeURIComponent(id)}/chain${refresh ? '?refresh=1' : ''}`);
    safetyState.chain = result;
    renderSafetyRca(result);
  } catch (err) {
    chainEl.innerHTML = `<div class="chain-empty">根因分析失败：${esc(err.message)}</div>`;
  }
}

async function runSafetyAssessment() {
  const btn = $('#btnSafetyAssess');
  btn.disabled = true;
  btn.textContent = '评级中…';
  try {
    const assessment = await api('/api/safety/assess', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save: true }),
    });
    safetyState.assessment = assessment;
    safetyState.overview = await api('/api/safety/overview');
    renderSafetyOverview();
    renderSafetyAssessment();
    switchSafetyTab('assessment');
    toast(`评级完成：厂区 ${SAFETY_GRADE_LABEL[assessment.plant.grade]}级（${assessment.plant.score} 分）`, 'ok');
  } catch (err) {
    toast('评级失败：' + err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚙ 运行评级';
  }
}

async function runSafetyEvaluate() {
  try {
    const result = await api('/api/safety/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const s = result.bySeverity;
    toast(`规则评估：${result.ruleCount} 条规则，命中 ${result.hits.length} 项（致命 ${s.fatal} / 重大 ${s.major} / 一般 ${s.general}）`, 'ok');
  } catch (err) {
    toast('规则评估失败：' + err.message, 'err');
  }
}

// ─────────────── 面板切换与初始化 ───────────────

function switchSafetyTab(name) {
  safetyState.tab = name;
  document.querySelectorAll('#safetyTabs button').forEach(btn =>
    btn.classList.toggle('on', btn.dataset.stab === name));
  document.querySelectorAll('#tab-safety .safety-panel').forEach(panel =>
    panel.classList.toggle('active', panel.id === 'stab-' + name));
  if (name === 'rca') {
    renderRcaIncidentOptions();
    if (safetyState.chain && safetyState.chain.incidentId === $('#rcaIncident').value) {
      renderSafetyRca(safetyState.chain);
    }
  }
}

function renderSafetyAll() {
  const o = safetyState.overview;
  if (o) {
    const c = o.counts || {};
    $('#safetySub').textContent =
      `${o.project || '样例厂区'} · 法规 ${c.SAFETY_REGULATION || 0} 部 / 条款 ${c.SAFETY_CLAUSE || 0} 条 · 设备 ${c.SAFETY_EQUIPMENT || 0} 台 / 作业 ${c.SAFETY_OPERATION || 0} 项 · 区域 ${c.SAFETY_AREA || 0} 个`;
  }
  renderSafetyOverview();
  renderSafetyRegulations();
  renderSafetyAssets();
  renderSafetyOperations();
  renderSafetyAssessment();
  renderRcaIncidentOptions();
  if (safetyState.chain) renderSafetyRca(safetyState.chain);
}

async function initSafety() {
  if (safetyState.loading) return;
  if (!safetyState.loaded) {
    safetyState.loading = true;
    $('#stab-overview').innerHTML = '<div class="empty-hint"><div><div class="big">⏳</div>正在加载安全域数据…</div></div>';
    try {
      const [overview, regulations, assets, operations, rules, incidents, assessments] = await Promise.all([
        api('/api/safety/overview'),
        api('/api/safety/regulations'),
        api('/api/safety/assets'),
        api('/api/safety/operations'),
        api('/api/safety/rules'),
        api('/api/safety/incidents'),
        api('/api/safety/assessments'),
      ]);
      safetyState.overview = overview;
      safetyState.regulations = regulations;
      safetyState.assets = assets;
      safetyState.operations = operations;
      safetyState.rules = rules;
      safetyState.incidents = incidents || [];
      safetyState.assessment = (assessments || [])[0] || null;
      safetyState.loaded = true;
    } catch (err) {
      $('#stab-overview').innerHTML = `<div class="empty-hint">加载失败：${esc(err.message)}</div>`;
      return;
    } finally {
      safetyState.loading = false;
    }
  }
  renderSafetyAll();
}

$('#safetyTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-stab]');
  if (btn) switchSafetyTab(btn.dataset.stab);
});
$('#btnSafetyAssess').addEventListener('click', runSafetyAssessment);
$('#btnSafetyRules').addEventListener('click', runSafetyEvaluate);
$('#btnSafetyRca').addEventListener('click', () => {
  switchSafetyTab('rca');
  if ($('#rcaIncident').value) loadSafetyChain(false);
});
$('#btnRcaRun').addEventListener('click', () => loadSafetyChain(false));
$('#btnRcaRefresh').addEventListener('click', () => loadSafetyChain(true));
