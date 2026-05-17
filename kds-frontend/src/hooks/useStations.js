import { useContext } from 'react'
import { KitchenContext } from '../context/KitchenContext'

// useStations — convenience selector for station state from KitchenContext
export function useStations() {
  const { state } = useContext(KitchenContext)
  return { stations: state.stations }
}
