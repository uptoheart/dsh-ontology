import type { Context } from '@deepseek-ai/cordis'
import { STYLES, discoverServer } from './client/shared.js'

export const inject: string[] = []

const PLUGIN_ID = 'dsh-ontology'
const PANEL_NAME = 'ontology'
const DEBUG = true

function dbg(...parts: unknown[]): void {
  if (!DEBUG) return
  console.log('[dsh-ontology]', ...parts)
}

interface SlotsServiceFace {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: (props: never) => unknown): () => void
  spec(key: string): unknown
}

interface LayoutServiceFace {
  selectPanel(panelId: null): void
}

interface MountContextFace {
  get?(name: string): unknown
}

function officialSlots(ctx: MountContextFace): SlotsServiceFace | undefined {
  const slots = (ctx.get?.('slots') ?? (ctx as unknown as Record<string, unknown>).slots) as SlotsServiceFace | undefined
  if (slots === undefined || typeof slots.register !== 'function' || typeof slots.inject !== 'function' || typeof slots.spec !== 'function') return undefined
  try {
    if (slots.spec('main') === undefined) return undefined
    if (slots.spec('sidebar.panellist') === undefined) return undefined
  } catch {
    return undefined
  }
  return slots
}

function findSidebarColumn(): HTMLElement | undefined {
  const taskboardExact = document.querySelector<HTMLElement>(
    '[data-pane="sidebar"] [class*="sidebarCol"] .dshDesktopUpstreamSidebar .dshDesktopSidebarSurface',
  )
  if (taskboardExact) {
    dbg('sidebar column found via taskboard-exact selector')
    return taskboardExact
  }

  const selectors = [
    '[data-pane="sidebar"]',
    '[class*="sidebarCol"]',
    '[class*="SidebarCol"]',
    '[class*="sidebar-col"]',
    '[class*="sidebar_column"]',
    '[class*="sideBar"]',
    '[class*="SideBar"]',
    '[class*="leftCol"]',
    '[class*="LeftCol"]',
    '[class*="navCol"]',
    '[class*="NavCol"]',
    '[class*="panelLeft"]',
    '[class*="leftPanel"]',
  ]
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) {
      dbg('sidebar column found via selector:', sel)
      return el
    }
  }

  const body = document.body
  const appRoot = body.querySelector('#root') ?? body.querySelector('#app') ?? body.firstElementChild
  if (appRoot) {
    const firstCol = appRoot.querySelector(':scope > div > div:first-child') as HTMLElement | null
    if (firstCol) {
      const hasButtons = firstCol.querySelectorAll('button').length
      const hasListItems = firstCol.querySelectorAll('[class*="session"], [class*="Session"], [class*="project"], [class*="Project"]').length
      if (hasButtons > 0 || hasListItems > 0) {
        dbg('sidebar column found via layout heuristic (first child of app root)')
        return firstCol
      }
    }
  }

  dbg('sidebar column NOT found')
  return undefined
}

function sidebarRoot(): HTMLElement | undefined {
  const column = findSidebarColumn()
  if (!column) return undefined

  const logoRowSelectors = [
    '[class*="logoRow"]',
    '[class*="LogoRow"]',
    '[class*="logo-row"]',
    '[class*="headerRow"]',
    '[class*="HeaderRow"]',
    '[class*="topRow"]',
    '[class*="TopRow"]',
    '[class*="actionBar"]',
    '[class*="ActionBar"]',
  ]
  for (const sel of logoRowSelectors) {
    const logoEl = column.querySelector<HTMLElement>(sel)
    if (logoEl?.parentElement) {
      dbg('sidebar root found via logoRow selector:', sel)
      return logoEl.parentElement
    }
  }

  const firstChild = column.firstElementChild as HTMLElement | undefined
  if (firstChild) {
    dbg('sidebar root fallback: column.firstElementChild')
  }
  return firstChild
}

