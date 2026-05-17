import { useState, useEffect } from 'react'

export default function ConnectionBanner({ status }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (status === 'CONNECTED') setDismissed(false)
  }, [status])

  if (status === 'CONNECTED' || dismissed) return null

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: 0,
      right: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#f0b429',
      color: '#1a1200',
      padding: '8px 20px',
      fontSize: 13,
      fontWeight: 600,
    }}>
      <span>Lost connection to kitchen — data may be stale. Reconnecting…</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 16,
          color: '#1a1200',
          marginLeft: 16,
          opacity: 0.7,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
