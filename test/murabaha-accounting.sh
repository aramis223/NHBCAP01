#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4004/service/NHBCAP01Service}"
RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

AUTH_ARGS=()
if [[ -n "${XSUAA_TOKEN:-}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer $XSUAA_TOKEN")
fi

http() {
  curl "${AUTH_ARGS[@]}" "$@"
}

expect_status() {
  local expected="$1"
  local method="$2"
  local url="$3"
  local payload="$4"
  local label="$5"

  local actual
  actual="$(
    http -s \
      -o "$RESPONSE_FILE" \
      -w '%{http_code}' \
      -X "$method" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "$url"
  )"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label returned HTTP $actual, expected $expected"
    cat "$RESPONSE_FILE"
    echo
    exit 1
  fi

  echo "PASS: $label returned HTTP $expected"
}

echo "Starting Murabaha accounting regression."

# ------------------------------------------------------------
# 1. Missing accounting-event ID
# ------------------------------------------------------------

expect_status \
  400 \
  POST \
  "$BASE_URL/postAccountingEvent" \
  '{}' \
  "missing accountingEventId"

# ------------------------------------------------------------
# 2. Unknown accounting-event ID
# ------------------------------------------------------------

expect_status \
  404 \
  POST \
  "$BASE_URL/postAccountingEvent" \
  '{"accountingEventId":"00000000-0000-0000-0000-000000000000"}' \
  "unknown accountingEventId"

# ------------------------------------------------------------
# 3. Select an existing PENDING accounting event
# ------------------------------------------------------------

EVENTS="$(
  http -fsS \
    "$BASE_URL/MurabahaAccountingEvent?\$filter=postingStatus%20eq%20'PENDING'&\$top=1"
)"

EVENT_ID="$(
  printf '%s' "$EVENTS" \
  | jq -r '
      (if type == "array" then . else .value end)[0].ID // empty
    '
)"

if [[ -z "$EVENT_ID" ]]; then
  echo "FAIL: no PENDING accounting event is available for the positive test"
  echo "Run test/murabaha-servicing.sh first to create accounting-event test data."
  exit 1
fi

# ------------------------------------------------------------
# 4. Valid PENDING accounting event
# ------------------------------------------------------------

RESULT="$(
  http -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "{\"accountingEventId\":\"$EVENT_ID\"}" \
    "$BASE_URL/postAccountingEvent"
)"

printf '%s' "$RESULT" \
| jq -e \
  --arg id "$EVENT_ID" '
    .ID == $id and
    .postingStatus == "PENDING" and
    .externalAccountingDocumentId == null
  ' >/dev/null

echo "PASS: valid PENDING accounting event accepted"

echo "Murabaha accounting regression passed."
echo "Test accounting event: $EVENT_ID"
