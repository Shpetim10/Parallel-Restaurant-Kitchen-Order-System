const STATION_META = {
  GRILL:   { emoji: '🔥', label: 'Grill',   color: '#e8622a', capacity: 3 },
  FRYER:   { emoji: '🍟', label: 'Fryer',   color: '#f0b429', capacity: 2 },
  SALAD:   { emoji: '🥗', label: 'Salad',   color: '#34d399', capacity: 4 },
  DRINKS:  { emoji: '🥤', label: 'Drinks',  color: '#60a5fa', capacity: 5 },
  DESSERT: { emoji: '🍰', label: 'Dessert', color: '#c084fc', capacity: 2 },
}

const ORDER = ['GRILL', 'FRYER', 'SALAD', 'DRINKS', 'DESSERT']

export default function ThreadActivityBar({ stations }) {
  return (
    <>
      <style>{`
        .tab-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 100%;
        }
        .tab-station {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          flex: 1;
          min-width: 0;
        }
        .tab-station-top {
          display: flex;
          align-items: center;
          gap: 3px;
          width: 100%;
        }
        .tab-emoji {
          font-size: 11px;
          flex-shrink: 0;
        }
        .tab-bar-track {
          flex: 1;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
          min-width: 0;
        }
        .tab-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .tab-count {
          font-size: 9px;
          color: var(--muted);
          font-family: 'Courier New', monospace;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tab-divider {
          width: 1px;
          height: 24px;
          background: var(--border);
          flex-shrink: 0;
        }
      `}</style>
      <div className="tab-wrap">
        {ORDER.map((type, i) => {
          const meta = STATION_META[type]
          const station = stations?.[type]
          const active = station?.activeThreads ?? 0
          const capacity = station?.totalCapacity ?? meta.capacity
          const fillPct = capacity > 0 ? Math.min(100, (active / capacity) * 100) : 0

          return (
            <>
              {i > 0 && <div key={`div-${type}`} className="tab-divider" />}
              <div key={type} className="tab-station" title={`${meta.label}: ${active}/${capacity} threads`}>
                <div className="tab-station-top">
                  <span className="tab-emoji">{meta.emoji}</span>
                  <div className="tab-bar-track">
                    <div
                      className="tab-bar-fill"
                      style={{ width: `${fillPct}%`, background: meta.color }}
                    />
                  </div>
                </div>
                <span className="tab-count">{active}/{capacity}</span>
              </div>
            </>
          )
        })}
      </div>
    </>
  )
}
