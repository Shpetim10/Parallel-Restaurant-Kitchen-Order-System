import { useKitchen } from '../context/KitchenContext'

const STATUS_CONFIG = {
  CONNECTED:    { color: 'var(--green)',  pulse: true,  label: 'Live' },
  RECONNECTING: { color: 'var(--gold)',   pulse: false, label: 'Reconnecting…' },
  DISCONNECTED: { color: 'var(--accent)', pulse: false, label: 'Disconnected' },
  FAILED:       { color: 'var(--accent)', pulse: false, label: 'Connection failed' },
}

export default function Navbar() {
  const { state } = useKitchen()
  const cfg = STATUS_CONFIG[state.connectionStatus] ?? STATUS_CONFIG.DISCONNECTED

  return (
    <>
      <style>{`
        .navbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 56px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 20px;
          z-index: 100;
          gap: 12px;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }
        .navbar-title {
          font-weight: 800;
          font-size: 16px;
          color: var(--text);
          letter-spacing: 0.5px;
        }
        .navbar-sub {
          font-size: 12px;
          color: var(--muted);
        }
        .navbar-status {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .status-dot.pulse {
          animation: pulse-dot 1.4s ease-in-out infinite;
        }
      `}</style>
      <nav className="navbar">
        <div className="navbar-brand">
          <span style={{ fontSize: 22 }}>🔥</span>
          <span className="navbar-title">Kitchen Display System</span>
          <span className="navbar-sub">Parallel Order Processing</span>
        </div>
        <div className="navbar-status">
          <span
            className={`status-dot${cfg.pulse ? ' pulse' : ''}`}
            style={{ background: cfg.color }}
          />
          <span style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </nav>
    </>
  )
}
