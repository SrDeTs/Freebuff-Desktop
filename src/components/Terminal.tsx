import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

type Props = {
  sessionId: string
  onReady?: (term: XTerm) => void
}

export default function TerminalView({ sessionId, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#0f0f0f',
        foreground: '#e8e8e8',
        cursor: '#e8e8e8',
        selectionBackground: '#3a3a3a',
        black: '#1a1a1a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e8e8e8',
        brightBlack: '#6b6b6b',
      },
      allowProposedApi: true,
      scrollback: 5000,
    })

    const fit = new FitAddon()
    const links = new WebLinksAddon((event, uri) => {
      event.preventDefault()
      window.freebuff.openExternal(uri)
    })

    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(containerRef.current)

    // slight delay so layout is ready
    requestAnimationFrame(() => {
      try {
        fit.fit()
        const dims = fit.proposeDimensions()
        if (dims) {
          window.freebuff.resizeSession(sessionId, dims.cols, dims.rows)
        }
      } catch {
        // ignore
      }
    })

    term.onData((data) => {
      window.freebuff.writeSession(sessionId, data)
    })

    termRef.current = term
    fitRef.current = fit
    onReady?.(term)

    const unsubData = window.freebuff.onSessionData((payload: { sessionId: string; data: string }) => {
      if (payload.sessionId !== sessionId) return
      term.write(payload.data)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        const dims = fit.proposeDimensions()
        if (dims) {
          window.freebuff.resizeSession(sessionId, dims.cols, dims.rows)
        }
      } catch {
        // ignore
      }
    })
    ro.observe(containerRef.current)

    return () => {
      unsubData()
      ro.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [sessionId, onReady])

  return <div className="term-wrap" ref={containerRef} />
}
