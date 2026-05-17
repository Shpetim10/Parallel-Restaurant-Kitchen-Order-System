import { useContext } from 'react'
import { KitchenContext } from '../context/KitchenContext'

// useOrders — convenience selector for order state from KitchenContext
export function useOrders() {
  const { state, dispatch } = useContext(KitchenContext)
  return { orders: state.orders, dispatch }
}
