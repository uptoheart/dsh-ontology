/* ═════════════════════════ 全局重绘 + 初始化 ═════════════════════════ */
function renderAll() {
  renderSuites();
  renderCoverage();
  renderTree();
  renderNodeDetail();
  renderEntities();
  buildKindOptions();
  rebuildGraph(true);
  renderOntologyDetail();
}

(async function init() {
  try {
    // 框架轻量清单（用于套件列表框架标签；失败不阻塞初始化）
    try { FW_LIST = await api('/api/frameworks?light=1') || []; } catch { FW_LIST = []; }
    await loadSuites();
    if (state.suites.length === 1) {
      await selectSuite(state.suites[0].suiteId);
    } else {
      updateTabLock();
    }
    // 默认激活面板可能是本体 Tab（导航顺序可在 layout.html 调整），初始时需测量画布并启动模拟
    if ($('#tab-ontology').classList.contains('active')) {
      sizeCanvas();
      ensureSim(false);
    }
  } catch (err) {
    toast('初始化失败：' + err.message, 'err');
    $('#suiteSelect').innerHTML = '<option value="">— 加载失败 —</option>';
  }
})();
