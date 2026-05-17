import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKitchen } from '../context/KitchenContext'
import OrderTicket from '../components/OrderTicket'
import BarrierFlash from '../components/BarrierFlash'
import ThreadActivityBar from '../components/ThreadActivityBar'
import OrderBuilder from '../components/OrderBuilder'
import { collectOrder } from '../api/orderApi'
import { updateCapacity } from '../api/stationApi'

const STATION_ORDER = ['GRILL', 'FRYER', 'SALAD', 'DRINKS', 'DESSERT']
const STATION_COLORS = {
  GRILL: '#e8622a', FRYER: '#f0b429', SALAD: '#34d399', DRINKS: '#60a5fa', DESSERT: '#c084fc',
}

const COLUMNS = [
  { key: 'prep',      label: 'In Preparation', statuses: new Set(['PENDING', 'IN_PREPARATION']) },
  { key: 'ready',     label: 'Ready',           statuses: new Set(['READY'])     },
  { key: 'collected', label: 'Collected',       statuses: new Set(['COLLECTED']) },
]

const EVENT_COLOR = {
  COMPONENT_UPDATE: 'var(--blue)',
  ORDER_READY:      'var(--green)',
  ORDER_CANCELLED:  'var(--accent)',
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
}

function avgSecs(orders) {
  const completed = orders.filter(o => o.readyAt && o.createdAt)
  if (!completed.length) return null
  const total = completed.reduce((s, o) =>
    s + (new Date(o.readyAt) - new Date(o.createdAt)) / 1000, 0)
  return (total / completed.length).toFixed(1)
}