function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const classSelectors = [
    'button[class*="newSession"]',
    'button[class*="NewSession"]',
    'button[class*="new-session"]',
    'button[class*="newChat"]',
    'button[class*="NewChat"]',
    'button[class*="new-chat"]',
    'button[class*="addSession"]',
    'button[class*="AddSession"]',
    'button[class*="createSession"]',
  ]
  for (const sel of classSelectors) {
    const btn = root.querySelector<HTMLButtonElement>(sel)
    if (btn) {
      dbg('newSession button found via selector:', sel)
      return btn
    }
  }

  const textPatterns = ['新会话', '新建会话', '新对话', 'new session', 'new chat', 'new conversation']
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
  for (const btn of allButtons) {
    const text = (btn.textContent || '').trim().toLowerCase()
    const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase()
    const title = (btn.getAttribute('title') || '').trim().toLowerCase()
    for (const pattern of textPatterns) {
      const lp = pattern.toLowerCase()
      if (text.includes(lp) || ariaLabel.includes(lp) || title.includes(lp)) {
        dbg('newSession button found via text match:', pattern)
        return btn
      }
    }
  }

  for (const child of Array.from(root.children)) {
    if (child.tagName === 'BUTTON') {
      dbg('newSession button fallback: first BUTTON child')
      return child as HTMLButtonElement
    }
  }

  const anyButton = root.querySelector<HTMLButtonElement>('button')
  if (anyButton) {
    dbg('newSession button fallback: any button in root')
    return anyButton
  }

  dbg('newSession button NOT found in root, children:', root.children.length, Array.from(root.children).map(c => c.tagName + '.' + (c as HTMLElement).className?.slice(0, 30)))
  return undefined
}

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"], .dshDesktopConversationSurface'

function centerColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

const ACTIVE_ATTR = 'data-dsh-ontology-active'
const OTHER_ACTIVE_ATTRS = ['data-dsh-ssh-active', 'data-dsh-atb-active']
const ACTIVATE_EVENT = 'dsh-panel-activate'

let panelContainer: HTMLDivElement | undefined
let panelIframe: HTMLIFrameElement | undefined
let panelOpen = false
let serverBaseUrl = ''

function isPanelOpen(): boolean {
  return document.documentElement.hasAttribute(ACTIVE_ATTR)
}

function closePanel(): void {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  panelOpen = false
  document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: '' }))
}

function openPanel(): void {
  ensurePanelMounted()
  for (const attr of OTHER_ACTIVE_ATTRS) document.documentElement.removeAttribute(attr)
  document.documentElement.setAttribute(ACTIVE_ATTR, '')
  panelOpen = true
  document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
}

const DSW_VARS = [
  '--dsw-bg', '--dsw-bg-elevated', '--dsw-bg-inset', '--dsw-bg-panel',
  '--dsw-border', '--dsw-border-strong',
  '--dsw-text-primary', '--dsw-text-secondary',
  '--dsw-hover', '--dsw-active',
  '--dsw-alias-brand-primary', '--dsw-alias-label-primary', '--dsw-alias-label-primary-foreground',
  '--dsw-alias-label-secondary', '--dsw-alias-button-primary-fill',
  '--dsw-alias-bg-module-platform', '--dsw-alias-bg-overlay',
  '--dsw-alias-state-error-primary', '--dsw-alias-border-l2',
]

function injectThemeToIframe(iframe: HTMLIFrameElement): void {
  try {
    const doc = iframe.contentDocument
    if (!doc || !doc.documentElement) return
    const parentStyle = getComputedStyle(document.documentElement)
    const pairs: string[] = []
    for (const v of DSW_VARS) {
      const val = parentStyle.getPropertyValue(v).trim()
      if (val) pairs.push(`${v}: ${val}`)
    }
    if (pairs.length === 0) return
    const style = doc.createElement('style')
    style.textContent = `:root { ${pairs.join('; ')}; }`
    doc.documentElement.prepend(style)
    const dsTheme = document.documentElement.getAttribute('data-ds-theme')
      ?? document.body.getAttribute('data-ds-theme')
    if (dsTheme) doc.documentElement.setAttribute('data-theme', dsTheme)
    const isDark = document.documentElement.getAttribute('data-ds-dark-theme') !== null
      || document.body.getAttribute('data-ds-dark-theme') !== null
    if (isDark) doc.documentElement.setAttribute('data-theme', 'dark')
  } catch { /* cross-origin */ }
}

