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
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .tab-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tab-label {
          font-size: 12px;
          color: var(--muted);
          width: 76px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .tab-bar-track {
          flex: 1;
          height: 10px;
          background: var(--border);
          border-radius: 5px;
          overflow: hidden;
        }
        .tab-bar-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.4s ease;
          min-width: 0;
        }
        .tab-count {
          font-size: 11px;
          color: var(--text);
          font-family: 'Courier New', monospace;
          width: 28px;
          text-align: right;
          flex-shrink: 0;
        }
      `}</style>
      <div className="tab-wrap">
        {ORDER.map(type => {
          const meta = STATION_META[type]
          const station = stations?.[type]
          const active = station?.activeThreads ?? 0
          const capacity = station?.totalCapacity ?? meta.capacity
          const fillPct = capacity > 0 ? Math.min(100, (active / capacity) * 100) : 0

          return (
            <div key={type} className="tab-row">
              <span className="tab-label">
                {meta.emoji} {meta.label}
              </span>
              <div className="tab-bar-track">
                <div
                  className="tab-bar-fill"
                  style={{ width: `${fillPct}%`, background: meta.color }}
                />
              </div>
              <span className="tab-count">{active}/{capacity}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
