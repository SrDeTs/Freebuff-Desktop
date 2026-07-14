/**
 * Freebuff API bridge — detects if running inside Tauri or a browser.
 *
 * In Tauri: calls real Rust commands via invoke() and uses @tauri-apps/plugin-* APIs.
 * In browser: falls back to the mock stub so the app renders without crashing.
 */

import type {
  FreebuffAPI,
  Bootstrap,
  AppSettings,
  ChatItem,
  FreebuffMessage,
  SessionInfo,
} from './types'

// ─── Tauri Detection ───────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ─── Browser/Webkit helpers ────────────────────────────────────────────────

function isWebKit(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /AppleWebKit/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent)
  )
}

// ─── Tauri Implementation ──────────────────────────────────────────────────

async function createTauriAPI(): Promise<FreebuffAPI> {
  // Dynamic imports — these only load inside Tauri
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const { open } = await import('@tauri-apps/plugin-shell')
  const { open: dialogOpen } = await import('@tauri-apps/plugin-dialog')

  const unlisteners: (() => void)[] = []

  return {
    async getBootstrap() {
      return invoke<Bootstrap>('get_bootstrap')
    },

    async getSettings() {
      return invoke<AppSettings>('get_settings')
    },

    async saveSettings(partial: Partial<AppSettings>) {
      return invoke<AppSettings>('save_settings', {
        partial: {
          default_cwd: partial.defaultCwd ?? '',
          model: partial.model ?? '',
          show_tips: partial.showTips ?? true,
          system_notifications: partial.systemNotifications ?? false,
          ads_enabled: partial.adsEnabled ?? true,
          show_terminal_chrome: partial.showTerminalChrome ?? true,
        },
      })
    },

    async pickFolder() {
      try {
        const selected = await dialogOpen({
          directory: true,
          multiple: false,
          title: 'Open Repository',
        })
        return selected || null
      } catch {
        return null
      }
    },

    async listChats() {
      return invoke<ChatItem[]>('list_chats')
    },

    async readChat(projectKey: string, chatId: string) {
      return invoke<FreebuffMessage[]>('read_chat', { projectKey, chatId })
    },

    async startSession(opts) {
      return invoke<SessionInfo>('start_session', {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        model: opts.model ?? null,
        continueId: opts.continueId ?? null,
      })
    },

    async writeSession(sessionId: string, data: string) {
      await invoke('write_session', { sessionId, data })
    },

    async resizeSession(_sessionId: string, _cols: number, _rows: number) {
      // PTY resize is handled internally by the Freebuff CLI
    },

    async killSession(sessionId: string) {
      await invoke('kill_session', { sessionId })
    },

    async listSessions() {
      return invoke<SessionInfo[]>('list_sessions')
    },

    async openExternal(url: string) {
      try {
        await open(url)
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },

    async showItem(p: string) {
      // Open the parent directory in the file manager
      const parent = p.substring(0, p.lastIndexOf('/')) || p
      try {
        await open(parent)
      } catch {
        // no-op
      }
    },

    async pathExists(p: string) {
      return invoke<boolean>('path_exists', { p })
    },

    async listDirs(dir: string) {
      return invoke<{ name: string; path: string }[]>('list_dirs', { dir })
    },

    async freebuffLogin() {
      try {
        await invoke('freebuff_login')
        // Wait a moment for the browser-based OAuth to open
        return { ok: true }
      } catch {
        return { ok: false }
      }
    },

    async notify(_title: string, _body: string) {
      return false
    },

    async manicodePath() {
      return invoke<string>('manicode_path')
    },

    onSessionData(cb) {
      let unlisten: (() => void) | undefined
      listen<{ sessionId: string; data: string }>('session:data', (event) => {
        cb(event.payload)
      }).then((fn) => {
        unlisten = fn
      })
      return () => {
        unlisten?.()
      }
    },

    onSessionExit(cb) {
      let unlisten: (() => void) | undefined
      listen<{ sessionId: string; exitCode: number | null }>('session:exit', (event) => {
        cb(event.payload)
      }).then((fn) => {
        unlisten = fn
      })
      return () => {
        unlisten?.()
      }
    },

    onSessionAd(cb) {
      let unlisten: (() => void) | undefined
      listen<{ sessionId: string; ad: { text: string; url?: string } }>('session:ad', (event) => {
        cb(event.payload)
      }).then((fn) => {
        unlisten = fn
      })
      return () => {
        unlisten?.()
      }
    },
  }
}

// ─── Mock Implementation (browser fallback) ────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  defaultCwd: '/home/user/projects',
  model: 'minimax/minimax-m3',
  showTips: true,
  systemNotifications: false,
  adsEnabled: true,
  showTerminalChrome: true,
}

