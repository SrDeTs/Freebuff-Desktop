import { useMemo, useState } from 'react'
import { FREEBUFF_MODELS, modelLabel } from '../lib/models'

type Settings = {
  defaultCwd: string
  model: string
  showTips: boolean
  systemNotifications: boolean
  adsEnabled: boolean
  showTerminalChrome: boolean
}

type Props = {
  settings: Settings
  userName: string
  userEmail: string
  freebuffVersion: string | null
  freebuffBinary: string
  freebuffInstalled: boolean
  signedIn: boolean
  onChange: (partial: Partial<Settings>) => void
  onBack: () => void
  onPickDefaultCwd: () => void
  onLogin: () => void
  onRevealBinary: () => void
  onRevealConfig: () => void
}

const NAV = [
  { id: 'general', label: 'General', icon: '⚙' },
  { id: 'account', label: 'Account', icon: '☺' },
  { id: 'models', label: 'Models', icon: '▣' },
  { id: 'agents', label: 'Agents', icon: '◆' },
  { id: 'ads', label: 'Ads & Free tier', icon: '◇' },
  { id: 'about', label: 'About', icon: 'ⓘ' },
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={onToggle}
    />
  )
}

export default function SettingsView({
  settings,
  userName,
  userEmail,
  freebuffVersion,
  freebuffBinary,
  freebuffInstalled,
  signedIn,
  onChange,
  onBack,
  onPickDefaultCwd,
  onLogin,
  onRevealBinary,
  onRevealConfig,
}: Props) {
  const [tab, setTab] = useState('general')
  const [q, setQ] = useState('')

  const nav = useMemo(() => {
    if (!q.trim()) return NAV
    return NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()))
  }, [q])

  return (
    <div className="settings-layout">
      <nav className="settings-nav">
        <button className="back" onClick={onBack}>
          ← Back
        </button>
        <input
          className="settings-search"
          placeholder="Search Settings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {nav.map((n) => (
          <button
            key={n.id}
            className={`settings-nav-item${tab === n.id ? ' active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span style={{ width: 18, textAlign: 'center', opacity: 0.8 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="settings-body">
        {tab === 'general' && (
          <>
            <h1>General</h1>
            <div className="section-title">Startup</div>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="label">Tips</div>
                  <div className="desc">Show tips on the empty New Agent screen</div>
                </div>
                <Toggle
                  on={settings.showTips}
                  onToggle={() => onChange({ showTips: !settings.showTips })}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">System notifications</div>
                  <div className="desc">
                    Notify when a Freebuff agent session exits (uses macOS notifications)
                  </div>
                </div>
                <Toggle
                  on={settings.systemNotifications}
                  onToggle={() =>
                    onChange({ systemNotifications: !settings.systemNotifications })
                  }
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Show Freebuff terminal while running</div>
                  <div className="desc">
                    Live agent runs the real Freebuff TUI. Turn off to only see chat history after.
                  </div>
                </div>
                <Toggle
                  on={settings.showTerminalChrome}
                  onToggle={() =>
                    onChange({ showTerminalChrome: !settings.showTerminalChrome })
                  }
                />
              </div>
            </div>
          </>
        )}

        {tab === 'account' && (
          <>
            <h1>Account</h1>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="label">Freebuff account</div>
                  <div className="desc">
                    {signedIn
                      ? `${userName}${userEmail ? ` · ${userEmail}` : ''}`
                      : 'Not signed in — run Freebuff login'}
                  </div>
                </div>
                {!signedIn ? (
                  <button className="btn-primary" onClick={onLogin}>
                    Sign in
                  </button>
                ) : (
                  <button
                    className="btn-secondary"
                    onClick={() => window.freebuff.openExternal('https://freebuff.com')}
                  >
                    freebuff.com ↗
                  </button>
                )}
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Plan</div>
                  <div className="desc">Freebuff Free — ad-supported, $0. No subscription.</div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'models' && (
          <>
            <h1>Models</h1>
            <p className="settings-lead">
              These are Freebuff’s free open-source models. Selecting one updates{' '}
              <code>~/.config/manicode/settings.json</code> so the CLI uses it.
            </p>
            <div className="settings-card">
              {FREEBUFF_MODELS.map((m) => (
                <div className="settings-row" key={m.id}>
                  <div>
                    <div className="label">{m.label}</div>
                    <div className="desc">
                      {m.id} · {m.tier} mode
                    </div>
                  </div>
                  <button
                    className={settings.model === m.id ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => onChange({ model: m.id })}
                  >
                    {settings.model === m.id ? 'Selected' : 'Use'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'agents' && (
          <>
            <h1>Agents</h1>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="label">Default project folder</div>
                  <div className="desc mono">{settings.defaultCwd}</div>
                </div>
                <button className="btn-secondary" onClick={onPickDefaultCwd}>
                  Change
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Default model</div>
                  <div className="desc">{modelLabel(settings.model)}</div>
                </div>
              </div>
            </div>
            <div className="section-title">Real Freebuff slash commands</div>
            <div className="settings-card">
              <div className="settings-row">
                <div className="desc">
                  Inside a live agent: <code>/help</code> <code>/new</code> <code>/history</code>{' '}
                  <code>/bash</code> <code>/init</code> <code>/feedback</code>{' '}
                  <code>/theme:toggle</code> <code>/logout</code> <code>/exit</code>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'ads' && (
          <>
            <h1>Ads & Free tier</h1>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="label">Show sponsor ads in UI</div>
                  <div className="desc">
                    Freebuff is free because of text ads (Carbon + partners). Ads never inject into
                    your code. Freebuff CLI always shows ads in FREE mode.
                  </div>
                </div>
                <Toggle
                  on={settings.adsEnabled}
                  onToggle={() => onChange({ adsEnabled: !settings.adsEnabled })}
                />
              </div>
            </div>
          </>
        )}

        {tab === 'about' && (
          <>
            <h1>About</h1>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="label">Freebuff Desktop</div>
                  <div className="desc">
                    Unofficial desktop shell for the Freebuff CLI. Wraps the real binary — no fake
                    agent backend.
                  </div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">CLI version</div>
                  <div className="desc">{freebuffVersion || 'unknown'}</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Binary</div>
                  <div className="desc mono">
                    {freebuffInstalled ? freebuffBinary : 'Not installed'}
                  </div>
                </div>
                <button className="btn-secondary" onClick={onRevealBinary}>
                  Reveal
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Config dir</div>
                  <div className="desc mono">~/.config/manicode</div>
                </div>
                <button className="btn-secondary" onClick={onRevealConfig}>
                  Reveal
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="label">Docs</div>
                  <div className="desc">freebuff.com/cli · github.com/CodebuffAI/codebuff</div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => window.freebuff.openExternal('https://freebuff.com/cli')}
                >
                  Open ↗
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
