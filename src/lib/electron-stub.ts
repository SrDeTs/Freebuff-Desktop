/**
 * Electron API stub — allows Freebuff Desktop to run in a browser
 * without the Electron preload bridge.
 *
 * Provides sensible defaults / no-ops for every method so the
 * React app renders without crashing.
 */

export type FreebuffAPI = {
  getBootstrap: () => Promise<Bootstrap>
  getSettings: () => Promise<AppSettings>
  saveSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  pickFolder: () => Promise<string | null>
  listChats: () => Promise<ChatItem[]>
  readChat: (projectKey: string, chatId: string) => Promise<FreebuffMessage[]>
  startSession: (opts: {
    cwd: string
    model?: string
    continueId?: string
    sessionId: string
  }) => Promise<SessionInfo>
  writeSession: (sessionId: string, data: string) => Promise<void>
  resizeSession: (sessionId: string, cols: number, rows: number) => Promise<void>
  killSession: (sessionId: string) => Promise<void>
  listSessions: () => Promise<SessionInfo[]>
  openExternal: (url: string) => Promise<void>
  showItem: (p: string) => Promise<void>
  pathExists: (p: string) => Promise<boolean>
  listDirs: (dir: string) => Promise<{ name: string; path: string }[]>
  freebuffLogin: () => Promise<{ ok: boolean; pid?: number }>
  notify: (title: string, body: string) => Promise<boolean>
  manicodePath: () => Promise<string>

  onSessionData: (
    cb: (payload: { sessionId: string; data: string }) => void,
  ) => () => void
  onSessionExit: (
    cb: (payload: { sessionId: string; exitCode: number | null }) => void,
  ) => () => void
  onSessionAd: (
    cb: (payload: { sessionId: string; ad: { text: string; url?: string } }) => void,
  ) => () => void
}

export type Bootstrap = {
  user: { name: string; email: string } | null
  freebuffVersion: string | null
  freebuffBinary: string
  freebuffInstalled: boolean
  recentProjects: { path: string; lastOpened: number }[]
  freebuffSettings: Record<string, unknown>
  appSettings: AppSettings
  chats: ChatItem[]
  homeDir: string
  platform: string
}

export type AppSettings = {
  defaultCwd: string
  model: string
  showTips: boolean
  systemNotifications: boolean
  adsEnabled: boolean
  showTerminalChrome: boolean
}

export type ChatItem = {
  id: string
  projectKey: string
  projectPath: string
  projectName: string
  firstPrompt: string
  messageCount: number
  mtimeMs: number
  relativeAge: string
}

export type FreebuffMessage = {
  id: string
  variant: 'user' | 'ai' | string
  content?: string
  timestamp?: string
  blocks?: FreebuffBlock[]
  metadata?: Record<string, unknown>
}

export type FreebuffBlock = {
  type: string
  content?: string
  toolName?: string
  toolCallId?: string
  input?: unknown
  output?: unknown
  agentName?: string
  agentType?: string
  status?: string
  mode?: string
}

export type SessionInfo = {
  sessionId: string
  cwd: string
  model?: string
  pid: number
  startedAt: number
}

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
  freebuffVersion: '7.0.0',
  freebuffBinary: '/usr/local/bin/freebuff',
  freebuffInstalled: true,
  recentProjects: [],
  freebuffSettings: { adsEnabled: true },
  appSettings: DEFAULT_SETTINGS,
  chats: [],
  homeDir: '/home/user',
  platform: 'web',
}

export function createElectronStub(): FreebuffAPI {
  let settings = { ...DEFAULT_SETTINGS }

  /** Minimal in-memory session simulator */
  let sessions = new Map<string, { id: string; alive: boolean }>()

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
      // In a real browser this could use the File System Access API
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
      // Emit some initial data to make the terminal feel alive
      setTimeout(() => {
        dataListeners.forEach((fn) =>
          fn({ sessionId: opts.sessionId, data: '\r\n⚡ Freebuff agent started (mock mode)\r\n\r\n' }),
        )
        setTimeout(() => {
          dataListeners.forEach((fn) =>
            fn({ sessionId: opts.sessionId, data: 'Type your prompt below or click the terminal.\r\n\n$ ' }),
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
