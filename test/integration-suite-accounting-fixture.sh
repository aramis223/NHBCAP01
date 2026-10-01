#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4004/service/NHBCAP01Service}"
TEST_DATE="${TEST_DATE:-2026-09-24}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)-$$}"

AUTH_ARGS=()
if [[ -n "${XSUAA_TOKEN:-}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer $XSUAA_TOKEN")
fi

http() {
  curl "${AUTH_ARGS[@]}" "$@"
}

new_id() {
  node -e "console.log(require('crypto').randomUUID())"
}

post_bound() {
  local action="$1"
  local id="$2"
  local payload="$3"

  http -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($id)/NHBCAP01Service.$action"
}

FINANCING_ID="$(new_id)"
INSTALLMENT_ID="$(new_id)"

echo "Creating fresh Integration Suite accounting fixture..."

http -fsS -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"ID\":\"$FINANCING_ID\",
    \"customer_ID\":\"11111111-1111-1111-1111-111111111111\",
    \"contractReference\":\"MUR-IS-${FINANCING_ID:0:8}\",
    \"assetDescription\":\"Integration Suite accounting fixture\",
    \"supplierName\":\"Synthetic Supplier\",
    \"assetCost\":2000,
    \"profitAmount\":200,
    \"salePrice\":2200,
    \"currency\":\"USD\",
    \"contractDate\":\"$TEST_DATE\",
    \"maturityDate\":\"2027-09-24\",
    \"status\":\"DRAFT\"
  }" \
  "$BASE_URL/MurabahaFinancing" >/dev/null

http -fsS -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"ID\":\"$INSTALLMENT_ID\",
    \"financing_ID\":\"$FINANCING_ID\",
    \"sequenceNumber\":1,
    \"dueDate\":\"2027-09-24\",
    \"principalAmount\":2000,
    \"profitAmount\":200,
    \"installmentAmount\":2200,
    \"paidAmount\":0,
    \"status\":\"PENDING\"
  }" \
  "$BASE_URL/MurabahaInstallment" >/dev/null

post_bound recordCreditDecision "$FINANCING_ID" \
  "{\"decisionStatus\":\"APPROVED\",\"decisionDate\":\"$TEST_DATE\",\"decisionReference\":\"CR-IS-$RUN_ID\"}" >/dev/null

post_bound recordShariaDecision "$FINANCING_ID" \
  "{\"approvalStatus\":\"APPROVED\",\"approvalDate\":\"$TEST_DATE\",\"approvalReference\":\"SHR-IS-$RUN_ID\"}" >/dev/null

post_bound recordAssetAcquisition "$FINANCING_ID" \
  "{\"acquisitionDate\":\"$TEST_DATE\",\"evidenceReference\":\"OWN-IS-$RUN_ID\"}" >/dev/null

post_bound executeSaleContract "$FINANCING_ID" \
  "{\"executionDate\":\"$TEST_DATE\",\"contractReference\":\"SALE-IS-$RUN_ID\"}" >/dev/null

post_bound confirmAssetDelivery "$FINANCING_ID" \
  "{\"deliveryDate\":\"$TEST_DATE\",\"evidenceReference\":\"DEL-IS-$RUN_ID\"}" >/dev/null

post_bound activateFinancing "$FINANCING_ID" '{}' >/dev/null

CORRELATION_ID="PAY-IS-$RUN_ID"

PAYMENT="$(
  http -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"externalPaymentId\":\"$CORRELATION_ID\",
      \"paymentDate\":\"$TEST_DATE\",
      \"amount\":100,
      \"currency\":\"USD\"
    }" \
    "$BASE_URL/MurabahaInstallment($INSTALLMENT_ID)/NHBCAP01Service.postPayment"
)"

PAYMENT_ID="$(printf '%s' "$PAYMENT" | jq -r '.ID')"

EVENT="$(
  http -fsS \
    "$BASE_URL/MurabahaAccountingEvent?\$filter=correlationId%20eq%20'$CORRELATION_ID'"
)"

ACCOUNTING_EVENT_ID="$(
  printf '%s' "$EVENT" | jq -r '(.value // .)[0].ID'
)"

POSTING_STATUS="$(
  printf '%s' "$EVENT" | jq -r '(.value // .)[0].postingStatus'
)"

echo
echo "Fixture created successfully."
echo "FINANCING_ID=$FINANCING_ID"
echo "INSTALLMENT_ID=$INSTALLMENT_ID"
echo "PAYMENT_ID=$PAYMENT_ID"
echo "ACCOUNTING_EVENT_ID=$ACCOUNTING_EVENT_ID"
echo "CORRELATION_ID=$CORRELATION_ID"
echo "POSTING_STATUS=$POSTING_STATUS"
