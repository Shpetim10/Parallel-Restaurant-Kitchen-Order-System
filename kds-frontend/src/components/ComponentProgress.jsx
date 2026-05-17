import { useEffect, useRef, useState } from 'react'

const STATION_EMOJI = {
  GRILL:   '🔥',
  FRYER:   '🍟',
  SALAD:   '🥗',
  DRINKS:  '🥤',
  DESSERT: '🍰',
}

const STATUS_ICON = {
  PENDING:     { symbol: '🕐', color: 'var(--muted)' },
  IN_PROGRESS: { symbol: '⟳',  color: 'var(--gold)',   spin: true },
  DONE:        { symbol: '✓',  color: 'var(--green)' },
  FAILED:      { symbol: '✕',  color: 'var(--accent)' },
}

export default function ComponentProgress({ component }) {
  const { name, stationType, status, cookTimeMs, processingThreadName } = component
  const cfg = STATUS_ICON[status] ?? STATUS_ICON.PENDING
  const [barWidth, setBarWidth] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (status === 'IN_PROGRESS') {
      setBarWidth(0)
      timerRef.current = requestAnimationFrame(() => setBarWidth(100))
    } else if (status === 'DONE') {
      setBarWidth(100)
    } else {
      setBarWidth(0)
    }
    return () => cancelAnimationFrame(timerRef.current)
  }, [status])

  const barColor =
    status === 'DONE'   ? 'var(--green)' :
    status === 'FAILED' ? 'var(--accent)' : 'var(--gold)'

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .cp-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid var(--border);
        }
        .cp-row:last-child { border-bottom: none; }
        .cp-icon {
          font-size: 14px;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .cp-name {
          flex: 1;
          font-size: 13px;
          color: var(--text);
        }
        .cp-status-icon {
          font-size: 13px;
          font-weight: 700;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
        }
        .cp-thread {
          font-family: 'Courier New', monospace;
          font-size: 9px;
          color: var(--muted);
          max-width: 110px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cp-bar-wrap {
          width: 60px;
          height: 3px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .cp-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition-property: width;
          transition-timing-function: linear;
        }
      `}</style>
      <div className="cp-row">
        <span className="cp-icon">{STATION_EMOJI[stationType] ?? '🍽'}</span>

        <span className="cp-name">{name}</span>

        <span
          className="cp-status-icon"
          style={{
            color: cfg.color,
            display: 'inline-block',
            animation: cfg.spin ? 'spin 1s linear infinite' : 'none',
          }}
        >
          {cfg.symbol}
        </span>

        {processingThreadName && (
          <span className="cp-thread" title={processingThreadName}>
            {processingThreadName}
          </span>
        )}

        <div className="cp-bar-wrap">
          <div
            className="cp-bar-fill"
            style={{
              width: `${barWidth}%`,
              background: barColor,
              transitionDuration: status === 'IN_PROGRESS' ? `${cookTimeMs}ms` : '300ms',
            }}
          />
        </div>
      </div>
    </>
  )
}
