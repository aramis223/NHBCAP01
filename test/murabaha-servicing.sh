#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4004/service/NHBCAP01Service}"

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT
TEST_DATE="${TEST_DATE:-2026-09-24}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)-$$}"

new_id() {
  node -e "console.log(require('crypto').randomUUID())"
}

expect_status() {
  local expected="$1"
  local method="$2"
  local url="$3"
  local payload="$4"
  local label="$5"

  local actual

  actual="$(curl -s \
    -o $RESPONSE_FILE \
    -w "%{http_code}" \
    -X "$method" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$url")"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAILED: $label expected HTTP $expected but received $actual"
    cat $RESPONSE_FILE
    exit 1
  fi

  echo "PASS: $label returned HTTP $actual"
}

create_financing() {
  local id="$1"
  local ref="$2"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"ID\":\"$id\",
      \"customer_ID\":\"11111111-1111-1111-1111-111111111111\",
      \"contractReference\":\"$ref\",
      \"assetDescription\":\"Servicing regression asset\",
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
}

create_installment() {
  local id="$1"
  local financing_id="$2"
  local sequence="$3"
  local due_date="$4"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"ID\":\"$id\",
      \"financing_ID\":\"$financing_id\",
      \"sequenceNumber\":$sequence,
      \"dueDate\":\"$due_date\",
      \"principalAmount\":1000,
      \"profitAmount\":100,
      \"installmentAmount\":1100,
      \"paidAmount\":0,
      \"status\":\"PENDING\"
    }" \
    "$BASE_URL/MurabahaInstallment" >/dev/null
}

post_bound() {
  local action="$1"
  local id="$2"
  local payload="$3"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($id)/NHBCAP01Service.$action"
}

make_active() {
  local id="$1"

  post_bound recordCreditDecision "$id" \
    "{\"decisionStatus\":\"APPROVED\",\"decisionDate\":\"$TEST_DATE\",\"decisionReference\":\"CR-SVC-001-$RUN_ID\"}" \
    >/dev/null

  post_bound recordShariaDecision "$id" \
    "{\"approvalStatus\":\"APPROVED\",\"approvalDate\":\"$TEST_DATE\",\"approvalReference\":\"SHR-SVC-001-$RUN_ID\"}" \
    >/dev/null

  post_bound recordAssetAcquisition "$id" \
    "{\"acquisitionDate\":\"$TEST_DATE\",\"evidenceReference\":\"OWN-SVC-001-$RUN_ID\"}" \
    >/dev/null

  post_bound executeSaleContract "$id" \
    "{\"executionDate\":\"$TEST_DATE\",\"contractReference\":\"SALE-SVC-001-$RUN_ID\"}" \
    >/dev/null

  post_bound confirmAssetDelivery "$id" \
    "{\"deliveryDate\":\"$TEST_DATE\",\"evidenceReference\":\"DEL-SVC-001-$RUN_ID\"}" \
    >/dev/null

  post_bound activateFinancing "$id" '{}' >/dev/null
}

post_payment() {
  local installment_id="$1"
  local external_id="$2"
  local amount="$3"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"externalPaymentId\":\"$external_id\",
      \"paymentDate\":\"$TEST_DATE\",
      \"amount\":$amount,
      \"currency\":\"USD\"
    }" \
    "$BASE_URL/MurabahaInstallment($installment_id)/NHBCAP01Service.postPayment"
}

echo "Starting Murabaha servicing regression."

FINANCING_ID="$(new_id)"
INSTALLMENT_1="$(new_id)"
INSTALLMENT_2="$(new_id)"

create_financing "$FINANCING_ID" "MUR-SVC-${FINANCING_ID:0:8}"
create_installment "$INSTALLMENT_1" "$FINANCING_ID" 1 "2026-12-24"
create_installment "$INSTALLMENT_2" "$FINANCING_ID" 2 "2027-09-24"

# ------------------------------------------------------------
# 1. Payment before activation must fail
# ------------------------------------------------------------

expect_status 409 \
  POST \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)/NHBCAP01Service.postPayment" \
  "{\"externalPaymentId\":\"PAY-SVC-PREACTIVE-$RUN_ID\",\"paymentDate\":\"$TEST_DATE\",\"amount\":100,\"currency\":\"USD\"}" \
  "payment before activation"

# ------------------------------------------------------------
# 2. Activate financing
# ------------------------------------------------------------

make_active "$FINANCING_ID"

echo "PASS: financing activated"

# ------------------------------------------------------------
# 3. Partial payment
# ------------------------------------------------------------

PAYMENT_1="$(
  post_payment "$INSTALLMENT_1" "PAY-SVC-001-$RUN_ID" 400
)"

PAYMENT_1_ID="$(
  printf '%s' "$PAYMENT_1" | jq -r '.ID'
)"

curl -fsS \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)" \
  | jq -e '
      .paidAmount == 400 and
      .status == "PARTIALLY_PAID"
    ' >/dev/null

echo "PASS: partial payment -> PARTIALLY_PAID"

# ------------------------------------------------------------
# 4. Duplicate external payment ID must fail
# ------------------------------------------------------------

