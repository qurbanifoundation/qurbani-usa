#!/bin/bash
# =============================================================================
# Qurbani USA — Build Verification Script
#
# Builds the project and tests it under the Cloudflare Workers runtime
# using wrangler pages dev. This catches issues that work locally (Node.js)
# but crash in production (Workers V8 runtime).
#
# Usage: npm run verify
# =============================================================================

set -e

PORT=8790
WRANGLER_PID=""

cleanup() {
  if [ -n "$WRANGLER_PID" ]; then
    kill "$WRANGLER_PID" 2>/dev/null || true
    wait "$WRANGLER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo ""
echo "========================================="
echo "  Step 1: Building project"
echo "========================================="
echo ""
npm run build

echo ""
echo "========================================="
echo "  Step 2: Starting Workers runtime test"
echo "========================================="
echo ""
echo "Starting wrangler pages dev on port $PORT..."

npx wrangler pages dev dist --port "$PORT" > /tmp/wrangler-verify.log 2>&1 &
WRANGLER_PID=$!

# Wait for wrangler to start (check if port is open)
MAX_WAIT=20
WAITED=0
while ! curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "ERROR: Wrangler failed to start after ${MAX_WAIT}s"
    echo ""
    echo "Wrangler logs:"
    cat /tmp/wrangler-verify.log
    exit 1
  fi
done

echo "Wrangler started in ${WAITED}s"
echo ""

echo "========================================="
echo "  Step 3: Testing critical routes"
echo "========================================="
echo ""

FAIL=0
PASS=0

test_route() {
  local route=$1
  local expected=$2
  local label=$3

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT${route}" 2>/dev/null || echo "000")

  if [ "$expected" = "not500" ]; then
    if [ "$STATUS" = "500" ] || [ "$STATUS" = "000" ]; then
      echo "  FAIL  $route  →  $STATUS  ($label)"
      FAIL=$((FAIL + 1))
    else
      echo "  OK    $route  →  $STATUS  ($label)"
      PASS=$((PASS + 1))
    fi
  else
    if [ "$STATUS" = "$expected" ]; then
      echo "  OK    $route  →  $STATUS  ($label)"
      PASS=$((PASS + 1))
    else
      echo "  FAIL  $route  →  $STATUS (expected $expected)  ($label)"
      FAIL=$((FAIL + 1))
    fi
  fi
}

# Test static pages
test_route "/" "200" "Homepage"
test_route "/donate" "200" "Donate page"
test_route "/contact" "200" "Contact page"

# Test API endpoints (GET routes)
test_route "/api/mega-menus" "200" "Mega menus API"
test_route "/api/categories" "200" "Categories API"

# Test SSR routes (should not crash with 500)
test_route "/appeals" "not500" "Appeals listing"

# Test fulfillment API (should return 401 without auth, not 500)
test_route "/api/fulfillment/process" "401" "Fulfillment API (auth check)"

echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="
echo ""

if [ $FAIL -ne 0 ]; then
  echo "VERIFICATION FAILED — Do NOT merge to main"
  echo ""
  echo "Wrangler logs:"
  tail -30 /tmp/wrangler-verify.log
  exit 1
fi

echo "All checks passed — safe to merge to main"
echo ""
