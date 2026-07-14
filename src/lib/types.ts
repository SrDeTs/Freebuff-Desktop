/**
 * Shared types for the Freebuff Desktop app.
 * Used by electron-stub.ts and the Tauri Rust backend.
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
