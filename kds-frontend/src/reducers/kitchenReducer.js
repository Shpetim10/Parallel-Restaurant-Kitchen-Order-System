export const initialState = {
  orders: {},
  stations: {},
  barriers: {},
  recentEvents: [],
  connectionStatus: 'DISCONNECTED',
  readyFlashes: {},
  stats: {},
}

export default function kitchenReducer(state, action) {
  switch (action.type) {

    case 'ORDER_CREATED': {
      const order = action.payload
      return {
        ...state,
        orders: { ...state.orders, [order.id]: order },
      }
    }

    case 'COMPONENT_UPDATED': {
      const { orderId, componentId, newStatus, processingThreadName } = action.payload
      const order = state.orders[orderId]
      if (!order) return state

      const now = new Date().toISOString()
      const updatedComponents = order.components.map(c => {
        if (c.id !== componentId) return c
        return {
          ...c,
          status: newStatus,
          ...(processingThreadName ? { processingThreadName } : {}),
          ...(newStatus === 'IN_PROGRESS' ? { startedAt: now } : {}),
          ...(newStatus === 'DONE' ? { completedAt: now } : {}),
        }
      })

      return {
        ...state,
        orders: {
          ...state.orders,
          [orderId]: { ...order, components: updatedComponents },
        },
      }
    }

    case 'ORDER_READY': {
      const { orderId } = action.payload
      const order = state.orders[orderId]
      if (!order) return state

      return {
        ...state,
        orders: {
          ...state.orders,
          [orderId]: { ...order, orderStatus: 'READY' },
        },
        readyFlashes: { ...state.readyFlashes, [orderId]: true },
      }
    }

    case 'ORDER_CANCELLED': {
      const { orderId } = action.payload
      const order = state.orders[orderId]
      if (!order) return state

      return {
        ...state,
        orders: {
          ...state.orders,
          [orderId]: { ...order, orderStatus: 'CANCELLED' },
        },
      }
    }

    case 'STATION_UPDATED': {
      const station = action.payload
      const key = station.stationType ?? station.station
      return {
        ...state,
        stations: { ...state.stations, [key]: station },
      }
    }

    case 'EVENT_RECEIVED': {
      const updated = [action.payload, ...state.recentEvents]
      return {
        ...state,
        recentEvents: updated.slice(0, 50),
      }
    }

    case 'FLASH_CONSUMED': {
      const { [action.payload]: _, ...rest } = state.readyFlashes
      return { ...state, readyFlashes: rest }
    }

    case 'ORDER_COLLECTED': {
      const order = state.orders[action.payload]
      if (!order) return state
      return {
        ...state,
        orders: { ...state.orders, [action.payload]: { ...order, orderStatus: 'COLLECTED' } },
      }
    }

    case 'BARRIERS_UPDATED': {
      const barriers = {}
      ;(action.payload ?? []).forEach(b => { barriers[b.orderId] = b })
      return { ...state, barriers }
    }

    case 'CLEAR_ALL':
      return { ...state, orders: {}, readyFlashes: {}, barriers: {} }

    case 'CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload }

    case 'STATS_UPDATED':
      return { ...state, stats: action.payload }

    default:
      return state
  }
}
