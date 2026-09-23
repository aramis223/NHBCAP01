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
      \"assetDescription\":\"Exceptional-state test asset\",
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

post() {
  local action="$1"
  local id="$2"
  local payload="$3"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($id)/NHBCAP01Service.$action"
}

expect_status() {
  local expected="$1"
  local action="$2"
  local id="$3"
  local payload="$4"

  local actual

  actual="$(curl -s -o /tmp/murabaha-exception-response.json \
    -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($id)/NHBCAP01Service.$action")"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAILED: $action expected HTTP $expected but received $actual"
    cat /tmp/murabaha-exception-response.json
    exit 1
  fi

  echo "PASS: $action returned expected HTTP $actual"
}

make_active() {
  local id="$1"

  post recordCreditDecision "$id" \
    '{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-EXC-001"}' >/dev/null

  post recordShariaDecision "$id" \
    '{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-EXC-001"}' >/dev/null

  post recordAssetAcquisition "$id" \
    '{"acquisitionDate":"2026-09-24","evidenceReference":"OWN-EXC-001"}' >/dev/null

  post executeSaleContract "$id" \
    '{"executionDate":"2026-09-24","contractReference":"SALE-EXC-001"}' >/dev/null

  post confirmAssetDelivery "$id" \
    '{"deliveryDate":"2026-09-24","evidenceReference":"DEL-EXC-001"}' >/dev/null

  post activateFinancing "$id" '{}' >/dev/null
}

# 1. DRAFT -> CANCELLED should pass
ID1="$(new_id)"
create_draft "$ID1" "MUR-EXC-CANCEL-001"

post cancelFinancing "$ID1" \
  '{"cancellationDate":"2026-09-24","cancellationReason":"Customer withdrew before execution","cancellationReference":"CAN-EXC-001"}' \
  | jq -e '
      .status == "CANCELLED" and
      .cancellationDate == "2026-09-24" and
      .cancellationReference == "CAN-EXC-001"
    ' >/dev/null

echo "PASS: DRAFT -> CANCELLED"

# 2. ACTIVE -> DEFAULTED should pass
ID2="$(new_id)"
create_draft "$ID2" "MUR-EXC-DEFAULT-001"
make_active "$ID2"

post markFinancingDefaulted "$ID2" \
  '{"defaultDate":"2026-09-24","defaultReason":"Synthetic delinquency condition","defaultReference":"DEF-EXC-001"}' \
  | jq -e '
      .status == "DEFAULTED" and
      .defaultDate == "2026-09-24" and
      .defaultReference == "DEF-EXC-001"
    ' >/dev/null

echo "PASS: ACTIVE -> DEFAULTED"

# 3. ACTIVE -> CANCELLED must fail
ID3="$(new_id)"
create_draft "$ID3" "MUR-EXC-ACTIVE-CANCEL-001"
make_active "$ID3"

expect_status 409 \
  cancelFinancing \
  "$ID3" \
  '{"cancellationDate":"2026-09-24","cancellationReason":"Invalid active cancellation test","cancellationReference":"CAN-EXC-INVALID-001"}'

# 4. Direct manual transition to SETTLED must fail
ID4="$(new_id)"
create_draft "$ID4" "MUR-EXC-SETTLED-001"

actual="$(curl -s -o /tmp/murabaha-settled-response.json \
  -w "%{http_code}" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"status":"SETTLED"}' \
  "$BASE_URL/MurabahaFinancing($ID4)")"

if [[ "$actual" != "409" ]]; then
  echo "FAILED: direct SETTLED transition expected HTTP 409 but received $actual"
  cat /tmp/murabaha-settled-response.json
  exit 1
fi

echo "PASS: direct manual SETTLED transition rejected with HTTP 409"

echo "Murabaha exceptional-state regression passed."
