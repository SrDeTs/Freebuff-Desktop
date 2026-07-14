import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar, { type ChatItem } from './components/Sidebar'
import Composer from './components/Composer'
import SettingsView from './components/Settings'
import TerminalView from './components/Terminal'
import AdBanner from './components/AdBanner'
import ChatTranscript, { type FreebuffMessage } from './components/ChatTranscript'
import { pickFallbackAd, type SponsorAd } from './lib/ads'
import { modelLabel } from './lib/models'

type AppSettings = {
  defaultCwd: string
  model: string
  showTips: boolean
  systemNotifications: boolean
  adsEnabled: boolean
  showTerminalChrome: boolean
}

type Bootstrap = {
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

type View = 'home' | 'history' | 'live' | 'settings'

function basename(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

function newId() {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [chats, setChats] = useState<ChatItem[]>([])
  const [projectPath, setProjectPath] = useState('')
  const [model, setModel] = useState('minimax/minimax-m3')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionAlive, setSessionAlive] = useState(false)
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null)
  const [messages, setMessages] = useState<FreebuffMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [ad, setAd] = useState<SponsorAd | null>(null)
  const [adDismissed, setAdDismissed] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [showTerm, setShowTerm] = useState(true)

  const refreshChats = useCallback(async () => {
    const list = (await window.freebuff.listChats()) as ChatItem[]
    setChats(list)
    return list
  }, [])

  const loadMessages = useCallback(async (chat: ChatItem) => {
    setMessagesLoading(true)
    try {
      const msgs = (await window.freebuff.readChat(
        chat.projectKey,
        chat.id,
      )) as FreebuffMessage[]
      setMessages(Array.isArray(msgs) ? msgs : [])
    } catch (e) {
      setMessages([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const b = (await window.freebuff.getBootstrap()) as Bootstrap
        if (cancelled) return
        setBoot(b)
        setSettings(b.appSettings)
        setChats(b.chats)
        const cwd =
          b.appSettings.defaultCwd || b.recentProjects[0]?.path || b.homeDir
        setProjectPath(cwd)
        const m =
          b.appSettings.model ||
          (b.freebuffSettings.freebuffModel as string) ||
          'minimax/minimax-m3'
        setModel(m)
        setShowTerm(b.appSettings.showTerminalChrome !== false)
        if (b.appSettings.adsEnabled !== false) setAd(pickFallbackAd())
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.freebuff.onSessionAd(({ ad: live }) => {
      setAd({
        id: `live-${Date.now()}`,
        brand: 'Sponsored',
        text: live.text,
        url: live.url || 'https://freebuff.com',
      })
      setAdDismissed(false)
    })
  }, [])

  useEffect(() => {
    return window.freebuff.onSessionExit(async ({ sessionId: id }) => {
      if (id !== sessionId) return
      setSessionAlive(false)
      const list = await refreshChats()
      if (settings?.systemNotifications) {
        window.freebuff.notify('Freebuff', 'Agent session finished')
      }
      // Prefer newest chat for this project
      const match =
        list.find(
          (c) =>
            c.projectPath === projectPath ||
            c.projectName === basename(projectPath),
        ) || list[0]
      if (match) {
        setActiveChat(match)
        await loadMessages(match)
        setView('history')
      }
    })
  }, [sessionId, refreshChats, settings?.systemNotifications, projectPath, loadMessages])

  useEffect(() => {
    if (view !== 'home' || !settings?.adsEnabled) return
    const t = setInterval(() => {
      setAd(pickFallbackAd(Date.now()))
      setAdDismissed(false)
    }, 90000)
    return () => clearInterval(t)
  }, [view, settings?.adsEnabled])

  // Poll history while viewing a chat (Freebuff may still be writing)
  useEffect(() => {
    if (view !== 'history' || !activeChat) return
    const t = setInterval(() => {
      loadMessages(activeChat)
      refreshChats()
    }, 4000)
    return () => clearInterval(t)
  }, [view, activeChat, loadMessages, refreshChats])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === ',') {
        e.preventDefault()
        setView('settings')
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        goHome()
      }
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape' && searchOpen) setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const projectName = useMemo(
    () => (projectPath ? basename(projectPath) : 'Select project'),
    [projectPath],
  )

  const saveSettings = async (partial: Partial<AppSettings>) => {
    const next = (await window.freebuff.saveSettings(partial)) as AppSettings
    setSettings(next)
    if (partial.model) setModel(partial.model)
    if (partial.defaultCwd) setProjectPath(partial.defaultCwd)
    if (partial.showTerminalChrome !== undefined) setShowTerm(partial.showTerminalChrome)
  }

  const pickProject = async () => {
    const p = await window.freebuff.pickFolder()
    if (p) {
      setProjectPath(p)
      await saveSettings({ defaultCwd: p })
    }
  }

  const goHome = async () => {
    if (sessionId) {
      try {
        await window.freebuff.killSession(sessionId)
      } catch {
        /* ignore */
      }
    }
    setSessionId(null)
    setSessionAlive(false)
    setActiveChat(null)
    setMessages([])
    setView('home')
    refreshChats()
  }

  const startAgent = async (prompt?: string, continueId?: string) => {
    if (!boot?.freebuffInstalled) {
      setError('Freebuff CLI not installed. Run: npm install -g freebuff')
      return
    }
    if (!projectPath) {
      await pickProject()
      return
    }
    setStarting(true)
    setError(null)
    const id = newId()
    try {
      await window.freebuff.startSession({
        sessionId: id,
        cwd: projectPath,
        model,
        continueId,
      })
      setSessionId(id)
      setSessionAlive(true)
      setView('live')
      if (prompt) setPendingPrompt(prompt)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (!sessionId || !pendingPrompt || !sessionAlive) return
    const text = pendingPrompt
    setPendingPrompt(null)
    const t = setTimeout(() => {
      window.freebuff.writeSession(sessionId, text)
      setTimeout(() => window.freebuff.writeSession(sessionId, '\r'), 100)
    }, 1400)
    return () => clearTimeout(t)
  }, [sessionId, pendingPrompt, sessionAlive])

  const openChat = async (chat: ChatItem) => {
    setActiveChat(chat)
    setError(null)
    if (chat.projectPath && (await window.freebuff.pathExists(chat.projectPath))) {
      setProjectPath(chat.projectPath)
    }
    await loadMessages(chat)
    setView('history')
  }

  const continueChat = async () => {
    if (!activeChat) return
    const cwd =
      activeChat.projectPath &&
      (await window.freebuff.pathExists(activeChat.projectPath))
        ? activeChat.projectPath
        : projectPath
    setProjectPath(cwd)
    // Freebuff --continue uses conversation id
    await startAgent(undefined, activeChat.id)
  }

  const filteredChats = useMemo(() => {
    if (!searchQ.trim()) return chats
    const q = searchQ.toLowerCase()
    return chats.filter(
      (c) =>
        c.firstPrompt.toLowerCase().includes(q) ||
        c.projectName.toLowerCase().includes(q),
    )
  }, [chats, searchQ])

  if (!boot || !settings) {
    return <div className="loading">Loading Freebuff Desktop…</div>
  }

  const tips = [
    'Freebuff is free because of text ads — they never touch your code',
    'Type /help inside a live agent for real Freebuff slash commands',
    'Use @filename to pin files · !command for bash mode',
    'Sessions and history come from ~/.config/manicode — same as the CLI',
  ]
  const tip = tips[Math.floor(Date.now() / 60000) % tips.length]

  return (
    <div className="app">
      <Sidebar
        userName={boot.user?.name || 'Guest'}
        planLabel={boot.user ? 'Free Plan' : 'Sign in via Freebuff'}
        chats={chats}
        activeChatId={activeChat?.id ?? null}
        freebuffInstalled={boot.freebuffInstalled}
        onNewAgent={goHome}
        onSearch={() => setSearchOpen(true)}
        onSettings={() => setView('settings')}
        onSelectChat={openChat}
        onOpenRepo={pickProject}
        onOpenFreebuffSite={() => window.freebuff.openExternal('https://freebuff.com/cli')}
      />

      <main className="main">
        <div className="titlebar-drag">
          <div className="top-actions">
            {(view === 'history' || view === 'live') && (
              <button className="ghost-btn" onClick={goHome}>
                ← New Agent
              </button>
            )}
            {view === 'history' && activeChat && (
              <button className="ghost-btn primary-ghost" onClick={continueChat} disabled={starting}>
                Continue in Freebuff
              </button>
            )}
            {view === 'live' && (
              <>
                <button className="ghost-btn" onClick={() => setShowTerm((s) => !s)}>
                  {showTerm ? 'Hide terminal' : 'Show terminal'}
                </button>
                <button
                  className="ghost-btn"
                  onClick={async () => {
                    if (sessionId) await window.freebuff.killSession(sessionId)
                    setSessionAlive(false)
                  }}
                >
                  Stop
                </button>
              </>
            )}
            <button
              className="ghost-btn"
              onClick={() => window.freebuff.openExternal('https://freebuff.com')}
            >
              freebuff.com ↗
            </button>
            <button className="ghost-btn" onClick={() => setView('settings')}>
              ···
            </button>
          </div>
        </div>

        {!boot.freebuffInstalled && (
          <div className="missing-banner">
            Freebuff CLI binary not found. Install with <code>npm install -g freebuff</code>, run{' '}
            <code>freebuff login</code>, then restart.
            <br />
            Expected: <code>{boot.freebuffBinary}</code>
          </div>
        )}

        {error && (
          <div
            className="missing-banner"
            style={{ borderColor: 'rgba(251,191,36,0.35)', color: '#fcd34d' }}
          >
            {error}
            <button className="ghost-btn" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings}
            userName={boot.user?.name || ''}
            userEmail={boot.user?.email || ''}
            freebuffVersion={boot.freebuffVersion}
            freebuffBinary={boot.freebuffBinary}
            freebuffInstalled={boot.freebuffInstalled}
            signedIn={Boolean(boot.user)}
            onChange={saveSettings}
            onBack={() => setView(sessionId ? 'live' : activeChat ? 'history' : 'home')}
            onPickDefaultCwd={async () => {
              const p = await window.freebuff.pickFolder()
              if (p) await saveSettings({ defaultCwd: p })
            }}
            onLogin={async () => {
              try {
                await window.freebuff.freebuffLogin()
                setError(null)
                // re-bootstrap after a delay
                setTimeout(async () => {
                  const b = (await window.freebuff.getBootstrap()) as Bootstrap
                  setBoot(b)
                }, 3000)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
            onRevealBinary={() => window.freebuff.showItem(boot.freebuffBinary)}
            onRevealConfig={async () => {
              const p = await window.freebuff.manicodePath()
              window.freebuff.showItem(p)
            }}
          />
        )}

        {view === 'home' && (
          <div className="home-wrap">
            <Composer
              projectName={projectName}
              projectPath={projectPath}
              model={model}
              disabled={starting || !boot.freebuffInstalled}
              onModelChange={(id) => {
                setModel(id)
                saveSettings({ model: id })
              }}
              onSubmit={(prompt) => startAgent(prompt)}
              onPickProject={pickProject}
            />
            {settings.adsEnabled && ad && !adDismissed && (
              <div className="home-ad">
                <AdBanner ad={ad} onDismiss={() => setAdDismissed(true)} />
              </div>
            )}
            {settings.showTips && <div className="footer-tip">{tip}</div>}
          </div>
        )}

        {view === 'history' && activeChat && (
          <div className="history-view">
            <ChatTranscript
              messages={messages}
              title={activeChat.firstPrompt}
              projectName={activeChat.projectName}
              modelLabel={modelLabel(model)}
              loading={messagesLoading}
            />
            {settings.adsEnabled && ad && !adDismissed && (
              <AdBanner ad={ad} inline onDismiss={() => setAdDismissed(true)} />
            )}
            <div className="session-input-bar">
              <input
                placeholder="Send follow-up — continues this chat in Freebuff"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (!v) return
                    ;(e.target as HTMLInputElement).value = ''
                    // start continue + inject prompt
                    ;(async () => {
                      const cwd =
                        activeChat.projectPath &&
                        (await window.freebuff.pathExists(activeChat.projectPath))
                          ? activeChat.projectPath
                          : projectPath
                      setProjectPath(cwd)
                      setStarting(true)
                      const id = newId()
                      try {
                        await window.freebuff.startSession({
                          sessionId: id,
                          cwd,
                          model,
                          continueId: activeChat.id,
                        })
                        setSessionId(id)
                        setSessionAlive(true)
                        setView('live')
                        setPendingPrompt(v)
                      } catch {
                        // continue id may not work — fresh session with prompt
                        try {
                          await window.freebuff.startSession({
                            sessionId: id,
                            cwd,
                            model,
                          })
                          setSessionId(id)
                          setSessionAlive(true)
                          setView('live')
                          setPendingPrompt(v)
                        } catch (e2) {
                          setError(e2 instanceof Error ? e2.message : String(e2))
                        }
                      } finally {
                        setStarting(false)
                      }
                    })()
                  }
                }}
              />
              <span className="input-model">{modelLabel(model)}</span>
            </div>
          </div>
        )}

        {view === 'live' && sessionId && (
          <div className="session-view">
            <div className="session-header">
              <span className="path">
                {projectName} · {modelLabel(model)} · {projectPath}
              </span>
              <span className={`status${sessionAlive ? '' : ' dead'}`}>
                {sessionAlive ? 'Live Freebuff' : 'Exited'}
              </span>
            </div>
            {showTerm && settings.showTerminalChrome !== false ? (
              <TerminalView sessionId={sessionId} />
            ) : (
              <div className="term-placeholder">
                Terminal hidden — Freebuff is still running. Show terminal or wait for the session
                to finish to read the chat transcript.
              </div>
            )}
            {settings.adsEnabled && ad && !adDismissed && (
              <AdBanner ad={ad} inline onDismiss={() => setAdDismissed(true)} />
            )}
            <div className="session-input-bar">
              <input
                placeholder="Type to Freebuff (Enter). Or click the terminal and use the TUI directly."
                disabled={!sessionAlive}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value
                    if (!v.trim() || !sessionAlive) return
                    window.freebuff.writeSession(sessionId, v + '\r')
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
              />
              <span className="input-model">{modelLabel(model)}</span>
            </div>
          </div>
        )}

        {searchOpen && (
          <div className="search-overlay" onClick={() => setSearchOpen(false)}>
            <div className="search-box" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                placeholder="Search real Freebuff agents…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
              />
              <div className="search-results">
                {filteredChats.slice(0, 30).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSearchOpen(false)
                      openChat(c)
                    }}
                  >
                    <div>{c.firstPrompt}</div>
                    <div className="meta">
                      {c.projectName} · {c.relativeAge} · {c.messageCount} msgs
                    </div>
                  </button>
                ))}
                {filteredChats.length === 0 && (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                    No matching Freebuff sessions
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
