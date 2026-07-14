import { useEffect, useRef } from 'react'

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

export type FreebuffMessage = {
  id: string
  variant: 'user' | 'ai' | string
  content?: string
  timestamp?: string
  blocks?: FreebuffBlock[]
  metadata?: Record<string, unknown>
}

type Props = {
  messages: FreebuffMessage[]
  title?: string
  projectName?: string
  modelLabel?: string
  loading?: boolean
}

function summarizeTool(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return name
  const i = input as Record<string, unknown>
  if (typeof i.pattern === 'string') return `${name} ${i.pattern}`
  if (Array.isArray(i.paths)) return `${name} ${(i.paths as string[]).slice(0, 3).join(', ')}${(i.paths as string[]).length > 3 ? '…' : ''}`
  if (typeof i.command === 'string') return `${name} ${i.command}`
  if (typeof i.path === 'string') return `${name} ${i.path}`
  if (typeof i.query === 'string') return `${name} ${i.query}`
  if (Array.isArray(i.todos)) return `${name} (${(i.todos as unknown[]).length} items)`
  return name
}

function formatOutput(output: unknown): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

function ToolCard({ block }: { block: FreebuffBlock }) {
  const name = block.toolName || 'tool'
  const summary = summarizeTool(name, block.input)
  const out = formatOutput(block.output)
  const lines = out.split('\n').filter(Boolean)
  const preview = lines.slice(0, 12).join('\n')
  const truncated = lines.length > 12

  return (
    <div className="tool-card">
      <div className="tool-card-head">
        <span className="tool-prompt">&gt;_</span>
        <span className="tool-name">{summary}</span>
      </div>
      {preview && (
        <pre className="tool-out">
          {preview}
          {truncated ? '\n…' : ''}
        </pre>
      )}
    </div>
  )
}

function AgentCard({ block }: { block: FreebuffBlock }) {
  return (
    <div className="agent-card">
      <div className="agent-card-head">
        <span className="agent-badge">{block.agentName || block.agentType || 'agent'}</span>
        <span className={`agent-status ${block.status || ''}`}>{block.status || 'running'}</span>
      </div>
      {block.content && <div className="agent-body">{block.content}</div>}
    </div>
  )
}

function DiffishText({ content }: { content: string }) {
  // Heuristic: if content looks like a unified diff snippet, color lines
  const looksLikeDiff =
    content.includes('\n+') && content.includes('\n-') && content.split('\n').length > 3
  if (!looksLikeDiff) {
    return <div className="ai-text">{content}</div>
  }
  return (
    <pre className="diff-block">
      {content.split('\n').map((line, i) => {
        let cls = ''
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'add'
        else if (line.startsWith('-') && !line.startsWith('---')) cls = 'del'
        else if (line.startsWith('@@')) cls = 'hunk'
        return (
          <div key={i} className={cls}>
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}

function MessageView({ msg }: { msg: FreebuffMessage }) {
  if (msg.variant === 'user') {
    return (
      <div className="msg-row user">
        <div className="user-bubble">{msg.content}</div>
      </div>
    )
  }

  const blocks = msg.blocks || []
  if (blocks.length === 0 && msg.content) {
    return (
      <div className="msg-row ai">
        <div className="ai-text">{msg.content}</div>
      </div>
    )
  }

  // Skip pure mode dividers as standalone empty messages
  if (blocks.length === 1 && blocks[0].type === 'mode-divider') {
    return (
      <div className="mode-divider-line">
        Freebuff · {blocks[0].mode || 'FREE'} mode
      </div>
    )
  }

  return (
    <div className="msg-row ai">
      {blocks.map((b, idx) => {
        if (b.type === 'mode-divider') {
          return (
            <div key={idx} className="mode-divider-line">
              Freebuff · {b.mode || 'FREE'}
            </div>
          )
        }
        if (b.type === 'text' && b.content?.trim()) {
          // Skip raw chain-of-thought walls that look like internal planning if very long and first?
          return <DiffishText key={idx} content={b.content} />
        }
        if (b.type === 'tool') {
          return <ToolCard key={idx} block={b} />
        }
        if (b.type === 'agent') {
          return <AgentCard key={idx} block={b} />
        }
        return null
      })}
      {msg.timestamp && <div className="msg-time">{msg.timestamp}</div>}
    </div>
  )
}

export default function ChatTranscript({
  messages,
  title,
  projectName,
  modelLabel,
  loading,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="transcript">
      {(title || projectName) && (
        <div className="transcript-titlebar">
          <span className="t-title">{title || 'Agent'}</span>
          {projectName && <span className="t-meta">{projectName}</span>}
          {modelLabel && <span className="t-meta">{modelLabel}</span>}
        </div>
      )}
      <div className="transcript-scroll">
        {loading && <div className="transcript-loading">Loading conversation…</div>}
        {!loading && messages.length === 0 && (
          <div className="transcript-loading">No messages in this session yet.</div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} msg={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
