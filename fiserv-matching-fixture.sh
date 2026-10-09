#!/usr/bin/env bash
# Synthetic CAP fixture only. No Fiserv writes, payment creation or SAP posting.
set -euo pipefail

: "${BASE_URL:?Set BASE_URL to the CAP service URL}"
: "${XSUAA_TOKEN:?Set XSUAA_TOKEN}"
TEST_DATE='2025-05-16'
CUSTOMER_ID="$(node -e "console.log(require('crypto').randomUUID())")"
FINANCING_ID="$(node -e "console.log(require('crypto').randomUUID())")"
INSTALLMENT_ID="$(node -e "console.log(require('crypto').randomUUID())")"
RUN_ID="${FINANCING_ID:0:8}"

http() {
  curl -fsS --max-time 100 -H "Authorization: Bearer $XSUAA_TOKEN" "$@"
}

create() {
  http -X POST -H 'Content-Type: application/json' -d "$2" "$BASE_URL/$1" >/dev/null
}

post_bound() {
  http -X POST -H 'Content-Type: application/json' -d "$2" \
    "$BASE_URL/MurabahaFinancing($FINANCING_ID)/NHBCAP01Service.$1" >/dev/null
}

# A fresh CAP customer is created for this fixture; the provider PartyId is
# recorded provisionally in CustomerNumber. This is not a general customer sync.
create Customer "{
  \"ID\":\"$CUSTOMER_ID\",
  \"CustomerNumber\":\"2|98310\",
  \"Name\":\"Louise Payne\",
  \"CustomerType\":\"Individual\"
}"

create MurabahaFinancing "{
  \"ID\":\"$FINANCING_ID\",
  \"customer_ID\":\"$CUSTOMER_ID\",
  \"finxactAccountId\":\"110000000055\",
  \"contractReference\":\"MUR-FISERV-CERT-$RUN_ID\",
  \"assetDescription\":\"SYNTHETIC Fiserv matching fixture; not a real customer contract\",
  \"supplierName\":\"Synthetic Supplier\",
  \"assetCost\":2000,
  \"profitAmount\":200,
  \"salePrice\":2200,
  \"currency\":\"USD\",
  \"contractDate\":\"$TEST_DATE\",
  \"maturityDate\":\"2026-05-16\",
  \"status\":\"DRAFT\"
}"

create MurabahaInstallment "{
  \"ID\":\"$INSTALLMENT_ID\",
  \"financing_ID\":\"$FINANCING_ID\",
  \"sequenceNumber\":1,
  \"dueDate\":\"2026-05-16\",
  \"principalAmount\":2000,
  \"profitAmount\":200,
  \"installmentAmount\":2200,
  \"paidAmount\":0,
  \"status\":\"PENDING\"
}"

post_bound recordCreditDecision "{\"decisionStatus\":\"APPROVED\",\"decisionDate\":\"$TEST_DATE\",\"decisionReference\":\"SYNTHETIC-CR-$RUN_ID\"}"
post_bound recordShariaDecision "{\"approvalStatus\":\"APPROVED\",\"approvalDate\":\"$TEST_DATE\",\"approvalReference\":\"SYNTHETIC-SHR-$RUN_ID\"}"
post_bound recordAssetAcquisition "{\"acquisitionDate\":\"$TEST_DATE\",\"evidenceReference\":\"SYNTHETIC-OWN-$RUN_ID\"}"
post_bound executeSaleContract "{\"executionDate\":\"$TEST_DATE\",\"contractReference\":\"SYNTHETIC-SALE-$RUN_ID\"}"
post_bound confirmAssetDelivery "{\"deliveryDate\":\"$TEST_DATE\",\"evidenceReference\":\"SYNTHETIC-DEL-$RUN_ID\"}"
post_bound activateFinancing '{}'

http "$BASE_URL/MurabahaFinancing($FINANCING_ID)?\$select=ID,customer_ID,finxactAccountId,status" \
  | jq -e --arg customer "$CUSTOMER_ID" \
    '.customer_ID == $customer and .finxactAccountId == "110000000055" and .status == "ACTIVE"' >/dev/null
http "$BASE_URL/MurabahaInstallment($INSTALLMENT_ID)" \
  | jq -e '.status == "PENDING" and (.paidAmount | tonumber) == 0' >/dev/null

printf 'Synthetic matching fixture verified. No payment created.\nCUSTOMER_ID=%s\nFINANCING_ID=%s\nINSTALLMENT_ID=%s\n' \
  "$CUSTOMER_ID" "$FINANCING_ID" "$INSTALLMENT_ID"
printf 'Keep these IDs. Run once; rerunning creates another fixture.\n'
