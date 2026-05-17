# Kitchen Display System (KDS)

## Overview

The Kitchen Display System (KDS) is a real-time order management platform built to demonstrate classic parallel programming primitives in a practical, visual context. Orders submitted by waiters are decomposed into per-station components (Grill, Fryer, Salad, Drinks, Dessert), each cooked concurrently on a dedicated thread pool. A CyclicBarrier ensures that all stations finish before an order is marked READY, while Semaphores, Mutexes, and Condition Variables guard shared state along the way.

The frontend is a React/Vite single-page app that connects to the Spring Boot backend over WebSocket (STOMP). It shows live order tickets, per-station utilisation gauges, a thread-activity bar, and real-time toasts whenever an order is ready for pickup.

## Parallel Programming Concepts

| Concept | Java Class | Where Used | Purpose |
|---|---|---|---|
| Thread | `StationWorker` | One thread per `OrderComponent`, submitted to per-station `ExecutorService` | Concurrent cooking of individual menu items |
| Semaphore | `StationSemaphoreRegistry` | Acquired before cooking, released in `finally` | Limits concurrent slots per station (e.g. Grill has 3 simultaneous burners) |
| Mutex | `OrderLockManager` | Wraps every `component.setStatus()` call | Prevents torn writes to the shared `Order` object from multiple threads |
| Condition | `Order.awaitReady()` | Waiter HTTP thread blocks until barrier fires `signalAll()` | Efficient wait instead of polling — thread wakes only when order is READY |
| CyclicBarrier | `BarrierCoordinator` | One barrier per order, parties = distinct station count | All station coordinators must arrive before the order transitions to READY |

## Architecture

```
Waiter UI  ──POST /api/orders──►  OrderService
                                      │
                          ┌───────────┼───────────┐
                          ▼           ▼           ▼
                     GRILL pool  FRYER pool  SALAD pool   ...
                     StationWorker × N (Semaphore gates entry)
                          │           │           │
                     CountDownLatch per station
                          │           │           │
                     barrierActionPool coordinator threads
                          └───────────┼───────────┘
                                 CyclicBarrier
                                      │ (barrier action)
                              Order → READY
                              Condition.signalAll()
                                      │
                       KitchenEventPublisher (WebSocket)
                                      │
                          React frontend (STOMP)
```

## Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 18+

## Running

```bash
# Backend
cd kds-backend && mvn spring-boot:run

# Frontend (new terminal)
cd kds-frontend && npm install && npm run dev

# Kick off the simulation
curl -X POST http://localhost:8080/api/simulation/start
```

The frontend is available at `http://localhost:5173`.

## Pages

| Route | Purpose |
|---|---|
| `/` | Waiter View — build and submit orders from the menu |
| `/kitchen` | Kitchen Display — live order tickets with component progress |
| `/stations` | Station Monitor — semaphore gauges and thread-activity bars |
| `/manager` | Manager Dashboard — throughput stats and event log |

## Running Tests

```bash
cd kds-backend && mvn test
```

## How the CyclicBarrier Works

When an order arrives, `OrderService` creates a `CyclicBarrier` with `parties = number of distinct stations involved`. Each station gets its own coordinator thread in `barrierActionPool`. The coordinator dispatches all of that station's components to the station's worker pool, then blocks on a `CountDownLatch` until every component is done. Once the latch reaches zero, the coordinator calls `barrierCoordinator.await()` — its one vote at the barrier.

**Example — Burger + Fries + Caesar Salad:**
- Parties = 3 (GRILL, FRYER, SALAD)
- GRILL coordinator waits for `Burger` (9 s) → arrives at barrier
- FRYER coordinator waits for `Fries` (6 s) → arrives at barrier first, then waits
- SALAD coordinator waits for `Caesar` (4 s) → arrives at barrier first, then waits
- When the last coordinator (GRILL) arrives, the barrier fires its action:
  - Order status → `READY`
  - `Condition.signalAll()` wakes any blocking waiter thread
  - WebSocket event pushed to all connected clients

The CyclicBarrier guarantees the burger, fries, and salad are all plated before the waiter is told the order is ready — just like a real kitchen.

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orders` | List all orders |
| `POST` | `/api/orders` | Submit a new order |
| `GET` | `/api/orders/{id}` | Get a single order |
| `POST` | `/api/orders/{id}/collect` | Collect (pick up) a ready order |
| `DELETE` | `/api/orders/{id}` | Cancel an order |
| `GET` | `/api/orders/stats` | Aggregate stats (counts, avg completion time) |
| `GET` | `/api/orders/menu` | Full menu item list |
| `GET` | `/api/stations` | All station states |
| `GET` | `/api/stations/{type}` | Single station state |
| `GET` | `/api/stations/threads` | Active task counts per station |
| `PUT` | `/api/stations/{type}/capacity` | Update station semaphore capacity |
| `POST` | `/api/simulation/start` | Start auto-order simulation |
| `POST` | `/api/simulation/stop` | Stop simulation |
| `GET` | `/api/simulation/status` | `{ "active": true/false }` |
