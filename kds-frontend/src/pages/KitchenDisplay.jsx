import { useState, useRef, useEffect } from 'react'
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
const STATION_EMOJI = { GRILL: '🔥', FRYER: '🍟', SALAD: '🥗', DRINKS: '🥤', DESSERT: '🍰' }

const COLUMNS = [
  { key: 'prep',      label: 'In Preparation', statuses: new Set(['PENDING', 'IN_PREPARATION']) },
  { key: 'ready',     label: 'Ready',           statuses: new Set(['READY'])     },
  { key: 'collected', label: 'Collected',       statuses: new Set(['COLLECTED']) },
]

function avgSecs(orders) {
  const done = orders.filter(o => o.readyAt && o.createdAt)
  if (!done.length) return null
  return (done.reduce((s, o) =>
    s + (new Date(o.readyAt) - new Date(o.createdAt)) / 1000, 0) / done.length).toFixed(1)
}

export default function KitchenDisplay() {
  const { state, dispatch, consumeFlash, toast } = useKitchen()
  const [collecting, setCollecting] = useState({})
  const [capacities, setCapacities] = useState({})
  const [saving, setSaving] = useState({})
  const [orderOpen, setOrderOpen] = useState(false)

  const orders = Object.values(state.orders)
  const inPrepCount = orders.filter(o => o.orderStatus === 'PENDING' || o.orderStatus === 'IN_PREPARATION').length
  const readyCount = orders.filter(o => o.orderStatus === 'READY').length
  const avg = avgSecs(orders)
  const totalActiveThreads = STATION_ORDER.reduce((s, t) => s + (state.stations[t]?.activeThreads ?? 0), 0)

  const flashEntry = Object.entries(state.readyFlashes).find(([, v]) => v)
  const flashOrderId = flashEntry?.[0]
  const flashOrder = flashOrderId ? state.orders[flashOrderId] : null

  async function handleCollect(orderId) {
    if (collecting[orderId]) return
    setCollecting(p => ({ ...p, [orderId]: true }))
    try {
      await collectOrder(orderId, 5000)
      dispatch({ type: 'ORDER_COLLECTED', payload: orderId })
    } catch {
      // WS delivers the status update
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
    dispatch({ type: 'ORDER_CREATED', payload: order })
    toast?.addToast(`Order #${order.id.slice(0, 6)} → Table ${order.tableNumber}`, 'success', 4000)
    setOrderOpen(false)
  }

  const isConnected = state.connectionStatus === 'CONNECTED'
  const activeBarriers = Object.values(state.barriers).filter(b => b.arrived < b.total)

  return (
    <>
      <style>{`
        /* ── Layout ─────────────────────────────────── */
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
          padding: 0 16px;
          flex-shrink: 0;
          height: 48px;
          gap: 0;
        }
        .kd-stat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          border-right: 1px solid var(--border);
          height: 100%;
        }
        .kd-stat-val {
          font-size: 20px;
          font-weight: 800;
          font-family: 'Courier New', monospace;
          line-height: 1;
        }
        .kd-stat-label {
          font-size: 10px;
          color: var(--muted);
          white-space: nowrap;
        }
        .kd-thread-area {
          flex: 1;
          padding: 0 16px;
          min-width: 0;
        }
        .kd-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .kd-conn {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
        }
        .kd-conn-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .kd-btn {
          padding: 5px 12px;
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
        .kd-btn.primary {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        .kd-btn.primary:hover { opacity: 0.85; color: #fff; border-color: var(--accent); }

        /* ── Workspace ───────────────────────────────── */
        .kd-workspace {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── Left sidebar ─────────────────────────────── */
        .kd-sidebar {
          width: 256px;
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
          padding: 14px;
        }
        .kd-section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        /* Semaphore rows */
        .sem-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .sem-row:last-child { margin-bottom: 0; }
        .sem-label {
          font-size: 10px;
          font-weight: 700;
          width: 46px;
          flex-shrink: 0;
        }
        .sem-bars {
          flex: 1;
          display: flex;
          gap: 2px;
          height: 10px;
          min-width: 0;
        }
        .sem-bar-slot {
          flex: 1;
          border-radius: 2px;
          min-width: 0;
        }
        .sem-slider {
          flex: 1;
          accent-color: var(--accent);
          cursor: pointer;
          height: 4px;
        }
        .sem-val {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 700;
          width: 14px;
          text-align: center;
          flex-shrink: 0;
        }
        .sem-apply {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .sem-apply:disabled { opacity: 0.4; cursor: not-allowed; }
        .sem-detail {
          font-size: 9px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* ── Kanban ─────────────────────────────────── */
        .kd-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
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
          padding: 10px 14px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .kd-col-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .kd-col-label { font-size: 12px; font-weight: 700; color: var(--text); flex: 1; }
        .kd-col-count {
          font-size: 11px;
          color: var(--muted);
          font-family: 'Courier New', monospace;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1px 7px;
        }
        .kd-col-body {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kd-empty-col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          font-size: 12px;
          margin: 12px;
          border: 1.5px dashed var(--border);
          border-radius: 10px;
          min-height: 60px;
        }
        .kd-ticket-motion { width: 100%; }
        .kd-ticket-motion .ticket { width: 100% !important; }

        /* ── Concurrency panel ─────────────────────────── */
        .kd-conc {
          width: 260px;
          flex-shrink: 0;
          background: var(--panel);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .kd-conc-header {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--muted);
          flex-shrink: 0;
        }
        .kd-conc-scroll { flex: 1; overflow-y: auto; }
        .kd-conc-section {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
        }
        .kd-conc-section:last-child { border-bottom: none; }
        .kd-conc-section-title {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        /* Semaphore visual */
        .sem-vis-row {
          margin-bottom: 10px;
        }
        .sem-vis-row:last-child { margin-bottom: 0; }
        .sem-vis-top {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .sem-vis-name {
          font-size: 10px;
          font-weight: 700;
          width: 50px;
          flex-shrink: 0;
        }
        .sem-vis-slots {
          display: flex;
          gap: 3px;
          flex: 1;
        }
        .sem-vis-slot {
          height: 12px;
          flex: 1;
          border-radius: 2px;
        }
        .sem-vis-legend {
          font-size: 9px;
          color: var(--muted);
          display: flex;
          gap: 8px;
        }

        /* Barrier rows */
        .barrier-row {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 6px;
        }
        .barrier-row:last-child { margin-bottom: 0; }
        .barrier-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .barrier-id {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: var(--muted);
        }
        .barrier-table {
          font-size: 11px;
          font-weight: 700;
          color: var(--text);
        }
        .barrier-progress-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .barrier-bar-wrap {
          flex: 1;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }
        .barrier-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s;
        }
        .barrier-fraction {
          font-size: 10px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: var(--purple);
          flex-shrink: 0;
        }
        .barrier-label {
          font-size: 9px;
          color: var(--muted);
          margin-top: 3px;
        }
        .kd-empty-note {
          font-size: 11px;
          color: var(--muted);
          text-align: center;
          padding: 12px 0;
        }

        /* Order modal */
        .order-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .order-modal {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          width: min(640px, 95vw);
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .order-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .order-modal-title {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--text);
        }
        .order-modal-close {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 18px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .order-modal-close:hover { color: var(--text); }
      `}</style>

      {flashOrder && (
        <BarrierFlash
          orderId={flashOrder.id}
          tableNumber={flashOrder.tableNumber}
          onComplete={() => consumeFlash(flashOrder.id)}
        />
      )}

      {orderOpen && (
        <div className="order-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setOrderOpen(false) }}>
          <div className="order-modal">
            <div className="order-modal-header">
              <span className="order-modal-title">Place Order</span>
              <button className="order-modal-close" onClick={() => setOrderOpen(false)}>✕</button>
            </div>
            <OrderBuilder onSubmit={handleOrderSubmit} />
          </div>
        </div>
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
          <div className="kd-topbar-right">
            <div className="kd-conn" style={{ color: isConnected ? 'var(--green)' : 'var(--accent)' }}>
              <span
                className="kd-conn-dot"
                style={{ background: isConnected ? 'var(--green)' : 'var(--accent)' }}
              />
              {isConnected ? 'Live' : state.connectionStatus}
            </div>
            <button className="kd-btn primary" onClick={() => setOrderOpen(true)}>
              + New Order
            </button>
            <button className="kd-btn danger" onClick={() => dispatch({ type: 'CLEAR_ALL' })}>
              Clear
            </button>
          </div>
        </div>

        <div className="kd-workspace">
          {/* Left sidebar — station controls */}
          <div className="kd-sidebar">
            <div className="kd-sidebar-scroll">
              <div className="kd-section">
                <div className="kd-section-title">Station Capacity</div>
                {STATION_ORDER.map(type => {
                  const station = state.stations[type]
                  const capVal = capacities[type] ?? station?.totalCapacity ?? 3
                  return (
                    <div key={type} className="sem-row">
                      <span
                        className="sem-label"
                        style={{ color: STATION_COLORS[type] }}
                      >
                        {STATION_EMOJI[type]} {type.slice(0, 4)}
                      </span>
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
            </div>
          </div>

          {/* Kanban */}
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
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6, scale: 0.97 }}
                              transition={{ duration: 0.16 }}
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
          </div>

          {/* Concurrency panel */}
          <div className="kd-conc">
            <div className="kd-conc-header">Concurrency State</div>
            <div className="kd-conc-scroll">

              {/* Semaphores */}
              <div className="kd-conc-section">
                <div className="kd-conc-section-title">Semaphores — Station Permits</div>
                {STATION_ORDER.map(type => {
                  const s = state.stations[type]
                  const total = s?.totalCapacity ?? 0
                  const active = s?.activeThreads ?? 0
                  const waiting = s?.waitingThreads ?? 0
                  const free = Math.max(0, total - active)
                  const color = STATION_COLORS[type]

                  const slots = Array.from({ length: total }, (_, i) => {
                    if (i < active) return 'active'
                    if (i < active + waiting) return 'waiting' // visually show "would wait"
                    return 'free'
                  })

                  return (
                    <div key={type} className="sem-vis-row">
                      <div className="sem-vis-top">
                        <span className="sem-vis-name" style={{ color }}>
                          {STATION_EMOJI[type]} {type.slice(0, 5)}
                        </span>
                        <div className="sem-vis-slots">
                          {slots.map((kind, i) => (
                            <div
                              key={i}
                              className="sem-vis-slot"
                              style={{
                                background:
                                  kind === 'active'  ? color :
                                  kind === 'waiting' ? `${color}55` :
                                  'var(--border)',
                              }}
                              title={
                                kind === 'active'  ? 'Permit held (cooking)' :
                                kind === 'waiting' ? 'Would be waiting' :
                                'Free slot'
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <div className="sem-vis-legend">
                        <span style={{ color }}>● {active} cooking</span>
                        {waiting > 0 && <span style={{ color: `${color}99` }}>◑ {waiting} waiting</span>}
                        <span>○ {free} free</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Barriers */}
              <div className="kd-conc-section">
                <div className="kd-conc-section-title">CyclicBarrier — Order Sync</div>
                {activeBarriers.length === 0 ? (
                  <div className="kd-empty-note">No active barriers</div>
                ) : (
                  activeBarriers.map(b => {
                    const pct = b.total > 0 ? Math.round((b.arrived / b.total) * 100) : 0
                    return (
                      <div key={b.orderId} className="barrier-row">
                        <div className="barrier-top">
                          <span className="barrier-id">#{b.orderId.slice(0, 8)}</span>
                          {b.tableNumber != null && (
                            <span className="barrier-table">T{b.tableNumber}</span>
                          )}
                        </div>
                        <div className="barrier-progress-row">
                          <div className="barrier-bar-wrap">
                            <div
                              className="barrier-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: 'var(--purple)',
                              }}
                            />
                          </div>
                          <span className="barrier-fraction">{b.arrived}/{b.total}</span>
                        </div>
                        <div className="barrier-label">
                          {b.arrived === 0
                            ? 'Waiting for all stations to arrive'
                            : `${b.arrived} station${b.arrived !== 1 ? 's' : ''} arrived — waiting for ${b.total - b.arrived} more`}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Active threads */}
              <div className="kd-conc-section">
                <div className="kd-conc-section-title">Thread Activity</div>
                {STATION_ORDER.map(type => {
                  const s = state.stations[type]
                  const active = s?.activeThreads ?? 0
                  const waiting = s?.waitingThreads ?? 0
                  if (active === 0 && waiting === 0) return null
                  return (
                    <div key={type} style={{ marginBottom: 8, fontSize: 11 }}>
                      <span style={{ color: STATION_COLORS[type], fontWeight: 700 }}>
                        {STATION_EMOJI[type]} {type}
                      </span>
                      <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                        {active} thread{active !== 1 ? 's' : ''} running
                        {waiting > 0 && `, ${waiting} waiting for permit`}
                      </span>
                    </div>
                  )
                })}
                {totalActiveThreads === 0 && (
                  <div className="kd-empty-note">All stations idle</div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
