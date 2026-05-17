import { Link, useLocation } from 'react-router-dom'
import { useKitchen } from '../context/KitchenContext'

const NAV_LINKS = [
  { to: '/kitchen', label: 'Kitchen' },
  { to: '/manager', label: 'Dashboard' },
]

const STATUS_CONFIG = {
  CONNECTED:    { color: 'var(--green)',  pulse: true,  label: 'Connected' },
  RECONNECTING: { color: 'var(--gold)',   pulse: false, label: 'Reconnecting…' },
  DISCONNECTED: { color: 'var(--accent)', pulse: false, label: 'Disconnected' },
  FAILED:       { color: 'var(--accent)', pulse: false, label: 'Connection failed' },
}

export default function Navbar() {
  const location = useLocation()
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
          gap: 0;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-right: 24px;
        }
        .navbar-brand-title {
          font-weight: 800;
          font-size: 17px;
          color: var(--text);
          letter-spacing: 0.5px;
        }
        .navbar-brand-subtitle {
          font-size: 12px;
          color: var(--muted);
        }
        .navbar-links {
          display: flex;
          gap: 2px;
          flex: 1;
        }
        .navbar-link {
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          text-decoration: none;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .navbar-link:hover {
          color: var(--text);
          background: var(--card);
        }
        .navbar-link.active {
          color: var(--accent);
          background: rgba(232,98,42,0.1);
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
          <div>
            <div className="navbar-brand-title">KDS</div>
          </div>
          <span className="navbar-brand-subtitle">Kitchen Display System</span>
        </div>

        <div className="navbar-links">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`navbar-link${
                location.pathname === to || (to === '/kitchen' && location.pathname === '/')
                  ? ' active'
                  : ''
              }`}
            >
              {label}
            </Link>
          ))}
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
