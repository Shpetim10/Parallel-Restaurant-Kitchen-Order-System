import { useState, useEffect } from 'react'
import { useKitchen } from '../context/KitchenContext'
import OrderBuilder from '../components/OrderBuilder'

const STATUS_META = {
  PENDING:        { label: 'PENDING',    color: 'var(--muted)',  pulse: false },
  IN_PREPARATION: { label: 'COOKING',    color: 'var(--blue)',   pulse: true  },
  READY:          { label: 'READY',      color: 'var(--green)',  pulse: false },
  COLLECTED:      { label: 'COLLECTED',  color: 'var(--muted)',  pulse: false },
  CANCELLED:      { label: 'CANCELLED',  color: 'var(--accent)', pulse: false },
}

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function elapsed(from) {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

export default function WaiterView() {
  const { state, toast } = useKitchen()
  const [sessionOrderIds, setSessionOrderIds] = useState([])
  const [tick, setTick] = useState(0)
  const clock = useClock()

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  function handleSubmit(order) {
    setSessionOrderIds(prev => [order.id, ...prev])
    toast?.addToast(
      `Order #${order.id.slice(0, 6)} submitted for Table ${order.tableNumber}`,
      'success',
      4000
    )
  }

  const sessionOrders = sessionOrderIds
    .map(id => state.orders[id])
    .filter(Boolean)

  const isDisconnected = state.connectionStatus === 'DISCONNECTED'

  return (
    <>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .wv-page { padding: 0; display: flex; flex-direction: column; height: calc(100vh - 56px); }
        .wv-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 24px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .wv-banner-title {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--accent);
        }
        .wv-clock {
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: 2px;
        }
        .wv-warn {
          background: rgba(232, 98, 42, 0.12);
          border-bottom: 1px solid var(--accent);
          padding: 7px 24px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: 1px;
          text-align: center;
          flex-shrink: 0;
        }
        .wv-body {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 0;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .wv-left {
          padding: 24px;
          overflow-y: auto;
          border-right: 1px solid var(--border);
        }
        .wv-right {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .wv-right-header {
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .wv-right-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--muted);
          flex: 1;
        }
        .wv-count-badge {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 2px 9px;
          font-size: 11px;
          color: var(--muted);
        }
        .wv-orders-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .wv-order-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 20px;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .wv-order-row:last-child { border-bottom: none; }
        .wv-order-row:hover { background: var(--card); }
        .wv-order-table {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          min-width: 36px;
        }
        .wv-order-id {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: var(--muted);
          flex: 1;
        }
        .wv-status-badge {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
          padding: 2px 7px;
          border-radius: 3px;
          border: 1px solid;
          white-space: nowrap;
        }
        .wv-elapsed {
          font-size: 11px;
          color: var(--muted);
          font-family: 'Courier New', monospace;
          min-width: 36px;
          text-align: right;
        }
        .wv-empty {
          padding: 40px 20px;
          text-align: center;
          font-size: 12px;
          color: var(--muted);
        }
        @media (max-width: 900px) {
          .wv-body { grid-template-columns: 1fr; }
          .wv-right { border-top: 1px solid var(--border); max-height: 280px; }
        }
      `}</style>

      <div className="wv-page">
        <div className="wv-banner">
          <span className="wv-banner-title">Waiter Station</span>
          <span className="wv-clock">
            {clock.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        {isDisconnected && (
          <div className="wv-warn">
            ⚠ WebSocket DISCONNECTED — orders may not update in real time
          </div>
        )}

        <div className="wv-body">
          <div className="wv-left">
            <OrderBuilder onSubmit={handleSubmit} />
          </div>

          <div className="wv-right">
            <div className="wv-right-header">
              <span className="wv-right-title">My Orders</span>
              <span className="wv-count-badge">{sessionOrders.length}</span>
            </div>
            <div className="wv-orders-scroll">
              {sessionOrders.length === 0 && (
                <div className="wv-empty">No orders submitted this session</div>
              )}
              {sessionOrders.map(order => {
                const meta = STATUS_META[order.orderStatus] ?? STATUS_META.PENDING
                return (
                  <div key={order.id} className="wv-order-row">
                    <span className="wv-order-table">T{order.tableNumber}</span>
                    <span className="wv-order-id">#{order.id.slice(0, 8)}</span>
                    <span
                      className="wv-status-badge"
                      style={{
                        color: meta.color,
                        borderColor: meta.color,
                        animation: meta.pulse ? 'badge-pulse 1.2s ease-in-out infinite' : 'none',
                      }}
                    >
                      {meta.label}
                    </span>
                    <span className="wv-elapsed">
                      {tick >= 0 && order.createdAt ? elapsed(order.createdAt) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
