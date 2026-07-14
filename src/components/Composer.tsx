import { useEffect, useRef, useState } from 'react'
import { FREEBUFF_MODELS, modelLabel } from '../lib/models'
import { IconMic, IconPlus, IconSend, IconBranch, IconMac } from './Icons'

type Props = {
  projectName: string
  projectPath: string
  model: string
  onModelChange: (id: string) => void
  onSubmit: (prompt: string) => void
  onPickProject: () => void
  disabled?: boolean
}

export default function Composer({
  projectName,
  projectPath,
  model,
  onModelChange,
  onSubmit,
  onPickProject,
  disabled,
}: Props) {
  const [value, setValue] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    taRef.current?.focus()
  }, [])

  const submit = () => {
    const v = value.trim()
    if (!v || disabled) return
    onSubmit(v)
    setValue('')
  }

  return (
    <div className="center-stage">
      <div className="context-row">
        <button className="context-chip" onClick={onPickProject} title={projectPath}>
          <span className="chip-label">{projectName || 'Select project'}</span>
          <span className="caret">▾</span>
        </button>
        <button className="context-chip" title="Runs on your machine via Freebuff CLI">
          <IconBranch />
          local
        </button>
        <button className="context-chip" title="This Mac">
          <IconMac />
          This Mac
        </button>
      </div>

      <div className="composer">
        <textarea
          ref={taRef}
          rows={2}
          placeholder="Describe what to build, fix, or explore…"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="composer-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
            <button className="model-picker" title="Files are scoped to the project folder" disabled>
              <IconPlus />
            </button>
            <button className="model-picker" onClick={() => setMenuOpen((o) => !o)}>
              {modelLabel(model)}
              <span className="lock">▾</span>
            </button>
            {menuOpen && (
              <div className="model-menu">
                {FREEBUFF_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={m.id === model ? 'active' : ''}
                    onClick={() => {
                      onModelChange(m.id)
                      setMenuOpen(false)
                    }}
                  >
                    <span>{m.label}</span>
                    <span className="tier">{m.tier}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="model-picker" title="Voice not available in Freebuff CLI" disabled>
              <IconMic />
            </button>
            <button
              className={`send-btn${value.trim() ? ' active' : ''}`}
              disabled={!value.trim() || disabled}
              onClick={submit}
              title="Start Freebuff agent"
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>

      <div className="action-chips">
        <button
          className="chip"
          onClick={() => {
            setValue('Plan how to implement: ')
            taRef.current?.focus()
          }}
        >
          Plan
        </button>
        <button
          className="chip"
          onClick={() => {
            setValue('Find and fix bugs in this project: ')
            taRef.current?.focus()
          }}
        >
          Fix bugs
        </button>
        <button
          className="chip"
          onClick={() => window.freebuff.openExternal('https://freebuff.com/cloud')}
          title="Real Freebuff Cloud product"
        >
          Freebuff Cloud ↗
        </button>
      </div>
    </div>
  )
}
