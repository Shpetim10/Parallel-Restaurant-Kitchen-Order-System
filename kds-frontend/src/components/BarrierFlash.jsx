import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function BarrierFlash({ orderId, tableNumber, onComplete }) {
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const id = setTimeout(() => onCompleteRef.current(), 2200)
    return () => clearTimeout(id)
  }, [orderId])

  return (
    <AnimatePresence>
      <motion.div
        key={orderId}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.3, exit: { duration: 0.4, delay: 1.5 } }}
        onClick={() => onCompleteRef.current()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(52, 211, 153, 0.18)',
          backdropFilter: 'blur(4px)',
          cursor: 'pointer',
        }}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          style={{
            background: 'var(--green)',
            borderRadius: 16,
            padding: '40px 72px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 0 80px 20px rgba(52, 211, 153, 0.4)',
          }}
        >
          <span style={{ fontSize: 56 }}>✓</span>
          <span style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#000',
            letterSpacing: 6,
          }}>
            READY
          </span>
          <span style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'rgba(0,0,0,0.7)',
            letterSpacing: 2,
          }}>
            Table {tableNumber}
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
