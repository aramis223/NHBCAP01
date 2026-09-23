#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4004/service/NHBCAP01Service}"

new_id() {
  node -e "console.log(require('crypto').randomUUID())"
}

create_draft() {
  local id="$1"
  local ref="$2"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"ID\":\"$id\",
      \"customer_ID\":\"11111111-1111-1111-1111-111111111111\",
      \"contractReference\":\"$ref\",
      \"assetDescription\":\"Negative lifecycle test asset\",
      \"supplierName\":\"Synthetic Supplier\",
      \"assetCost\":10000,
      \"profitAmount\":1500,
      \"salePrice\":11500,
      \"currency\":\"USD\",
      \"contractDate\":\"2026-09-24\",
      \"maturityDate\":\"2027-09-24\",
      \"status\":\"DRAFT\"
    }" \
    "$BASE_URL/MurabahaFinancing" >/dev/null
}

expect_status() {
  local expected="$1"
  local action="$2"
  local id="$3"
  local payload="$4"

  local actual

  actual="$(curl -s -o /tmp/murabaha-negative-response.json \
    -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($id)/NHBCAP01Service.$action")"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAILED: $action expected HTTP $expected but received $actual"
    cat /tmp/murabaha-negative-response.json
    exit 1
  fi

  echo "PASS: $action rejected with HTTP $actual"
}

# 1. Sharia decision before credit approval
ID1="$(new_id)"
create_draft "$ID1" "MUR-NEG-001"

expect_status 409 \
  recordShariaDecision \
  "$ID1" \
  '{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-NEG-001"}'

# 2. Asset acquisition before Sharia approval
ID2="$(new_id)"
create_draft "$ID2" "MUR-NEG-002"

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-NEG-002"}' \
  "$BASE_URL/MurabahaFinancing($ID2)/NHBCAP01Service.recordCreditDecision" >/dev/null

expect_status 409 \
  recordAssetAcquisition \
  "$ID2" \
  '{"acquisitionDate":"2026-09-24","evidenceReference":"OWN-NEG-002"}'

# 3. Sale execution before asset acquisition
ID3="$(new_id)"
create_draft "$ID3" "MUR-NEG-003"

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-NEG-003"}' \
  "$BASE_URL/MurabahaFinancing($ID3)/NHBCAP01Service.recordCreditDecision" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-NEG-003"}' \
  "$BASE_URL/MurabahaFinancing($ID3)/NHBCAP01Service.recordShariaDecision" >/dev/null

expect_status 409 \
  executeSaleContract \
  "$ID3" \
  '{"executionDate":"2026-09-24","contractReference":"SALE-NEG-003"}'

# 4. Delivery before sale execution
ID4="$(new_id)"
create_draft "$ID4" "MUR-NEG-004"

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-NEG-004"}' \
  "$BASE_URL/MurabahaFinancing($ID4)/NHBCAP01Service.recordCreditDecision" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-NEG-004"}' \
  "$BASE_URL/MurabahaFinancing($ID4)/NHBCAP01Service.recordShariaDecision" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"acquisitionDate":"2026-09-24","evidenceReference":"OWN-NEG-004"}' \
  "$BASE_URL/MurabahaFinancing($ID4)/NHBCAP01Service.recordAssetAcquisition" >/dev/null

expect_status 409 \
  confirmAssetDelivery \
  "$ID4" \
  '{"deliveryDate":"2026-09-24","evidenceReference":"DEL-NEG-004"}'

# 5. Activation before delivery
ID5="$(new_id)"
create_draft "$ID5" "MUR-NEG-005"

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-NEG-005"}' \
  "$BASE_URL/MurabahaFinancing($ID5)/NHBCAP01Service.recordCreditDecision" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-NEG-005"}' \
  "$BASE_URL/MurabahaFinancing($ID5)/NHBCAP01Service.recordShariaDecision" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"acquisitionDate":"2026-09-24","evidenceReference":"OWN-NEG-005"}' \
  "$BASE_URL/MurabahaFinancing($ID5)/NHBCAP01Service.recordAssetAcquisition" >/dev/null

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d '{"executionDate":"2026-09-24","contractReference":"SALE-NEG-005"}' \
  "$BASE_URL/MurabahaFinancing($ID5)/NHBCAP01Service.executeSaleContract" >/dev/null

expect_status 409 \
  activateFinancing \
  "$ID5" \
  '{}'

echo "Murabaha negative lifecycle regression passed."
