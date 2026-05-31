#!/bin/bash
# Тест API — запускайте с поднятым dev-сервером (npm run dev)
# Использование: ./scripts/test-api.sh [BASE_URL]
BASE="${1:-http://127.0.0.1:3000}"
FAIL=0

check_status() {
  local url="$1"
  local expect="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$url")
  if [ "$code" = "$expect" ]; then
    echo "  OK $url → $code"
  else
    echo "  FAIL $url → $code (expected $expect)"
    FAIL=1
  fi
}

echo "=== Тест consumer API (без auth) ==="
echo "GET /api/restaurant"
check_status "/api/restaurant"
curl -s "$BASE/api/restaurant" | head -c 200
echo ""
echo ""
echo "GET /api/venue/context"
check_status "/api/venue/context"
curl -s "$BASE/api/venue/context" | head -c 300
echo ""
echo ""
echo "GET /api/settings"
check_status "/api/settings"
curl -s "$BASE/api/settings" | head -c 200
echo ""
echo ""
echo "GET /api/banners"
check_status "/api/banners"
curl -s "$BASE/api/banners" | head -c 200
echo ""
echo ""
echo "GET /api/categories"
check_status "/api/categories"
curl -s "$BASE/api/categories" | head -c 200
echo ""
echo ""
echo "GET /api/dishes"
check_status "/api/dishes"
curl -s "$BASE/api/dishes" | head -c 200
echo ""
echo ""
echo "GET /api/store/categories"
check_status "/api/store/categories"
curl -s "$BASE/api/store/categories" | head -c 200
echo ""
echo ""
echo "GET /api/store/products"
check_status "/api/store/products"
curl -s "$BASE/api/store/products" | head -c 200
echo ""
echo ""
echo "=== Тест admin API (требуют auth — ожидаем 401/403) ==="
echo "GET /api/admin/banners"
check_status "/api/admin/banners" "403"
curl -s "$BASE/api/admin/banners" | head -c 200
echo ""
echo ""
echo "POST /api/admin/banners"
curl -s -X POST "$BASE/api/admin/banners" -H "Content-Type: application/json" -d '{"title":"test","href":"/menu"}' | head -c 300
echo ""
echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "=== Некоторые проверки не прошли ==="
  exit 1
fi
echo "=== Все consumer API возвращают 200 ==="
