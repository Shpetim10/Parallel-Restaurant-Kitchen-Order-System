#!/bin/bash
# Parallel Kitchen Display System — live demo
# Start the backend (./mvnw spring-boot:run) and frontend (npm run dev) first.
# ℹ️  Open http://localhost:5173/kitchen in your browser BEFORE running this script!

set -e
BASE_URL="http://localhost:8080"

echo ""
echo "======================================================"
echo "  KDS Parallel Programming — Live Demo"
echo "======================================================"
echo ""
echo "⚠️  IMPORTANT: Open http://localhost:5173/kitchen in your browser"
echo "   to watch the kitchen display update in real-time!"
echo ""
read -p "Press Enter once you have the kitchen display open..."
echo ""

# ── 1. Station capacities ──────────────────────────────────────────────────────
echo "📊 1. Current station capacities (semaphore limits):"
curl -s "$BASE_URL/api/stations" | python3 -m json.tool | head -30
echo ""

# ── 2. Multi-station order (CyclicBarrier with 4 parties) ─────────────────────
echo "🍔 2. Submitting a multi-station order..."
echo "   Items: Burger (GRILL 8s) + Fries (FRYER 6s) + Caesar (SALAD 4s) + Coke (DRINKS 1s)"
echo "   Watch the kitchen display — the order waits for all stations!"
echo ""
ORDER=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 1,
    "items": [
      {"menuItemId":"a1","name":"Burger","stationType":"GRILL","cookTimeMs":8000},
      {"menuItemId":"a2","name":"Fries","stationType":"FRYER","cookTimeMs":6000},
      {"menuItemId":"a3","name":"Caesar","stationType":"SALAD","cookTimeMs":4000},
      {"menuItemId":"a4","name":"Coke","stationType":"DRINKS","cookTimeMs":1000}
    ]
  }')
ORDER_ID=$(echo "$ORDER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   ✓ Order created: $ORDER_ID"
echo ""

# ── 3. 5 concurrent GRILL orders (semaphore capacity = 3) ─────────────────────
echo "🔥 3. Submitting 5 concurrent GRILL orders (semaphore capacity = 3)..."
echo "   Orders 1-3 cook immediately, 4-5 queue behind the semaphore"
echo ""
for i in {1..5}; do
  curl -s -X POST "$BASE_URL/api/orders" \
    -H "Content-Type: application/json" \
    -d '{"tableNumber":'$((i+1))',"items":[
      {"menuItemId":"g'$i'","name":"Steak-'$i'","stationType":"GRILL","cookTimeMs":5000}
    ]}' \
    -o /dev/null &
done
wait
echo "   ✓ 5 GRILL orders submitted"
echo ""

# ── 4. Poll the multi-station order every 2 seconds ───────────────────────────
echo "⏱️  4. Monitoring the multi-station order (should complete in ~8 seconds)..."
echo "   Notice: READY only fires when ALL stations finish (barrier synchronization)"
echo ""
READY=false
for i in {1..10}; do
  sleep 2
  STATUS=$(curl -s "$BASE_URL/api/orders/$ORDER_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
components = ', '.join(
  f\"{c['name']}:{c['status'][:3]}\" for c in d.get('components', [])
)
print(f\"  [{$((i*2)):2d}s]  Status={d.get('orderStatus'):15s} Components=[{components}]\")")
  echo "$STATUS"
  if echo "$STATUS" | grep -q "READY"; then
    echo ""
    echo "   🎉 Barrier fired! All stations done simultaneously!"
    READY=true
    break
  fi
done
echo ""

# ── 5. Collect order (blocks on Condition until READY) ────────────────────────
if [ "$READY" = true ]; then
  echo "📦 5. Collecting order (demonstrates Condition.await)..."
  COLLECTED=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/collect?timeoutMs=30000")
  echo "   ✓ Collected: $(echo "$COLLECTED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('orderStatus'))")"
  echo ""
fi

# ── 6. Final station stats ────────────────────────────────────────────────────
echo "📈 6. Final station stats:"
curl -s "$BASE_URL/api/stations" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for station in data:
  st = station.get('stationType', station.get('station', 'UNKNOWN'))
  cap = station.get('capacity', station.get('semaphoreCapacity', '?'))
  avail = station.get('availableSlots', '?')
  print(f'   {st:10s} Capacity: {cap} → Available: {avail}')
"
echo ""

echo "======================================================"
echo "✓ Demo complete! The kitchen display updated in real-time."
echo "======================================================"
echo ""
