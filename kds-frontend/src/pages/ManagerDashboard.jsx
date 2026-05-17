import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useKitchen } from '../context/KitchenContext'

const STATION_ORDER = ['GRILL', 'FRYER', 'SALAD', 'DRINKS', 'DESSERT']
const STATION_COLORS = {
  GRILL: '#e8622a', FRYER: '#f0b429', SALAD: '#34d399', DRINKS: '#60a5fa', DESSERT: '#c084fc',
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: 36, fontWeight: 900, fontFamily: 'Courier New', color: color ?? 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</span>}
    </div>
  )
}

const TOOLTIP_STYLE = {
  background: 'var(--panel)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text)', fontSize: 11,
}

export default function ManagerDashboard() {
  const { state } = useKitchen()
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  const orders = Object.values(state.orders)

  const completionTimes = useMemo(() => {
    return orders
      .filter(o => o.readyAt && o.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((o, i) => ({
        n: i + 1,
        secs: Math.round((new Date(o.readyAt) - new Date(o.createdAt)) / 1000),
      }))
  }, [orders])

  const avgCompletion = useMemo(() => {
    if (!completionTimes.length) return null
    return (completionTimes.reduce((s, c) => s + c.secs, 0) / completionTimes.length).toFixed(1)
  }, [completionTimes])

  const stationBarData = useMemo(() => {
    return STATION_ORDER.map(type => ({
      name: type,
      utilization: Math.round(state.stations[type]?.utilizationPercent ?? 0),
    }))
  }, [state.stations])

  const busiestStation = useMemo(() => {
    let best = null, bestPct = -1
    for (const type of STATION_ORDER) {
      const pct = state.stations[type]?.utilizationPercent ?? 0
      if (pct > bestPct) { bestPct = pct; best = type }
    }
    return best ? `${best} (${Math.round(bestPct)}%)` : '—'
  }, [state.stations])

  const totalActiveThreads = useMemo(() =>
    STATION_ORDER.reduce((s, t) => s + (state.stations[t]?.activeThreads ?? 0), 0),
    [state.stations]
  )

  const busiestStationRaw = useMemo(() => {
    let best = null, bestPct = -1
    for (const type of STATION_ORDER) {
      const pct = state.stations[type]?.utilizationPercent ?? 0
      if (pct > bestPct) { bestPct = pct; best = type }
    }
    return best ? { type: best, pct: Math.round(bestPct) } : null
  }, [state.stations])

  const awaitingCollect = orders.filter(o => o.orderStatus === 'READY').length
  const barrierCount = orders.filter(o =>
    o.orderStatus === 'IN_PREPARATION' || o.orderStatus === 'PENDING'
  ).length

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function completionSecsForOrder(o) {
    if (!o.readyAt || !o.createdAt) return null
    return Math.round((new Date(o.readyAt) - new Date(o.createdAt)) / 1000)
  }

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let va, vb
      if (sortField === 'timeToReady') {
        va = completionSecsForOrder(a) ?? Infinity
        vb = completionSecsForOrder(b) ?? Infinity
      } else {
        va = new Date(a[sortField] ?? a.createdAt).getTime()
        vb = new Date(b[sortField] ?? b.createdAt).getTime()
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [orders, sortField, sortDir])

  function SortHeader({ field, children }) {
    const active = sortField === field
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{ cursor: 'pointer', userSelect: 'none', color: active ? 'var(--text)' : 'var(--muted)' }}
      >
        {children} {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </th>
    )
  }

  return (
    <>
      <style>{`
        .md-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .md-title { font-size: 22px; font-weight: 700; letter-spacing: 1px; margin-bottom: 20px; }
        .md-stat-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;
        }
        .md-charts-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;
        }
        .md-panel {
          background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px;
        }
        .md-panel-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); margin-bottom: 16px;
        }
        .md-table-wrap { overflow-x: auto; margin-bottom: 24px; }
        .md-table {
          width: 100%; border-collapse: collapse; font-size: 11px;
          background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
        }
        .md-table th {
          text-align: left; padding: 9px 12px;
          font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--muted); border-bottom: 1px solid var(--border); background: var(--card);
        }
        .md-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .md-table tr:last-child td { border-bottom: none; }
        .md-row-ready td { background: rgba(52,211,153,0.06); }
        .md-row-cancel td { opacity: 0.45; text-decoration: line-through; }
        .md-mono { font-family: 'Courier New', monospace; font-size: 10px; color: var(--muted); }
        .md-badge {
          font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
          padding: 2px 6px; border-radius: 3px; border: 1px solid;
        }
        .md-legend { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
        .md-legend-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); margin-bottom: 16px;
        }
        .md-legend-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .md-legend-item {
          background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;
        }
        .md-legend-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .md-legend-val { font-size: 18px; font-weight: 800; font-family: 'Courier New', monospace; }
        .md-legend-desc { font-size: 10px; color: var(--muted); margin-top: 4px; }
        @media (max-width: 1000px) {
          .md-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .md-charts-row { grid-template-columns: 1fr; }
          .md-legend-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="md-page">
        <div className="md-title">Manager Dashboard</div>

        <div className="md-stat-grid">
          <StatCard label="Total Orders" value={orders.length} />
          <StatCard
            label="Avg Completion"
            value={avgCompletion !== null ? `${avgCompletion}s` : '—'}
            color="var(--gold)"
            sub={`from ${completionTimes.length} completed orders`}
          />
          <StatCard
            label="Busiest Station"
            value={busiestStation}
            color="var(--accent)"
          />
          <StatCard
            label="Active Threads"
            value={totalActiveThreads}
            color="var(--blue)"
          />
        </div>

        <div className="md-charts-row">
          <div className="md-panel">
            <div className="md-panel-title">Completion Time Trend</div>
            {completionTimes.length === 0 ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No completed orders yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={completionTimes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="n" tick={{ fontSize: 10, fill: 'var(--muted)' }} label={{ value: 'Order #', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} unit="s" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}s`, 'Time']} />
                  <Line type="monotone" dataKey="secs" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="md-panel">
            <div className="md-panel-title">Station Utilization</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stationBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Utilization']} />
                <Bar dataKey="utilization" radius={[3, 3, 0, 0]}>
                  {stationBarData.map((entry) => (
                    <Cell key={entry.name} fill={STATION_COLORS[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Table</th>
                <th>Items</th>
                <th>Stations</th>
                <SortHeader field="timeToReady">Time to Ready</SortHeader>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => {
                const secs = completionSecsForOrder(order)
                const isReady = order.orderStatus === 'READY' || order.orderStatus === 'COLLECTED'
                const isCancelled = order.orderStatus === 'CANCELLED'
                const stations = [...new Set((order.components ?? []).map(c => c.stationType))].join(', ')
                const statusColor = isReady ? 'var(--green)' : isCancelled ? 'var(--accent)' : 'var(--muted)'

                return (
                  <tr
                    key={order.id}
                    className={isReady ? 'md-row-ready' : isCancelled ? 'md-row-cancel' : ''}
                  >
                    <td className="md-mono">#{order.id?.slice(0, 8)}</td>
                    <td style={{ fontWeight: 700 }}>T{order.tableNumber}</td>
                    <td>{(order.components ?? []).length}</td>
                    <td style={{ fontSize: 10, color: 'var(--muted)' }}>{stations || '—'}</td>
                    <td style={{ fontFamily: 'Courier New', fontSize: 11 }}>
                      {secs !== null ? `${secs}s` : '—'}
                    </td>
                    <td>
                      <span className="md-badge" style={{ color: statusColor, borderColor: statusColor }}>
                        {order.orderStatus}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md-legend">
          <div className="md-legend-title">Parallel Concepts — Live Counts</div>
          <div className="md-legend-grid">
            <div className="md-legend-item">
              <div className="md-legend-label">Threads</div>
              <div className="md-legend-val" style={{ color: 'var(--blue)' }}>{totalActiveThreads}</div>
              <div className="md-legend-desc">threads currently active across all stations</div>
            </div>
            <div className="md-legend-item">
              <div className="md-legend-label">Semaphores</div>
              <div className="md-legend-val" style={{ color: 'var(--gold)' }}>
                {busiestStationRaw
                  ? `${busiestStationRaw.type} ${state.stations[busiestStationRaw.type]?.activeThreads ?? 0}/${state.stations[busiestStationRaw.type]?.totalCapacity ?? '?'}`
                  : '—'}
              </div>
              <div className="md-legend-desc">busiest station slot usage</div>
            </div>
            <div className="md-legend-item">
              <div className="md-legend-label">Barriers Open</div>
              <div className="md-legend-val" style={{ color: 'var(--purple)' }}>{barrierCount}</div>
              <div className="md-legend-desc">orders with active CyclicBarrier (awaiting all stations)</div>
            </div>
            <div className="md-legend-item">
              <div className="md-legend-label">Condition Waits</div>
              <div className="md-legend-val" style={{ color: 'var(--green)' }}>{awaitingCollect}</div>
              <div className="md-legend-desc">orders READY — awaiting collect() signal</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
