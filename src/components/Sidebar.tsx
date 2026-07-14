import { IconAgent, IconSearch, IconGear, IconFolder, IconPlus, IconCloud } from './Icons'

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

type Props = {
  userName: string
  planLabel: string
  chats: ChatItem[]
  activeChatId: string | null
  freebuffInstalled: boolean
  onNewAgent: () => void
  onSearch: () => void
  onSettings: () => void
  onSelectChat: (chat: ChatItem) => void
  onOpenRepo: () => void
  onOpenFreebuffSite: () => void
}

function groupByProject(chats: ChatItem[]) {
  const map = new Map<string, ChatItem[]>()
  for (const c of chats) {
    const key = c.projectName || c.projectKey
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  return [...map.entries()]
}

export default function Sidebar({
  userName,
  planLabel,
  chats,
  activeChatId,
  freebuffInstalled,
  onNewAgent,
  onSearch,
  onSettings,
  onSelectChat,
  onOpenRepo,
  onOpenFreebuffSite,
}: Props) {
  const groups = groupByProject(chats)
  const initials = userName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="nav-btn primary" onClick={onNewAgent} title="⌘N">
          <span className="icon">
            <IconAgent />
          </span>
          New Agent
          <span className="nav-kbd">⌘N</span>
        </button>
        <button className="nav-btn" onClick={onSearch} title="⌘K">
          <span className="icon">
            <IconSearch />
          </span>
          Search
          <span className="nav-kbd">⌘K</span>
        </button>
        <button className="nav-btn" onClick={onSettings} title="⌘,">
          <span className="icon">
            <IconGear />
          </span>
          Settings
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="section-label">
          <span>Repositories</span>
          <div className="section-actions">
            <button className="icon-btn" title="Open project folder" onClick={onOpenRepo}>
              <IconPlus />
            </button>
            <button
              className="icon-btn"
              title="Open Freebuff CLI docs"
              onClick={onOpenFreebuffSite}
            >
              <IconFolder />
            </button>
          </div>
        </div>

        {!freebuffInstalled && (
          <div className="sidebar-empty">
            Freebuff CLI not found. Install with npm i -g freebuff
          </div>
        )}

        {freebuffInstalled && groups.length === 0 && (
          <div className="sidebar-empty">
            No agent sessions yet. Start one with New Agent.
          </div>
        )}

        {groups.map(([name, items]) => (
          <div className="repo-group" key={name}>
            <div className="repo-header">
              <IconFolder />
              <span className="repo-name">{name}</span>
            </div>
            {items.slice(0, 12).map((c) => (
              <button
                key={c.id}
                className={`chat-item${activeChatId === c.id ? ' active' : ''}`}
                onClick={() => onSelectChat(c)}
                title={c.firstPrompt}
              >
                <span className="title">{c.firstPrompt || 'Untitled'}</span>
                {c.messageCount > 2 && (
                  <span className="cloud" title={`${c.messageCount} messages`}>
                    <IconCloud />
                  </span>
                )}
                <span className="age">{c.relativeAge}</span>
              </button>
            ))}
            {items.length > 12 && (
              <div className="chat-item more-label">+{items.length - 12} more</div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="upgrade-btn" onClick={onOpenFreebuffSite}>
          <IconAgent />
          Free forever · funded by ads
        </button>
        <div className="user-row">
          <div className="avatar">{initials || 'F'}</div>
          <div className="user-meta">
            <div className="name">{userName || 'Not signed in'}</div>
            <div className="plan">{planLabel}</div>
          </div>
          <button className="icon-btn" onClick={onSettings} title="Settings">
            <IconGear />
          </button>
        </div>
      </div>
    </aside>
  )
}