expect_status 409 \
  POST \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)/NHBCAP01Service.postPayment" \
  "{\"externalPaymentId\":\"PAY-SVC-001-$RUN_ID\",\"paymentDate\":\"$TEST_DATE\",\"amount\":100,\"currency\":\"USD\"}" \
  "duplicate externalPaymentId"

# ------------------------------------------------------------
# 5. Overpayment must fail
# Outstanding balance is 700; attempt 800.
# ------------------------------------------------------------

expect_status 409 \
  POST \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)/NHBCAP01Service.postPayment" \
  "{\"externalPaymentId\":\"PAY-SVC-OVER-$RUN_ID\",\"paymentDate\":\"$TEST_DATE\",\"amount\":800,\"currency\":\"USD\"}" \
  "overpayment"

# ------------------------------------------------------------
# 6. Reverse partial payment before settlement
# ------------------------------------------------------------

REVERSAL_1="$(
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"paymentId\":\"$PAYMENT_1_ID\",
      \"externalReversalId\":\"REV-SVC-001-$RUN_ID\",
      \"reversalDate\":\"$TEST_DATE\",
      \"reason\":\"Synthetic servicing regression reversal\"
    }" \
    "$BASE_URL/reverseMurabahaPayment"
)"

printf '%s' "$REVERSAL_1" \
  | jq -e --arg ref "REV-SVC-001-$RUN_ID" '
      .externalReversalId == $ref and
      .amount == 400
    ' >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)" \
  | jq -e '
      .paidAmount == 0 and
      .status == "PENDING"
    ' >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaPayment($PAYMENT_1_ID)" \
  | jq -e '.status == "REVERSED"' >/dev/null

echo "PASS: reversal restored installment balance and payment status"

# ------------------------------------------------------------
# 7. Reversing the same payment again must fail
# ------------------------------------------------------------

expect_status 409 \
  POST \
  "$BASE_URL/reverseMurabahaPayment" \
  "{
    \"paymentId\":\"$PAYMENT_1_ID\",
    \"externalReversalId\":\"REV-SVC-002-$RUN_ID\",
    \"reversalDate\":\"$TEST_DATE\",
    \"reason\":\"Duplicate reversal attempt\"
  }" \
  "second reversal of same payment"

# ------------------------------------------------------------
# 8. Duplicate reversal reference must fail
# Use another POSTED payment while financing is not settled.
# ------------------------------------------------------------

PAYMENT_2="$(
  post_payment "$INSTALLMENT_1" "PAY-SVC-002-$RUN_ID" 100
)"

PAYMENT_2_ID="$(
  printf '%s' "$PAYMENT_2" | jq -r '.ID'
)"

expect_status 409 \
  POST \
  "$BASE_URL/reverseMurabahaPayment" \
  "{
    \"paymentId\":\"$PAYMENT_2_ID\",
    \"externalReversalId\":\"REV-SVC-001-$RUN_ID\",
    \"reversalDate\":\"$TEST_DATE\",
    \"reason\":\"Duplicate reversal reference test\"
  }" \
  "duplicate external reversal reference"

# ------------------------------------------------------------
# 9. Complete first installment
# Already paid = 100; remaining = 1000.
# ------------------------------------------------------------

post_payment "$INSTALLMENT_1" "PAY-SVC-003-$RUN_ID" 1000 >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_1)" \
  | jq -e '
      .paidAmount == 1100 and
      .status == "PAID"
    ' >/dev/null

echo "PASS: first installment completed"

# ------------------------------------------------------------
# 10. Mark financing DEFAULTED
# ------------------------------------------------------------

post_bound markFinancingDefaulted "$FINANCING_ID" \
  "{\"defaultDate\":\"$TEST_DATE\",\"defaultReason\":\"Synthetic delinquency event\",\"defaultReference\":\"DEF-SVC-001-$RUN_ID\"}" \
  >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaFinancing($FINANCING_ID)" \
  | jq -e '.status == "DEFAULTED"' >/dev/null

echo "PASS: financing -> DEFAULTED"

# ------------------------------------------------------------
# 11. Payment while DEFAULTED must be allowed
# ------------------------------------------------------------

post_payment "$INSTALLMENT_2" "PAY-SVC-004-$RUN_ID" 500 >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_2)" \
  | jq -e '
      .paidAmount == 500 and
      .status == "PARTIALLY_PAID"
    ' >/dev/null

echo "PASS: payment accepted while DEFAULTED"

# ------------------------------------------------------------
# 12. Complete final installment
# This should automatically settle the financing.
# ------------------------------------------------------------

FINAL_PAYMENT="$(
  post_payment "$INSTALLMENT_2" "PAY-SVC-005-$RUN_ID" 600
)"

FINAL_PAYMENT_ID="$(
  printf '%s' "$FINAL_PAYMENT" | jq -r '.ID'
)"

curl -fsS \
  "$BASE_URL/MurabahaInstallment($INSTALLMENT_2)" \
  | jq -e '
      .paidAmount == 1100 and
      .status == "PAID"
    ' >/dev/null

curl -fsS \
  "$BASE_URL/MurabahaFinancing($FINANCING_ID)" \
  | jq -e '.status == "SETTLED"' >/dev/null

echo "PASS: final payment -> SETTLED"

# ------------------------------------------------------------
# 13. Ordinary reversal after settlement must fail
# ------------------------------------------------------------

expect_status 409 \
  POST \
  "$BASE_URL/reverseMurabahaPayment" \
  "{
    \"paymentId\":\"$FINAL_PAYMENT_ID\",
    \"externalReversalId\":\"REV-SVC-SETTLED-001-$RUN_ID\",
    \"reversalDate\":\"$TEST_DATE\",
    \"reason\":\"Settlement reversal must require adjustment workflow\"
  }" \
  "reversal after settlement"

echo "Murabaha servicing regression passed."
echo "Test financing: $FINANCING_ID"