function ensurePanelMounted(): void {
  if (panelContainer?.isConnected) return
  const column = centerColumn()
  if (!column) {
    dbg('ensurePanelMounted: center column not found yet')
    return
  }
  if (panelContainer) { panelContainer.remove(); panelContainer = undefined; panelIframe = undefined }

  panelContainer = document.createElement('div')
  panelContainer.dataset.dshOntologyView = ''
  panelContainer.dataset.dshPlugin = PLUGIN_ID
  panelContainer.className = 'dsh-ont-view'

  panelIframe = document.createElement('iframe')
  panelIframe.style.cssText = 'width:100%;height:100%;border:0;display:block;'
  panelIframe.title = 'Ontology'
  if (serverBaseUrl) panelIframe.src = serverBaseUrl
  panelIframe.addEventListener('load', () => injectThemeToIframe(panelIframe!))

  panelContainer.appendChild(panelIframe)
  column.appendChild(panelContainer)
  dbg('panel container mounted in center column')
}

const ENTRY_ATTR = 'data-dsh-ontology-entry'
const ENTRY_SELECTOR = `[${ENTRY_ATTR}]`

function createSidebarEntry(): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_ATTR, '')
  entry.className = 'dsh-ont-entry'
  entry.setAttribute('data-dsh-plugin', PLUGIN_ID)
  entry.setAttribute('data-dsh-part', 'sidebar-entry')
  entry.innerHTML = '<span class="dsh-ont-entry-icon"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="3" cy="4" r="1.5"/><circle cx="13" cy="4" r="1.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="13" cy="12" r="1.5"/><path d="M8 8 L3 4 M8 8 L13 4 M8 8 L3 12 M8 8 L13 12"/></svg></span><span class="ont-sidebar-label">Ontology</span>'
  entry.title = 'Ontology'
  entry.setAttribute('aria-label', 'Ontology')

  entry.addEventListener('click', () => {
    if (isPanelOpen()) {
      closePanel()
      delete entry.dataset.active
    } else {
      openPanel()
      if (panelIframe && serverBaseUrl && panelIframe.src !== serverBaseUrl) {
        panelIframe.src = serverBaseUrl
      }
      entry.dataset.active = 'true'
    }
  })

  return entry
}

function injectSidebarEntry(): void {
  const column = findSidebarColumn()
  if (!column) {
    dbg('injectSidebarEntry: sidebar column not found, skipping')
    return
  }

  if (column.querySelector(ENTRY_SELECTOR)) {
    dbg('injectSidebarEntry: entry already exists')
    return
  }

  const root = sidebarRoot()
  const entry = createSidebarEntry()

  if (root) {
    const btn = newSessionButton(root)
    if (btn) {
      const family = Array.from(root.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-ontology-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
      )
      const anchor = family.length > 0 ? (family[0] ?? null) : (btn.nextElementSibling ?? null)
      if (anchor) root.insertBefore(entry, anchor)
      else root.appendChild(entry)
      dbg('injectSidebarEntry: entry inserted in family block')
      return
    }

    root.insertAdjacentElement('afterbegin', entry)
    dbg('injectSidebarEntry: entry prepended to sidebar root (no newSession button)')
    return
  }

  column.insertAdjacentElement('afterbegin', entry)
  dbg('injectSidebarEntry: entry prepended to sidebar column (no root)')
}

