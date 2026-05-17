import { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import kitchenReducer, { initialState } from '../reducers/kitchenReducer'
import { useKitchenSocket } from '../hooks/useKitchenSocket'
import { useToast } from '../hooks/useToast'
import { fetchAllOrders, fetchStats, fetchBarriers } from '../api/orderApi'
import { fetchAllStations } from '../api/stationApi'

const KitchenContext = createContext(null)

export function KitchenProvider({ children }) {
  const [state, dispatch] = useReducer(kitchenReducer, initialState)
  const toast = useToast()
  const { sendMessage } = useKitchenSocket(dispatch, toast.addToast)

  useEffect(() => {
    Promise.all([
      fetchAllOrders(),
      fetchAllStations(),
      fetchStats(),
    ]).then(([orders, stations, stats]) => {
      orders.forEach(order => dispatch({ type: 'ORDER_CREATED', payload: order }))
      stations.forEach(station => dispatch({ type: 'STATION_UPDATED', payload: station }))
      dispatch({ type: 'STATS_UPDATED', payload: stats })
    }).catch(err => console.error('Failed to load initial data:', err))

    const statsInterval = setInterval(() => {
      fetchStats()
        .then(stats => dispatch({ type: 'STATS_UPDATED', payload: stats }))
        .catch(() => {})
    }, 10000)

    const barriersInterval = setInterval(() => {
      fetchBarriers()
        .then(barriers => dispatch({ type: 'BARRIERS_UPDATED', payload: barriers }))
        .catch(() => {})
    }, 1500)

    return () => {
      clearInterval(statsInterval)
      clearInterval(barriersInterval)
    }
  }, [])

  const consumeFlash = useCallback((orderId) => {
    dispatch({ type: 'FLASH_CONSUMED', payload: orderId })
  }, [])

  return (
    <KitchenContext.Provider value={{ state, dispatch, sendMessage, consumeFlash, toast }}>
      {children}
    </KitchenContext.Provider>
  )
}

export function useKitchen() {
  const ctx = useContext(KitchenContext)
  if (!ctx) throw new Error('useKitchen must be used inside <KitchenProvider>')
  return ctx
}
