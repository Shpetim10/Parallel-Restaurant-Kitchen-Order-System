import { useEffect, useState } from 'react'
import { fetchMenu, submitOrder } from '../api/orderApi'

const STATION_COLORS = {
  GRILL:   'var(--accent)',
  FRYER:   'var(--gold)',
  SALAD:   'var(--green)',
  DRINKS:  'var(--blue)',
  DESSERT: 'var(--purple)',
}

const STATION_EMOJI = {
  GRILL: '🔥', FRYER: '🍟', SALAD: '🥗', DRINKS: '🥤', DESSERT: '🍰',
}

function msToSec(ms) {
  return (ms / 1000).toFixed(1) + 's'
}

function distinctStations(items) {
  return new Set(items.map(i => i.stationType)).size
}

export default function OrderBuilder({ onSubmit, compact = false }) {
  const [menu, setMenu] = useState([])
  const [tableNumber, setTableNumber] = useState(1)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMenu().then(setMenu).catch(() => {})
  }, [])

  function addItem(item) {
    setCart(prev => [...prev, { ...item, _cartId: `${item.id}-${Date.now()}` }])
  }

  function removeItem(cartId) {
    setCart(prev => prev.filter(i => i._cartId !== cartId))
  }

  async function handleSubmit() {
    if (cart.length === 0 || !tableNumber) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        tableNumber,
        items: cart.map(i => ({
          name: i.name,
          stationType: i.stationType,
          cookTimeMs: i.baseCookTimeMs ?? i.defaultCookTimeMs ?? 5000,
        })),
      }
      const order = await submitOrder(payload)
      setCart([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onSubmit?.(order)
    } catch (e) {
      setError('Failed to submit order. Check backend.')
    } finally {
      setLoading(false)
    }
  }

  const stationCount = distinctStations(cart)
  const estimatedMs = cart.length > 0
    ? Math.max(...Object.values(
        cart.reduce((acc, i) => {
          const t = i.stationType
          acc[t] = (acc[t] ?? 0) + (i.baseCookTimeMs ?? i.defaultCookTimeMs ?? 5000)
          return acc
        }, {})
      ))
    : 0

  return (
    <>
      <style>{`
        .ob-wrap {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .ob-wrap.compact {
          flex-direction: column;
          gap: 12px;
        }
        .ob-wrap.compact .ob-right {
          width: auto;
        }
        .ob-wrap.compact .ob-menu-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        }
        .ob-wrap.compact .ob-cart-list {
          max-height: 140px;
        }
        .ob-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ob-section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .ob-table-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ob-table-input {
          width: 80px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 5px;
          color: var(--text);
          font-size: 16px;
          font-weight: 700;
          padding: 6px 10px;
          text-align: center;
        }
        .ob-table-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .ob-menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
        }
        .ob-menu-item {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 10px 10px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 3px;
          transition: border-color 0.15s, background 0.15s;
        }
        .ob-menu-item:hover {
          border-color: var(--accent);
          background: var(--panel);
        }
        .ob-menu-emoji { font-size: 22px; }
        .ob-menu-name { font-size: 12px; font-weight: 600; color: var(--text); }
        .ob-menu-meta { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
        .ob-station-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 3px;
          letter-spacing: 0.5px;
        }
        .ob-cook-time { font-size: 10px; color: var(--muted); }

        .ob-right {
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ob-cart-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 260px;
          overflow-y: auto;
        }
        .ob-cart-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 6px 8px;
        }
        .ob-cart-name { flex: 1; font-size: 12px; color: var(--text); }
        .ob-cart-station { font-size: 10px; color: var(--muted); }
        .ob-remove-btn {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0 2px;
          flex-shrink: 0;
        }
        .ob-summary-box {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ob-summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .ob-summary-label {
          color: var(--muted);
        }
        .ob-summary-value {
          font-weight: 700;
          color: var(--text);
        }
        .ob-submit-btn {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 11px 0;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1px;
          cursor: pointer;
          width: 100%;
          transition: opacity 0.15s;
        }
        .ob-submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .ob-submit-btn:not(:disabled):hover { opacity: 0.85; }
        .ob-success {
          font-size: 12px;
          color: var(--green);
          text-align: center;
          font-weight: 600;
        }
        .ob-error {
          font-size: 12px;
          color: var(--accent);
          text-align: center;
        }
        .ob-empty {
          font-size: 12px;
          color: var(--muted);
          text-align: center;
          padding: 16px 0;
        }
      `}</style>
      <div className={`ob-wrap${compact ? ' compact' : ''}`}>
        <div className="ob-left">
          <div>
            <div className="ob-section-title">Table Number</div>
            <div className="ob-table-row">
              <input
                type="number"
                min={1}
                max={50}
                value={tableNumber}
                onChange={e => setTableNumber(Number(e.target.value))}
                className="ob-table-input"
              />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>1 – 50</span>
            </div>
          </div>

          <div>
            <div className="ob-section-title">Menu — click to add</div>
            <div className="ob-menu-grid">
              {menu.map(item => (
                <div key={item.id} className="ob-menu-item" onClick={() => addItem(item)}>
                  <span className="ob-menu-emoji">{item.emoji ?? STATION_EMOJI[item.stationType]}</span>
                  <span className="ob-menu-name">{item.name}</span>
                  <div className="ob-menu-meta">
                    <span
                      className="ob-station-badge"
                      style={{
                        background: `${STATION_COLORS[item.stationType]}22`,
                        color: STATION_COLORS[item.stationType],
                      }}
                    >
                      {item.stationType}
                    </span>
                    <span className="ob-cook-time">
                      ~{msToSec(item.baseCookTimeMs ?? item.defaultCookTimeMs ?? 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ob-right">
          <div>
            <div className="ob-section-title">Order ({cart.length} items)</div>
            <div className="ob-cart-list">
              {cart.length === 0 && (
                <div className="ob-empty">No items added yet</div>
              )}
              {cart.map(item => (
                <div key={item._cartId} className="ob-cart-item">
                  <span>{STATION_EMOJI[item.stationType]}</span>
                  <span className="ob-cart-name">{item.name}</span>
                  <span className="ob-cart-station">{item.stationType?.slice(0, 3)}</span>
                  <button className="ob-remove-btn" onClick={() => removeItem(item._cartId)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="ob-summary-box">
            <div className="ob-summary-row">
              <span className="ob-summary-label">Stations</span>
              <span className="ob-summary-value">{stationCount || '—'}</span>
            </div>
            <div className="ob-summary-row">
              <span className="ob-summary-label">Est. ready in</span>
              <span className="ob-summary-value" style={{ color: 'var(--gold)' }}>
                {cart.length > 0 ? `~${msToSec(estimatedMs)}` : '—'}
              </span>
            </div>
          </div>

          <button
            className="ob-submit-btn"
            disabled={cart.length === 0 || !tableNumber || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting…' : 'SUBMIT ORDER'}
          </button>

          {success && <div className="ob-success">Order submitted successfully!</div>}
          {error   && <div className="ob-error">{error}</div>}
        </div>
      </div>
    </>
  )
}
