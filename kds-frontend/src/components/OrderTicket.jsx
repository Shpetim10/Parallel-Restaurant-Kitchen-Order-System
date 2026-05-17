import { useEffect, useState } from 'react'
import ComponentProgress from './ComponentProgress'

const STATUS_STYLE = {
  PENDING:        { border: 'var(--muted)',  badge: 'var(--muted)',  label: 'PENDING',     pulse: false },
  IN_PREPARATION: { border: 'var(--blue)',   badge: 'var(--blue)',   label: 'COOKING',     pulse: true  },
  READY:          { border: 'var(--green)',  badge: 'var(--green)',  label: 'READY',       pulse: false },
  COLLECTED:      { border: 'var(--muted)',  badge: 'var(--muted)',  label: 'COLLECTED',   pulse: false },
  CANCELLED:      { border: 'var(--accent)', badge: 'var(--accent)', label: 'CANCELLED',   pulse: false },
}

function elapsed(from) {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function completionSecs(order) {
  if (!order.readyAt || !order.createdAt) return null
  return Math.round((new Date(order.readyAt) - new Date(order.createdAt)) / 1000)
}

export default function OrderTicket({ order, onCollect, isFlashing }) {
  const [tick, setTick] = useState(0)
  const s = STATUS_STYLE[order.orderStatus] ?? STATUS_STYLE.PENDING

  useEffect(() => {
    if (order.orderStatus === 'IN_PREPARATION') {
      const id = setInterval(() => setTick(t => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [order.orderStatus])

  const components = order.components ?? []
  const doneCount = components.filter(c => c.status === 'DONE' || c.status === 'FAILED').length
  const total = components.length
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const isCancelled = order.orderStatus === 'CANCELLED'
  const secs = completionSecs(order)

  return (
    <>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .ticket {
          width: 300px;
          background: var(--card);
          border-radius: 10px;
          border: 1.5px solid;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex-shrink: 0;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .ticket.flashing {
          box-shadow: 0 0 28px 4px var(--green);
        }
        .ticket-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .ticket-table {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.5px;
          ${isCancelled ? 'text-decoration: line-through; opacity: 0.5;' : ''}
        }
        .ticket-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }
        .ticket-id {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: var(--muted);
        }
        .ticket-elapsed {
          font-size: 12px;
          color: var(--muted-light);
          font-weight: 500;
        }
        .ticket-badge {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 4px 10px;
          border-radius: 5px;
          border: 1.5px solid;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ticket-components {
          display: flex;
          flex-direction: column;
        }
        .ticket-summary {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ticket-summary-label {
          font-size: 11px;
          color: var(--muted);
        }
        .ticket-summary-bar {
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
        }
        .ticket-summary-fill {
          height: 100%;
          background: var(--green);
          border-radius: 2px;
          transition: width 0.4s;
        }
        .ticket-collect-btn {
          background: var(--green);
          color: #000;
          border: none;
          border-radius: 7px;
          padding: 11px 0;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.5px;
          cursor: pointer;
          width: 100%;
          transition: opacity 0.15s, transform 0.1s;
        }
        .ticket-collect-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .ticket-collect-btn:active { transform: translateY(0); }
        .ticket-completion {
          font-size: 12px;
          color: var(--green);
          text-align: center;
          font-weight: 600;
        }
      `}</style>
      <div
        className={`ticket${isFlashing ? ' flashing' : ''}`}
        style={{ borderColor: s.border }}
      >
        <div className="ticket-header">
          <div className="ticket-meta">
            <span className="ticket-table">TABLE {order.tableNumber}</span>
            <span className="ticket-id">{order.id?.slice(0, 8)}</span>
            <span className="ticket-elapsed">
              {tick >= 0 && order.createdAt ? elapsed(order.createdAt) : '—'}
            </span>
          </div>
          <span
            className="ticket-badge"
            style={{
              color: s.badge,
              borderColor: s.badge,
              animation: s.pulse ? 'badge-pulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {s.label}
          </span>
        </div>

        <div className="ticket-components">
          {components.map(c => (
            <ComponentProgress key={c.id} component={c} />
          ))}
        </div>

        <div className="ticket-summary">
          <span className="ticket-summary-label">
            {doneCount}/{total} components
          </span>
          <div className="ticket-summary-bar">
            <div className="ticket-summary-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {order.orderStatus === 'READY' && (
          <>
            {secs !== null && (
              <div className="ticket-completion">Completed in {secs}s</div>
            )}
            {onCollect && (
              <button className="ticket-collect-btn" onClick={() => onCollect(order.id)}>
                Collect Order
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}