function mountLegacy(): () => void {
  console.info('[dsh-ontology] mountLegacy: starting')
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  document.querySelectorAll<HTMLElement>('[data-dsh-ontology-entry], .dsh-ont-entry').forEach((old) => {
    old.remove()
  })

  const entry = createSidebarEntry()
  let placed = false
  let root: HTMLElement | undefined

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      root = undefined
      placed = false
    }
    if (placed && document.body.contains(entry)) return
    root ??= sidebarRoot()
    if (root === undefined) {
      const column = findSidebarColumn()
      if (column) {
        if (!column.querySelector(ENTRY_SELECTOR)) {
          column.insertAdjacentElement('afterbegin', entry)
          placed = true
        }
      }
      return
    }
    const btn = newSessionButton(root)
    if (btn === undefined) return
    if (entry.parentElement !== root) {
      const family = Array.from(root.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-ontology-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
      )
      const anchor = family.length > 0 ? (family[0] ?? null) : (btn.nextElementSibling ?? null)
      if (anchor) root.insertBefore(entry, anchor)
      else root.appendChild(entry)
    }
    placed = true
  }

  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root, entry)
    }
  })

  const retry = setInterval(() => { tryPlace() }, 2_000)

  const syncActive = (): void => {
    if (panelOpen) entry.dataset.active = 'true'
    else delete entry.dataset.active
  }

  const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"], [data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-plugin]'
  const onClickSidebarRow = (event: MouseEvent): void => {
    if (!panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest(ENTRY_SELECTOR) !== null) return
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) {
      closePanel()
      syncActive()
      return
    }
    const sidebar = findSidebarColumn()
    if (sidebar && sidebar.contains(target)) {
      closePanel()
      syncActive()
    }
  }
  const onOtherActivate = (event: Event): void => {
    const detail = (event as CustomEvent).detail
    if (detail === PANEL_NAME || detail === '') return
    if (panelOpen) closePanel()
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    syncActive()
  }

  document.addEventListener('click', onClickSidebarRow, true)
  document.addEventListener(ACTIVATE_EVENT, onOtherActivate)

  const htmlAttrObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'attributes') continue
      if (m.attributeName === ACTIVE_ATTR) continue
      if (m.attributeName?.startsWith('data-dsh-') && m.attributeName.endsWith('-active')) {
        if (document.documentElement.hasAttribute(m.attributeName)) {
          dbg('other plugin activated via attr:', m.attributeName, '— clearing our active attr')
          if (panelOpen) closePanel()
          document.documentElement.removeAttribute(ACTIVE_ATTR)
          syncActive()
        }
      }
    }
  })
  htmlAttrObserver.observe(document.documentElement, { attributes: true })

  const panelObserver = new MutationObserver(() => {
    if (panelOpen) ensurePanelMounted()
  })
  panelObserver.observe(document.body, { childList: true, subtree: true })

  tryPlace()
  syncActive()

  return () => {
    clearInterval(retry)
    waitObserver.disconnect()
    rootObserver.disconnect()
    panelObserver.disconnect()
    htmlAttrObserver.disconnect()
    document.removeEventListener('click', onClickSidebarRow, true)
    document.removeEventListener(ACTIVATE_EVENT, onOtherActivate)
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    entry.remove()
  }
}

function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-ontology-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
    )
    const anchor = family.length > 0 ? (family[0] ?? null) : (button.nextElementSibling ?? null)
    if (anchor) root.insertBefore(entry, anchor)
    else root.appendChild(entry)
  }
  return true
}

const OFFICIAL_PANEL_ID = 'dsh-ontology'
const PANEL_ROW_ORDER = 20

type ReactNode = unknown
type ReactFC = (props: never) => ReactNode

interface ReactLike {
  createElement(type: string | unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown
  useCallback<T>(callback: T, deps: unknown[]): T
}

function getReact(): ReactLike | undefined {
  const anyWin = window as unknown as Record<string, unknown>
  const R = (anyWin.__dshReact ?? anyWin.React ?? anyWin.__REACT__) as Partial<ReactLike> | undefined
  if (R && typeof R.createElement === 'function' && typeof R.useCallback === 'function') return R as ReactLike
  return undefined
}

function makePanelPage(): ReactFC {
  return function OntologyPanelPage(): ReactNode {
    const React = getReact()
    if (!React) return null
    const iframeRef = React.useCallback((el: HTMLIFrameElement | null) => {
      if (el && serverBaseUrl && el.src !== serverBaseUrl) el.src = serverBaseUrl
      if (el) el.addEventListener('load', () => injectThemeToIframe(el))
    }, [])
    return React.createElement(
      'div',
      { 'data-dsh-ontology-view': '', 'data-dsh-plugin': PLUGIN_ID, className: 'dsh-ont-view', style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } },
      React.createElement('iframe', { ref: iframeRef, style: { width: '100%', height: '100%', border: 0, display: 'block', flex: 1 }, title: 'Ontology' }),
    )
  }
}

function makePanelIcon(): ReactFC {
  return function OntologyPanelIcon(): ReactNode {
    const React = getReact()
    if (!React) return null
    return React.createElement(
      'span',
      { className: 'dsh-ont-pglyph' },
      React.createElement(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        React.createElement('circle', { cx: 8, cy: 8, r: 2 }),
        React.createElement('circle', { cx: 3, cy: 4, r: 1.5 }),
        React.createElement('circle', { cx: 13, cy: 4, r: 1.5 }),
        React.createElement('circle', { cx: 3, cy: 12, r: 1.5 }),
        React.createElement('circle', { cx: 13, cy: 12, r: 1.5 }),
        React.createElement('path', { d: 'M8 8 L3 4 M8 8 L13 4 M8 8 L3 12 M8 8 L13 12' }),
      ),
    )
  }
}

