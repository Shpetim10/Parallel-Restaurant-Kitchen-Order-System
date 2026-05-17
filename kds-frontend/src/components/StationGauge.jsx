const SIZE = 180
const STROKE = 16
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R
const CENTER = SIZE / 2

function arcColor(pct) {
  if (pct > 80) return 'var(--accent)'
  if (pct > 50) return 'var(--gold)'
  return 'var(--green)'
}

const STATION_EMOJI = {
  GRILL:   '🔥',
  FRYER:   '🍟',
  SALAD:   '🥗',
  DRINKS:  '🥤',
  DESSERT: '🍰',
}

export default function StationGauge({ station }) {
  const {
    stationType,
    utilizationPercent = 0,
    availableSlots = 0,
    totalCapacity = 0,
    activeThreads = 0,
    totalProcessed = 0,
  } = station ?? {}

  const pct = Math.min(100, Math.max(0, utilizationPercent))
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100)
  const color = arcColor(pct)
  const emoji = STATION_EMOJI[stationType] ?? '🍽'

  return (
    <>
      <style>{`
        .gauge-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: ${SIZE}px;
        }
        .gauge-svg { display: block; }
        .gauge-center-text {
          font-size: 22px;
          font-weight: 700;
          fill: var(--text);
          dominant-baseline: middle;
          text-anchor: middle;
        }
        .gauge-label {
          font-size: 11px;
          fill: var(--muted);
          dominant-baseline: middle;
          text-anchor: middle;
        }
        .gauge-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 100%;
        }
        .gauge-info-row {
          font-size: 12px;
          color: var(--muted);
          text-align: center;
        }
        .gauge-info-row strong {
          color: var(--text);
        }
      `}</style>
      <div className="gauge-wrap">
        <svg width={SIZE} height={SIZE} className="gauge-svg">
          <circle
            cx={CENTER} cy={CENTER} r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={CENTER} cy={CENTER} r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
          />
          <text x={CENTER} y={CENTER - 10} className="gauge-center-text">
            {Math.round(pct)}%
          </text>
          <text x={CENTER} y={CENTER + 14} className="gauge-label">
            {emoji} {stationType}
          </text>
        </svg>

        <div className="gauge-info">
          <div className="gauge-info-row">
            <strong>{availableSlots}</strong> / {totalCapacity} slots free
          </div>
          <div className="gauge-info-row">
            <strong>{activeThreads}</strong> active threads
          </div>
          <div className="gauge-info-row" style={{ fontSize: 10 }}>
            {totalProcessed} total processed
          </div>
        </div>
      </div>
    </>
  )
}
