const SERVER_BASE_PORT = 17320
const SERVER_PORT_RANGE = 10

export async function discoverServer(): Promise<string> {
  for (let port = SERVER_BASE_PORT; port < SERVER_BASE_PORT + SERVER_PORT_RANGE; port++) {
    try {
      const url = `http://127.0.0.1:${port}`
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 1500)
      const res = await fetch(`${url}/`, { method: 'GET', signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) return url
    } catch { /* try next port */ }
  }
  return ''
}

export const STYLES = `
.dsh-ont-entry, [data-dsh-ontology-entry] {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  position: relative !important;
  text-align: left !important;
  width: calc(100% - 8px) !important;
  margin: 2px 4px !important;
  padding: 6px 10px !important;
  border: none !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: var(--dsw-text-secondary, inherit) !important;
  font: inherit !important;
  font-size: 13px !important;
  cursor: pointer !important;
  box-shadow: none !important;
  outline: none !important;
  text-shadow: none !important;
  justify-items: inherit !important;
}
.dsh-ont-entry:hover, [data-dsh-ontology-entry]:hover {
  background: var(--dsw-hover, rgba(128,128,128,.12)) !important;
  color: var(--dsw-text-primary, inherit) !important;
}
.dsh-ont-entry[data-active="true"], [data-dsh-ontology-entry][data-active="true"] {
  background: var(--dsw-active, rgba(128,128,128,.18)) !important;
  color: var(--dsw-text-primary, inherit) !important;
  font-weight: 500 !important;
}
.dsh-ont-entry svg, [data-dsh-ontology-entry] svg {
  flex: none !important;
  display: block !important;
}
.dsh-ont-entry .dsh-ont-entry-icon, [data-dsh-ontology-entry] .dsh-ont-entry-icon {
  display: inline-flex !important;
  align-items: center !important;
  flex: none !important;
}
.dsh-ont-entry .ont-sidebar-label, [data-dsh-ontology-entry] .ont-sidebar-label {
  white-space: nowrap !important;
  max-width: 200px !important;
  overflow: hidden !important;
  text-align: left !important;
}

[data-sidebar-collapsed] .dsh-ont-entry,
[data-sidebar-collapsed] [data-dsh-ontology-entry],
[class*="_collapsed"] .dsh-ont-entry,
[class*="_collapsed"] [data-dsh-ontology-entry] {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  margin: 0 0 12px !important;
  padding: 0 !important;
  justify-content: center !important;
  gap: 0 !important;
  text-align: center !important;
}
[data-sidebar-collapsed] .dsh-ont-entry .ont-sidebar-label,
[data-sidebar-collapsed] [data-dsh-ontology-entry] .ont-sidebar-label,
[class*="_collapsed"] .dsh-ont-entry .ont-sidebar-label,
[class*="_collapsed"] [data-dsh-ontology-entry] .ont-sidebar-label { display: none !important; }
[data-sidebar-collapsed] .dsh-ont-entry svg,
[data-sidebar-collapsed] [data-dsh-ontology-entry] svg,
[class*="_collapsed"] .dsh-ont-entry svg,
[class*="_collapsed"] [data-dsh-ontology-entry] svg { width: 16px !important; height: 16px !important; }

.dsh-ont-pglyph { display: inline-flex !important; align-items: center !important; }
button[class*="panelRow"]:has(.dsh-ont-pglyph) {
  position: relative !important;
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
  text-align: left !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  font: inherit !important;
  color: var(--dsw-text-secondary, inherit) !important;
}
button[class*="panelRow"][data-active]:has(.dsh-ont-pglyph),
button[class*="panelRow"]:has(.dsh-ont-pglyph):hover {
  background: var(--dsw-hover, rgba(128,128,128,.12)) !important;
  color: var(--dsw-text-primary, inherit) !important;
}

[data-sidebar-collapsed] button[class*="panelRow"]:has(.dsh-ont-pglyph),
[class*="_collapsed"] button[class*="panelRow"]:has(.dsh-ont-pglyph) {
  justify-content: center !important;
  text-align: center !important;
  padding: 0 !important;
}
[data-sidebar-collapsed] button[class*="panelRow"]:has(.dsh-ont-pglyph) svg,
[class*="_collapsed"] button[class*="panelRow"]:has(.dsh-ont-pglyph) svg {
  width: 16px !important;
  height: 16px !important;
}

html[data-dsh-ontology-active] [data-pane="conversation"] > *:not([data-dsh-ontology-view]),
html[data-dsh-ontology-active] [class*="centerCol"] > *:not([data-dsh-ontology-view]),
html[data-dsh-ontology-active] .dshDesktopConversationSurface > *:not([data-dsh-ontology-view]) {
  display: none !important;
}
.dsh-ont-view, [data-dsh-ontology-view] { display: none; }
html[data-dsh-ontology-active] .dsh-ont-view,
html[data-dsh-ontology-active] [data-dsh-ontology-view] {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}
`