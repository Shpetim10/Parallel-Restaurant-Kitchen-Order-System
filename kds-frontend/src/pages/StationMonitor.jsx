import { useState, useEffect, useRef } from 'react'
import { useKitchen } from '../context/KitchenContext'
import StationGauge from '../components/StationGauge'
import ThreadActivityBar from '../components/ThreadActivityBar'
import { updateCapacity } from '../api/stationApi'

const STATION_ORDER = ['GRILL', 'FRYER', 'SALAD', 'DRINKS', 'DESSERT']

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
}

function NewRowHighlight({ children, isNew }) {
  return (
    <tr style={{
      background: isNew ? 'rgba(240,180,41,0.18)' : 'transparent',
      transition: 'background 1.2s ease',
    }}>
      {children}
    </tr>
  )
}

export default function StationMonitor() {
  const { state } = useKitchen()
  const [capacities, setCapacities] = useState({})
  const [saving, setSaving] = useState({})
  const [newestEventId, setNewestEventId] = useState(null)
  const prevEventCountRef = useRef(0)

  useEffect(() => {
    const count = state.recentEvents.length
    if (count > prevEventCountRef.current) {
      const newest = state.recentEvents[0]
      const id = newest?.orderId ?? newest?.componentId ?? Math.random()
      setNewestEventId(id)
      const t = setTimeout(() => setNewestEventId(null), 1400)
      prevEventCountRef.current = count
      return () => clearTimeout(t)
    }
    prevEventCountRef.current = count
  }, [state.recentEvents])

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

  const atCapacity = STATION_ORDER.filter(type => {
    const s = state.stations[type]
    return s && s.utilizationPercent >= 100
  })

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
        .sm-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .sm-header { margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
        .sm-title { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
        .sm-live-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--green);
          animation: pulse-dot 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }
        .sm-panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .sm-panel-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;
          color: var(--muted); margin-bottom: 16px;
        }
        .sm-gauges-scroll {
          display: flex; gap: 20px; overflow-x: auto; padding-bottom: 8px;
        }
        .sm-gauge-col {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          flex-shrink: 0;
        }
        .sm-slider-row {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          width: 100%;
        }
        .sm-slider-label {
          font-size: 10px; color: var(--muted);
          display: flex; align-items: center; justify-content: space-between; width: 100%;
        }
        .sm-slider {
          width: 100%; accent-color: var(--accent);
          cursor: pointer;
        }
        .sm-slider-btn {
          background: var(--accent); color: #fff; border: none; border-radius: 4px;
          padding: 3px 10px; font-size: 11px; font-weight: 700; cursor: pointer;
          transition: opacity 0.15s; width: 100%;
        }
        .sm-slider-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sm-warn {
          background: rgba(232,98,42,0.1);
          border: 1px solid var(--accent);
          border-radius: 7px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 20px;
          letter-spacing: 0.5px;
        }
        .sm-table-wrap { overflow-x: auto; }
        .sm-table {
          width: 100%; border-collapse: collapse;
          font-size: 11px;
        }
        .sm-table th {
          text-align: left; padding: 7px 10px;
          font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: var(--muted);
          border-bottom: 1px solid var(--border);
        }
        .sm-table td {
          padding: 7px 10px; border-bottom: 1px solid var(--border);
          color: var(--text); vertical-align: middle;
        }
        .sm-table tr:last-child td { border-bottom: none; }
        .sm-ev-type {
          font-family: 'Courier New', monospace;
          font-size: 10px; font-weight: 700;
        }
        .sm-ev-station {
          font-weight: 600; font-size: 11px;
        }
        .sm-ev-mono {
          font-family: 'Courier New', monospace; font-size: 10px; color: var(--muted);
        }
        .sm-empty { color: var(--muted); font-size: 12px; padding: 20px 0; text-align: center; }
      `}</style>

      <div className="sm-page">
        <div className="sm-header">
          <div className="sm-live-dot" />
          <div className="sm-title">Station Monitor</div>
        </div>

        {atCapacity.length > 0 && (
          <div className="sm-warn">
            ⚠ Station{atCapacity.length > 1 ? 's' : ''} at 100% utilization: {atCapacity.join(', ')}
          </div>
        )}

        <div className="sm-panel">
          <div className="sm-panel-title">Station Gauges — Semaphore Utilization</div>
          <div className="sm-gauges-scroll">
            {STATION_ORDER.map(type => {
              const station = state.stations[type]
              const capVal = capacities[type] ?? station?.totalCapacity ?? 3
              return (
                <div key={type} className="sm-gauge-col">
                  <StationGauge station={station ?? { stationType: type }} />
                  <div className="sm-slider-row">
                    <div className="sm-slider-label">
                      <span>Capacity</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>{capVal}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={capVal}
                      onChange={e => setCapacities(p => ({ ...p, [type]: Number(e.target.value) }))}
                      className="sm-slider"
                    />
                    <button
                      className="sm-slider-btn"
                      disabled={!!saving[type]}
                      onClick={() => handleCapacityChange(type, capVal)}
                    >
                      {saving[type] ? '…' : 'Apply'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="sm-panel">
          <div className="sm-panel-title">Thread Activity</div>
          <ThreadActivityBar stations={state.stations} />
        </div>

        <div className="sm-panel">
          <div className="sm-panel-title">Semaphore Event Log</div>
          <div className="sm-table-wrap">
            {state.recentEvents.length === 0 ? (
              <div className="sm-empty">No events yet</div>
            ) : (
              <table className="sm-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Station</th>
                    <th>Event</th>
                    <th>Thread / Order</th>
                    <th>Active</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recentEvents.map((ev, i) => {
                    const stationType = ev.stationType ?? ev.station ?? '—'
                    const station = state.stations[stationType]
                    const active = station?.activeThreads ?? '—'
                    const available = station?.availableSlots ?? '—'
                    const rowId = ev.orderId ?? ev.componentId ?? i
                    const isNew = i === 0 && rowId === newestEventId

                    return (
                      <NewRowHighlight key={i} isNew={isNew}>
                        <td className="sm-ev-mono">{fmtTime(ev.timestamp ?? ev.createdAt)}</td>
                        <td className="sm-ev-station">{stationType}</td>
                        <td>
                          <span
                            className="sm-ev-type"
                            style={{
                              color: ev.eventType === 'ORDER_READY' ? 'var(--green)'
                                : ev.eventType === 'ORDER_CANCELLED' ? 'var(--accent)'
                                : 'var(--blue)',
                            }}
                          >
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="sm-ev-mono">
                          {ev.orderId ? ev.orderId.slice(0, 8) : '—'}
                        </td>
                        <td style={{ color: 'var(--gold)', fontFamily: 'Courier New', fontSize: 11 }}>
                          {active}
                        </td>
                        <td style={{ color: 'var(--green)', fontFamily: 'Courier New', fontSize: 11 }}>
                          {available}
                        </td>
                      </NewRowHighlight>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