const DEFAULT_BOOT: Bootstrap = {
  user: { name: 'Guest', email: '' },
  freebuffVersion: null,
  freebuffBinary: '/usr/local/bin/freebuff',
  freebuffInstalled: false,
  recentProjects: [],
  freebuffSettings: {},
  appSettings: DEFAULT_SETTINGS,
  chats: [],
  homeDir: '/home/user',
  platform: 'web',
}

function createMockAPI(): FreebuffAPI {
  let settings = { ...DEFAULT_SETTINGS }
  const sessions = new Map<string, { id: string; alive: boolean }>()
  const dataListeners = new Set<(p: { sessionId: string; data: string }) => void>()
  const exitListeners = new Set<(p: { sessionId: string; exitCode: number | null }) => void>()
  const adListeners = new Set<(p: { sessionId: string; ad: { text: string; url?: string } }) => void>()

  return {
    async getBootstrap() {
      return { ...DEFAULT_BOOT, appSettings: { ...settings } }
    },
    async getSettings() {
      return { ...settings }
    },
    async saveSettings(partial: Partial<AppSettings>) {
      settings = { ...settings, ...partial }
      return { ...settings }
    },
    async pickFolder() {
      return null
    },
    async listChats() {
      return []
    },
    async readChat(_projectKey: string, _chatId: string) {
      return []
    },
    async startSession(opts) {
      sessions.set(opts.sessionId, { id: opts.sessionId, alive: true })
      setTimeout(() => {
        dataListeners.forEach((fn) =>
          fn({
            sessionId: opts.sessionId,
            data: '\r\n⚡ Freebuff agent started (mock mode)\r\n\r\n',
          }),
        )
        setTimeout(() => {
          dataListeners.forEach((fn) =>
            fn({
              sessionId: opts.sessionId,
              data: 'Type your prompt below or click the terminal.\r\n\n$ ',
            }),
          )
        }, 800)
      }, 400)
      return {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        model: opts.model,
        pid: Math.floor(Math.random() * 100000),
        startedAt: Date.now(),
      }
    },
    async writeSession(_sessionId: string, _data: string) {
      // no-op in mock mode
    },
    async resizeSession(_sessionId: string, _cols: number, _rows: number) {
      // no-op
    },
    async killSession(sessionId: string) {
      sessions.delete(sessionId)
      exitListeners.forEach((fn) => fn({ sessionId, exitCode: 0 }))
    },
    async listSessions() {
      return [...sessions.values()].map((s) => ({
        sessionId: s.id,
        cwd: '',
        pid: 0,
        startedAt: Date.now(),
      }))
    },
    async openExternal(url: string) {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    async showItem(_p: string) {
      // no-op
    },
    async pathExists(_p: string) {
      return false
    },
    async listDirs(_dir: string) {
      return []
    },
    async freebuffLogin() {
      return { ok: false }
    },
    async notify(_title: string, _body: string) {
      return false
    },
    async manicodePath() {
      return '/home/user/.config/manicode'
    },
    onSessionData(cb) {
      dataListeners.add(cb)
      return () => dataListeners.delete(cb)
    },
    onSessionExit(cb) {
      exitListeners.add(cb)
      return () => exitListeners.delete(cb)
    },
    onSessionAd(cb) {
      adListeners.add(cb)
      return () => adListeners.delete(cb)
    },
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

export async function createElectronStub(): Promise<FreebuffAPI> {
  if (isTauri()) {
    try {
      return await createTauriAPI()
    } catch (e) {
      console.warn('Tauri API init failed, falling back to mock:', e)
      return createMockAPI()
    }
  }
  return createMockAPI()
}
