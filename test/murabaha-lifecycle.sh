#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4004/service/NHBCAP01Service}"

ID="$(node -e "console.log(require('crypto').randomUUID())")"
REF="MUR-LIFECYCLE-${ID:0:8}"

echo "Creating lifecycle test financing: $ID"

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"ID\":\"$ID\",
    \"customer_ID\":\"11111111-1111-1111-1111-111111111111\",
    \"contractReference\":\"$REF\",
    \"assetDescription\":\"Automated lifecycle test asset\",
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

post() {
  local action="$1"
  local payload="$2"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/MurabahaFinancing($ID)/NHBCAP01Service.$action"
}

post recordCreditDecision \
'{"decisionStatus":"APPROVED","decisionDate":"2026-09-24","decisionReference":"CR-REGRESSION-001"}' \
>/dev/null

post recordShariaDecision \
'{"approvalStatus":"APPROVED","approvalDate":"2026-09-24","approvalReference":"SHR-REGRESSION-001"}' \
>/dev/null

post recordAssetAcquisition \
'{"acquisitionDate":"2026-09-24","evidenceReference":"OWN-REGRESSION-001"}' \
>/dev/null

post executeSaleContract \
'{"executionDate":"2026-09-24","contractReference":"SALE-REGRESSION-001"}' \
>/dev/null

post confirmAssetDelivery \
'{"deliveryDate":"2026-09-24","evidenceReference":"DEL-REGRESSION-001"}' \
>/dev/null

post activateFinancing '{}' >/dev/null

curl -fsS \
"$BASE_URL/MurabahaFinancing($ID)" \
| jq -e '
    .creditDecisionStatus == "APPROVED" and
    .shariaApprovalStatus == "APPROVED" and
    .bankOwnershipRecorded == true and
    .ownershipEvidenceReference == "OWN-REGRESSION-001" and
    .saleContractReference == "SALE-REGRESSION-001" and
    .deliveryEvidenceReference == "DEL-REGRESSION-001" and
    .status == "ACTIVE"
' >/dev/null

echo "Murabaha lifecycle regression passed."
echo "Test financing: $ID"
