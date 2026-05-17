import { useState, useEffect } from 'react'
import axios from 'axios'

export default function SimulationControls({ onClearAll }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    axios.get('/api/simulation/status')
      .then(r => setActive(r.data.active))
      .catch(() => {})
  }, [])

  const toggle = async () => {
    try {
      if (active) {
        await axios.post('/api/simulation/stop')
        setActive(false)
      } else {
        await axios.post('/api/simulation/start')
        setActive(true)
      }
    } catch (err) {
      console.error('Simulation toggle failed:', err)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {active && (
        <span style={{
          background: '#f0b429',
          color: '#1a1200',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 12,
          letterSpacing: 1,
        }}>
          AUTO MODE
        </span>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {onClearAll && (
          <button
            onClick={onClearAll}
            style={{
              padding: '8px 14px',
              borderRadius: 7,
              background: '#2a2a40',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Clear All
          </button>
        )}
        <button
          onClick={toggle}
          style={{
            padding: '8px 14px',
            borderRadius: 7,
            background: active ? '#b91c1c' : '#16a34a',
            border: 'none',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {active ? 'Stop Demo' : 'Start Demo'}
        </button>
      </div>
    </div>
  )
}