function tryRegisterOfficial(slots: SlotsServiceFace, ctx: MountContextFace): (() => void) | undefined {
  const React = getReact()
  if (!React) {
    console.info('[dsh-ontology] official path: React not available')
    return undefined
  }
  const disposers: Array<() => void> = []
  try {
    const layout = (ctx.get?.('layout') ?? (ctx as unknown as Record<string, unknown>).layout) as LayoutServiceFace | undefined
    console.info('[dsh-ontology] official path: layout service =', !!layout)

    const page = makePanelPage() as unknown as ReactFC
    disposers.push(slots.inject('main', () => slots.register(
      { name: 'main', key: OFFICIAL_PANEL_ID },
      page,
    )))

    const icon = makePanelIcon() as unknown as ReactFC
    disposers.push(slots.inject('sidebar.panellist', () => slots.register(
      { name: 'sidebar.panellist', id: OFFICIAL_PANEL_ID, order: PANEL_ROW_ORDER, label: () => 'Ontology' },
      icon,
    )))
    console.info('[dsh-ontology] official panel mode: registered', OFFICIAL_PANEL_ID)
  } catch (error) {
    console.error('[dsh-ontology] official registration failed — falling back to legacy:', error)
    for (const dispose of disposers.splice(0)) dispose()
    return undefined
  }
  return () => { for (const dispose of disposers.splice(0)) dispose() }
}

const PROBE_ROUNDS = 3
const PROBE_INTERVAL_MS = 350

function mountPanelCompat(ctx: MountContextFace): () => void {
  const slots = officialSlots(ctx)
  console.info('[dsh-ontology] mountPanelCompat: slots available =', !!slots)
  if (slots !== undefined) {
    const dispose = tryRegisterOfficial(slots, ctx)
    if (dispose !== undefined) {
      console.info('[dsh-ontology] → using OFFICIAL path')
      return dispose
    }
  }

  console.info('[dsh-ontology] → using LEGACY path (slots unavailable or registration failed)')
  let legacyDisposer: (() => void) | undefined = mountLegacy()

  let round = 0
  let upgraded: (() => void) | undefined
  const timer = setInterval(() => {
    round++
    const probed = officialSlots(ctx)
    if (probed !== undefined) {
      const dispose = tryRegisterOfficial(probed, ctx)
      if (dispose !== undefined) {
        upgraded = dispose
        legacyDisposer?.()
        legacyDisposer = undefined
        clearInterval(timer)
        console.info('[dsh-ontology] → UPGRADED from legacy to official')
        return
      }
    }
    if (round >= PROBE_ROUNDS) {
      clearInterval(timer)
    }
  }, PROBE_INTERVAL_MS)
  return () => {
    clearInterval(timer)
    legacyDisposer?.()
    upgraded?.()
  }
}

declare global { var __dshOntologyApplied: boolean | undefined }

export function apply(ctx: Context): void {
  if (typeof document === 'undefined') return
  if (globalThis.__dshOntologyApplied) return
  globalThis.__dshOntologyApplied = true

  const mountCtx = ctx as unknown as MountContextFace

  async function init(): Promise<void> {
    serverBaseUrl = await discoverServer()
    if (!serverBaseUrl) {
      console.warn('[dsh-ontology] cannot connect to host server, panel iframe unavailable')
    }

    dbg('serverBaseUrl:', serverBaseUrl || '(empty)')

    const styleEl = document.createElement('style')
    styleEl.id = 'dsh-ontology-styles'
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)

    const disposer = mountPanelCompat(mountCtx)

    const themeObserver = new MutationObserver(() => {
      if (panelIframe) injectThemeToIframe(panelIframe)
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ds-theme', 'data-ds-dark-theme', 'class', 'style'] })
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-theme', 'data-ds-dark-theme', 'class', 'style'] })

    const globalAttrObserver = new MutationObserver(() => {
      if (!panelOpen && document.documentElement.hasAttribute(ACTIVE_ATTR)) {
        document.documentElement.removeAttribute(ACTIVE_ATTR)
      }
    })
    globalAttrObserver.observe(document.documentElement, { attributes: true, attributeFilter: [ACTIVE_ATTR] })

    ;(ctx as unknown as { effect?: (fn: () => () => void, label?: string) => void }).effect?.(() => {
      const cleanup = () => { disposer(); globalAttrObserver.disconnect(); themeObserver.disconnect() }
      return cleanup
    }, 'dsh-ontology: client mount')
  }

  init().catch((err) => console.error('[dsh-ontology] init failed:', err))
}