export default function KitchenDisplay() {
  const { state, dispatch, consumeFlash, toast } = useKitchen()
  const [collecting, setCollecting] = useState({})
  const [logOpen, setLogOpen] = useState(false)
  const [capacities, setCapacities] = useState({})
  const [saving, setSaving] = useState({})
  const logBottomRef = useRef(null)

  const orders = Object.values(state.orders)
  const inPrepCount = orders.filter(o => o.orderStatus === 'PENDING' || o.orderStatus === 'IN_PREPARATION').length
  const readyCount = orders.filter(o => o.orderStatus === 'READY').length
  const avg = avgSecs(orders)
  const totalActiveThreads = STATION_ORDER.reduce((s, t) => s + (state.stations[t]?.activeThreads ?? 0), 0)

  const flashEntry = Object.entries(state.readyFlashes).find(([, v]) => v)
  const flashOrderId = flashEntry?.[0]
  const flashOrder = flashOrderId ? state.orders[flashOrderId] : null
  const eventLog = [...state.recentEvents].reverse()

  useEffect(() => {
    if (logOpen) logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.recentEvents.length, logOpen])

  async function handleCollect(orderId) {
    if (collecting[orderId]) return
    setCollecting(p => ({ ...p, [orderId]: true }))
    try {
      await collectOrder(orderId, 5000)
      dispatch({ type: 'ORDER_COLLECTED', payload: orderId })
    } catch {
      // WebSocket delivers status update
    } finally {
      setCollecting(p => { const n = { ...p }; delete n[orderId]; return n })
    }
  }

  async function handleCapacityChange(type, value) {
    const cap = Math.max(1, Math.min(10, Number(value)))
    setCapacities(p => ({ ...p, [type]: cap }))
    setSaving(p => ({ ...p, [type]: true }))
    try {
      await updateCapacity(type, cap)
    } catch {
      setCapacities(p => ({ ...p, [type]: state.stations[type]?.totalCapacity }))
    } finally {
      setSaving(p => { const n = { ...p }; delete n[type]; return n })
    }
  }

  function handleOrderSubmit(order) {
    toast?.addToast(`Order #${order.id.slice(0, 6)} → Table ${order.tableNumber}`, 'success', 4000)
  }

  const isConnected = state.connectionStatus === 'CONNECTED'

  return (
    <>
      <style>{`
        .kd-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 56px);
          background: var(--bg);
          overflow: hidden;
        }

        /* ── Top bar ─────────────────────────────────── */
        .kd-topbar {
          display: flex;
          align-items: center;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 0 20px;
          flex-shrink: 0;
          height: 52px;
          gap: 4px;
        }
        .kd-stat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px;
          border-right: 1px solid var(--border);
          height: 100%;
        }
        .kd-stat-val {
          font-size: 22px;
          font-weight: 800;
          font-family: 'Courier New', monospace;
          line-height: 1;
        }
        .kd-stat-label {
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
        }
        .kd-thread-area {
          flex: 1;
          padding: 0 16px;
          min-width: 0;
        }
        .kd-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .kd-conn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 0 8px;
        }
        .kd-conn-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .kd-btn {
          padding: 6px 14px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--muted-light);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .kd-btn:hover { color: var(--text); border-color: var(--muted); }
        .kd-btn.danger:hover { color: var(--accent); border-color: var(--accent); }

        /* ── Workspace ───────────────────────────────── */
        .kd-workspace {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── Sidebar ─────────────────────────────────── */
        .kd-sidebar {
          width: 272px;
          flex-shrink: 0;
          background: var(--panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .kd-sidebar-scroll {
          flex: 1;
          overflow-y: auto;
        }
        .kd-section {
          border-bottom: 1px solid var(--border);
          padding: 16px;
        }
        .kd-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 12px;
        }

        /* Station capacity sliders */
        .sem-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .sem-row:last-child { margin-bottom: 0; }
        .sem-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .sem-label {
          font-size: 11px;
          font-weight: 600;
          width: 52px;
          flex-shrink: 0;
        }
        .sem-slider {
          flex: 1;
          accent-color: var(--accent);
          cursor: pointer;
          min-width: 0;
          height: 4px;
        }
        .sem-val {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: 700;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
        }
        .sem-apply {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .sem-apply:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Status cards */
        .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .status-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }
        .status-card-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .status-card-val {
          font-size: 26px;
          font-weight: 900;
          font-family: 'Courier New', monospace;
          line-height: 1;
        }
        .status-card-sub {
          font-size: 10px;
          color: var(--muted);
          margin-top: 4px;
        }

        /* ── Main area ───────────────────────────────── */
        .kd-main {
          display: flex;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        /* Kanban */
        .kd-kanban {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          flex: 1;
          overflow: hidden;
          background: var(--border);
        }
        .kd-col {
          display: flex;
          flex-direction: column;
          background: var(--bg);
          overflow: hidden;
        }
        .kd-col-header {
          padding: 12px 16px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .kd-col-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .kd-col-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          flex: 1;
        }
        .kd-col-count {
          font-size: 12px;
          color: var(--muted);
          font-family: 'Courier New', monospace;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1px 8px;
        }
        .kd-col-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .kd-empty-col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          font-size: 13px;
          margin: 16px;
          border: 1.5px dashed var(--border);
          border-radius: 10px;
          min-height: 80px;
        }
        .kd-ticket-motion { width: 100%; }
        .kd-ticket-motion .ticket { width: 100% !important; }

        /* Log panel */
        .kd-log-panel {
          width: 300px;
          flex-shrink: 0;
          background: var(--panel);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width 0.2s ease;
        }
        .kd-log-panel.closed { width: 0; }
        .kd-log-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .kd-log-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .kd-log-close {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 16px;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .kd-log-close:hover { color: var(--text); }
        .kd-log-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .kd-log-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 7px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 11px;
        }
        .kd-log-row:last-child { border-bottom: none; }
        .kd-log-ts {
          font-family: 'Courier New', monospace;
          color: var(--muted);
          flex-shrink: 0;
          white-space: nowrap;
          font-size: 10px;
        }
        .kd-log-badge {
          font-weight: 700;
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 3px;
          flex-shrink: 0;
          white-space: nowrap;
          letter-spacing: 0.5px;
        }
        .kd-log-desc {
          color: var(--muted-light);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
      `}</style>

      {flashOrder && (
        <BarrierFlash
          orderId={flashOrder.id}
          tableNumber={flashOrder.tableNumber}
          onComplete={() => consumeFlash(flashOrder.id)}
        />
      )}

      <div className="kd-page">
        {/* Top bar */}
        <div className="kd-topbar">
          <div className="kd-stat">
            <span className="kd-stat-val">{orders.length}</span>
            <span className="kd-stat-label">Total</span>
          </div>
          <div className="kd-stat">
            <span className="kd-stat-val" style={{ color: 'var(--blue)' }}>{inPrepCount}</span>
            <span className="kd-stat-label">In Prep</span>
          </div>
          <div className="kd-stat">
            <span className="kd-stat-val" style={{ color: 'var(--green)' }}>{readyCount}</span>
            <span className="kd-stat-label">Ready</span>
          </div>
          <div className="kd-stat" style={{ borderRight: 'none' }}>
            <span className="kd-stat-val" style={{ color: 'var(--gold)' }}>
              {avg !== null ? `${avg}s` : '—'}
            </span>
            <span className="kd-stat-label">Avg Time</span>
          </div>
          <div className="kd-thread-area">
            <ThreadActivityBar stations={state.stations} />
          </div>
          <div className="kd-topbar-actions">
            <div className="kd-conn" style={{ color: isConnected ? 'var(--green)' : 'var(--accent)' }}>
              <span
                className="kd-conn-dot"
                style={{ background: isConnected ? 'var(--green)' : 'var(--accent)' }}
              />
              {isConnected ? 'Live' : state.connectionStatus}
            </div>
            <button className="kd-btn" onClick={() => setLogOpen(o => !o)}>
              {logOpen ? 'Hide Log' : 'Event Log'}
            </button>
            <button className="kd-btn danger" onClick={() => dispatch({ type: 'CLEAR_ALL' })}>
              Clear All
            </button>
          </div>
        </div>

        <div className="kd-workspace">
          {/* Sidebar */}
          <div className="kd-sidebar">
            <div className="kd-sidebar-scroll">

              {/* Place Order */}
              <div className="kd-section">
                <div className="kd-section-title">Place Order</div>
                <OrderBuilder compact onSubmit={handleOrderSubmit} />
              </div>

              {/* Station Capacity */}
              <div className="kd-section">
                <div className="kd-section-title">Station Capacity</div>
                {STATION_ORDER.map(type => {
                  const station = state.stations[type]
                  const capVal = capacities[type] ?? station?.totalCapacity ?? 3
                  return (
                    <div key={type} className="sem-row">
                      <span className="sem-dot" style={{ background: STATION_COLORS[type] }} />
                      <span className="sem-label" style={{ color: STATION_COLORS[type] }}>{type}</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={capVal}
                        onChange={e => setCapacities(p => ({ ...p, [type]: Number(e.target.value) }))}
                        className="sem-slider"
                      />
                      <span className="sem-val">{capVal}</span>
                      <button
                        className="sem-apply"
                        disabled={!!saving[type]}
                        onClick={() => handleCapacityChange(type, capVal)}
                      >
                        {saving[type] ? '…' : 'Set'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Live Status */}
              <div className="kd-section">
                <div className="kd-section-title">Live Status</div>
                <div className="status-grid">
                  <div className="status-card">
                    <div className="status-card-label">In Progress</div>
                    <div className="status-card-val" style={{ color: 'var(--blue)' }}>{inPrepCount}</div>
                    <div className="status-card-sub">cooking now</div>
                  </div>
                  <div className="status-card">
                    <div className="status-card-label">Workers</div>
                    <div className="status-card-val" style={{ color: 'var(--purple)' }}>{totalActiveThreads}</div>
                    <div className="status-card-sub">active threads</div>
                  </div>
                  <div className="status-card">
                    <div className="status-card-label">Ready</div>
                    <div className="status-card-val" style={{ color: 'var(--green)' }}>{readyCount}</div>
                    <div className="status-card-sub">awaiting collect</div>
                  </div>
                  <div className="status-card">
                    <div className="status-card-label">Total</div>
                    <div className="status-card-val" style={{ color: 'var(--gold)' }}>{orders.length}</div>
                    <div className="status-card-sub">orders today</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Kanban + log */}
          <div className="kd-main">
            <div className="kd-kanban">
              {COLUMNS.map((col, ci) => {
                const colOrders = orders
                  .filter(o => col.statuses.has(o.orderStatus))
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                const dotColor = ci === 0 ? 'var(--blue)' : ci === 1 ? 'var(--green)' : 'var(--muted)'
                return (
                  <div key={col.key} className="kd-col">
                    <div className="kd-col-header">
                      <span className="kd-col-dot" style={{ background: dotColor }} />
                      <span className="kd-col-label">{col.label}</span>
                      <span className="kd-col-count">{colOrders.length}</span>
                    </div>
                    {colOrders.length === 0 ? (
                      <div className="kd-empty-col">No orders</div>
                    ) : (
                      <div className="kd-col-body">
                        <AnimatePresence>
                          {colOrders.map(order => (
                            <motion.div
                              key={order.id}
                              className="kd-ticket-motion"
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8, scale: 0.97 }}
                              transition={{ duration: 0.18 }}
                              layout
                            >
                              <OrderTicket
                                order={order}
                                isFlashing={!!state.readyFlashes[order.id]}
                                onCollect={order.orderStatus === 'READY' ? handleCollect : null}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={`kd-log-panel${logOpen ? '' : ' closed'}`}>
              {logOpen && (
                <>
                  <div className="kd-log-header">
                    <span className="kd-log-title">Event Log</span>
                    <button className="kd-log-close" onClick={() => setLogOpen(false)}>✕</button>
                  </div>
                  <div className="kd-log-scroll">
                    {eventLog.length === 0 && (
                      <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                        No events yet
                      </div>
                    )}
                    {eventLog.map((ev, i) => {
                      const color = EVENT_COLOR[ev.eventType] ?? 'var(--muted)'
                      return (
                        <div key={i} className="kd-log-row">
                          <span className="kd-log-ts">{fmtTime(ev.timestamp ?? ev.createdAt)}</span>
                          <span className="kd-log-badge" style={{ background: `${color}22`, color }}>
                            {ev.eventType?.replace(/_/g, ' ')}
                          </span>
                          <span className="kd-log-desc">
                            {ev.tableNumber ? `T${ev.tableNumber}` : ''}
                            {ev.orderId ? ` · ${ev.orderId.slice(0, 6)}` : ''}
                            {ev.newStatus ? ` → ${ev.newStatus}` : ''}
                          </span>
                        </div>
                      )
                    })}
                    <div ref={logBottomRef} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
