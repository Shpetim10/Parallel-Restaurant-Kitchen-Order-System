import { AnimatePresence, motion } from 'framer-motion'

const TYPE_CONFIG = {
  success: { bg: '#16a34a', border: '#4ade80', color: '#fff' },
  error:   { bg: '#b91c1c', border: '#f87171', color: '#fff' },
  info:    { bg: '#2563eb', border: '#60a5fa', color: '#fff' },
  ready:   { bg: '#f0b429', border: '#fde68a', color: '#1a1200' },
}

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <AnimatePresence>
        {toasts.map(toast => {
          const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.info
          return (
            <motion.div
              key={toast.id}
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={() => removeToast(toast.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 8,
                border: `1px solid ${cfg.border}`,
                background: cfg.bg,
                color: cfg.color,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: 220,
                maxWidth: 320,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ flex: 1 }}>{toast.message}</span>
              <span style={{ opacity: 0.6, fontSize: 12 }}>✕</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
