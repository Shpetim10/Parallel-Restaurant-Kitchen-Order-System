import { useEffect, useCallback, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

export function useKitchenSocket(dispatch, addToast) {
  const clientRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttemptsRef = useRef(10)

  useEffect(() => {
    let isComponentMounted = true

    const createClient = () => {
      const client = new Client({
        webSocketFactory: () => {
          const sockjs = new SockJS('http://localhost:8080/ws')
          sockjs.onclose = () => {
            console.log('[KDS] SockJS connection closed')
          }
          return sockjs
        },
        reconnectDelay: Math.min(1000 + reconnectAttemptsRef.current * 500, 10000),
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        connectionTimeout: 5000,

        onConnect: () => {
          if (!isComponentMounted) return
          console.log('[KDS] WebSocket connected')
          reconnectAttemptsRef.current = 0
          maxReconnectAttemptsRef.current = 10
          dispatch({ type: 'CONNECTION_STATUS', payload: 'CONNECTED' })

          client.subscribe('/topic/orders', (msg) => {
            const event = JSON.parse(msg.body)
            dispatch({ type: 'EVENT_RECEIVED', payload: event })

            if (event.eventType === 'COMPONENT_UPDATE') {
              dispatch({ type: 'COMPONENT_UPDATED', payload: event })
            } else if (event.eventType === 'ORDER_READY') {
              dispatch({ type: 'ORDER_READY', payload: event })
              const table = event.tableNumber ?? event.table ?? ''
              addToast?.(`Table ${table} is ready!`, 'ready', 5000)
            } else if (event.eventType === 'ORDER_CANCELLED') {
              dispatch({ type: 'ORDER_CANCELLED', payload: event })
            }
          })

          client.subscribe('/topic/stations', (msg) => {
            dispatch({ type: 'STATION_UPDATED', payload: JSON.parse(msg.body) })
          })

          client.subscribe('/topic/ready', (msg) => {
            const event = JSON.parse(msg.body)
            dispatch({ type: 'ORDER_READY', payload: event })
            const table = event.tableNumber ?? event.table ?? ''
            addToast?.(`Table ${table} is ready!`, 'ready', 5000)
          })
        },

        onDisconnect: () => {
          if (!isComponentMounted) return
          console.log('[KDS] WebSocket disconnected')
          dispatch({ type: 'CONNECTION_STATUS', payload: 'DISCONNECTED' })
        },

        onStompError: (frame) => {
          if (!isComponentMounted) return
          reconnectAttemptsRef.current += 1
          console.error('[KDS] WebSocket error (attempt ' + reconnectAttemptsRef.current + '):', frame)

          if (reconnectAttemptsRef.current > maxReconnectAttemptsRef.current) {
            console.error('[KDS] Max reconnect attempts reached, stopping')
            dispatch({ type: 'CONNECTION_STATUS', payload: 'FAILED' })
            if (clientRef.current) {
              clientRef.current.deactivate()
            }
          } else {
            dispatch({ type: 'CONNECTION_STATUS', payload: 'RECONNECTING' })
          }
        },
      })

      return client
    }

    const client = createClient()
    clientRef.current = client
    client.activate()

    return () => {
      isComponentMounted = false
      if (clientRef.current?.connected) {
        clientRef.current.deactivate()
      }
    }
  }, [dispatch, addToast])

  const sendMessage = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({ destination, body: JSON.stringify(body) })
    }
  }, [])

  return { sendMessage }
}
