# SAP Integration Suite Runbook — NHBCAP01 to SAP S/4HANA Journal Entry

## 1. Purpose

This runbook documents the verified setup, configuration, deployment, testing, and troubleshooting steps for the NHBCAP01 SAP Integration Suite mediation flow.

The verified integration path is:

NHBCAP01
→ SAP Destination Service
→ OAuth2 Client Credentials
→ SAP Integration Suite
→ Cloud Integration iFlow
→ SOAP Receiver
→ Mock SAP S/4HANA Journal Entry endpoint
→ SAP-style SOAP confirmation
→ NHBCAP01 response parsing
→ MurabahaAccountingEvent persisted as POSTED

The current implementation has been verified for both:

- PAYMENT_RECEIVED
- PAYMENT_REVERSED

The current receiver is a controlled mock S/4HANA endpoint deployed to Cloud Foundry. A live SAP S/4HANA Journal Entry service remains a future step.

---

## 2. Verified Runtime Components

### 2.1 NHBCAP01 CAP application

Cloud Foundry application:

NHBCAP01-srv

Verified route:

https://a79b9755trial-dev-nhbcap01-srv.cfapps.us10-001.hana.ondemand.com

Service root:

/service/NHBCAP01Service

Relevant unbound CAP action:

postAccountingEvent(accountingEventId)

The action accepts a MurabahaAccountingEvent ID and performs the SAP accounting posting flow.

---

### 2.2 SAP Integration Suite

Integration Suite package:

NHB Integration

Integration Flow:

NHB - S4 Journal Entry Mediation

Integration Flow ID:

NHB_S4_Journal_Entry_Mediation

Inbound HTTPS sender address:

/nhb/s4/journal-entry

Runtime endpoint:

https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry

Sender authorization:

User Role

Required role:

ESBMessaging.send

---

### 2.3 Process Integration Runtime service instance

Service instance:

nhb-integration-flow-runtime

Service:

SAP Process Integration Runtime

Plan:

integration-flow

Required role configuration:

ESBMessaging.send

OAuth grant type:

client_credentials

Service key:

nhb-integration-flow-runtime-key

The service key provides:

- clientid
- clientsecret
- tokenurl
- runtime url

Do not store the client secret in source control.

---

## 3. Authentication Model

NHBCAP01 and SAP Integration Suite use different OAuth clients and different bearer tokens.

### 3.1 NHBCAP01 token

Used when calling the deployed CAP service.

Environment variable:

XSUAA_TOKEN

This token is issued for the NHBCAP01 XSUAA client.

Example client identity:

sb-nhb-cap01!t711977

This token must not be used to call Integration Suite.

---

### 3.2 Integration Suite token

Used when calling the Integration Suite runtime endpoint directly.

Environment variable:

IS_TOKEN

This token must be issued using the credentials from:

nhb-integration-flow-runtime-key

A CAP XSUAA token is not valid for the Integration Suite runtime.

A wrong token produces an error similar to:

401 Unauthorized

Bearer error="invalid_token"

The token audience does not match the Integration Suite runtime client.

---

## 4. Loading Integration Suite OAuth Credentials in BAS

Load the runtime client ID:

export IS_CLIENT_ID='PASTE_INTEGRATION_SUITE_CLIENT_ID_HERE'

Load the client secret without displaying it:

read -s -p "Integration Suite client secret: " IS_CLIENT_SECRET
export IS_CLIENT_SECRET
echo

Set the token URL:

export IS_TOKEN_URL='https://a79b9755trial.authentication.us10.hana.ondemand.com/oauth/token'

Verify only safe values:

echo "IS_CLIENT_ID length: ${#IS_CLIENT_ID}"
echo "IS_CLIENT_SECRET length: ${#IS_CLIENT_SECRET}"
echo "IS_TOKEN_URL: $IS_TOKEN_URL"

Generate a token:

TOKEN_RESPONSE=$(curl -sS \
  -u "$IS_CLIENT_ID:$IS_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  "$IS_TOKEN_URL")

export IS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

echo "IS_TOKEN length: ${#IS_TOKEN}"

A successful Integration Suite token was approximately 1995 characters in the verified test.

---

## 5. Loading NHBCAP01 XSUAA Credentials in BAS

The NHBCAP01 XSUAA service instance is:

nhb-xsuaa

A temporary or dedicated service key may be used to obtain:

- clientid
- clientsecret
- token URL

Example:

cf create-service-key nhb-xsuaa nhb-xsuaa-test-key

cf service-key nhb-xsuaa nhb-xsuaa-test-key

Do not paste or commit the secret.

Load the client ID:

export XSUAA_CLIENT_ID='sb-nhb-cap01!t711977'

Load the secret safely:

read -s -p "XSUAA client secret: " XSUAA_CLIENT_SECRET
export XSUAA_CLIENT_SECRET
echo

Set the token URL:

export XSUAA_TOKEN_URL='https://a79b9755trial.authentication.us10.hana.ondemand.com/oauth/token'

Generate the token:

XSUAA_RESPONSE=$(curl -sS \
  -u "$XSUAA_CLIENT_ID:$XSUAA_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  "$XSUAA_TOKEN_URL")

export XSUAA_TOKEN=$(echo "$XSUAA_RESPONSE" | jq -r '.access_token')

echo "XSUAA_TOKEN length: ${#XSUAA_TOKEN}"

A successful NHBCAP01 XSUAA token was approximately 1375 characters in the verified test.

---

## 6. BAS Shell Variable Persistence

BAS terminal environment variables may disappear when the terminal or dev space session changes.

Variables that may need to be reloaded include:

APP_URL

XSUAA_CLIENT_ID

XSUAA_CLIENT_SECRET

XSUAA_TOKEN_URL

XSUAA_TOKEN

IS_CLIENT_ID

IS_CLIENT_SECRET

IS_TOKEN_URL

IS_TOKEN

SAP_JOURNAL_ENTRY_DESTINATION

A non-empty variable does not prove that a token is still valid.

Tokens may expire and need to be regenerated.

---

## 7. Mock SAP S/4HANA Receiver

The controlled mock application is:

nhb-mock-s4

Cloud Foundry route:

https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com

Journal Entry endpoint:

https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry

Check application status:

cf apps | grep nhb-mock-s4

Expected:

started
web:1/1

If stopped:

cf start nhb-mock-s4

A stopped mock application may cause Integration Suite to return:

500 Internal Server Error

with an underlying receiver error such as:

404 Not Found

Requested route 'nhb-mock-s4.cfapps.us10-001.hana.ondemand.com' does not exist

---

## 8. Direct Mock Receiver Test

Before testing Integration Suite, verify the mock receiver directly:

curl -i \
  -X POST \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data '<Envelope>test</Envelope>' \
  "https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry"

Expected result:

HTTP 200

with a SAP-style response containing:

AccountingDocument
1900000001

CompanyCode
1000

FiscalYear
2026

BusinessDocumentProcessingResultCode
SUCCESS

---

## 9. Integration Suite iFlow Configuration

### 9.1 HTTPS Sender

Address:

/nhb/s4/journal-entry

Authorization:

User Role

User Role:

ESBMessaging.send

CSRF Protected:

unchecked

The runtime endpoint is derived from the sender address:

https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry

---

### 9.2 SOAP Receiver

Receiver adapter:

SOAP

Protocol:

SOAP 1.x

Transport:

HTTPS

Receiver address:

https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry

Proxy Type:

Internet

Authentication:

None

Timeout:

60000

WS-Security:

None

The current Phase 1 design preserves SOAP creation in NHBCAP01.

Integration Suite currently acts primarily as an enterprise mediation layer rather than performing the SAP-specific XML transformation itself.

---

## 10. Verifying the Integration Suite Endpoint

A request without authentication can be used to verify that the endpoint exists:

curl -i \
  "https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry"

Expected result:

401 Unauthorized

This is a positive infrastructure signal.

It proves:

- the endpoint exists
- the route is registered
- authentication is required

A 404 would indicate that the sender endpoint is not registered correctly.

---

## 11. Direct Integration Suite Smoke Test

Generate a fresh Integration Suite token first.

Then send:

curl -i \
  -X POST \
  -H "Authorization: Bearer $IS_TOKEN" \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <Test>NHBCAP01 Integration Suite smoke test</Test>
  </soapenv:Body>
</soapenv:Envelope>' \
  "https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry"

Verified successful result:

HTTP/1.1 200 OK

with:

AccountingDocument
1900000001

CompanyCode
1000

FiscalYear
2026

BusinessDocumentProcessingResultCode
SUCCESS

Note
Mock S/4 journal entry posted successfully.

This proves:

BAS
→ authenticated Integration Suite endpoint
→ iFlow
→ SOAP receiver
→ mock S/4
→ response through Integration Suite
→ BAS

---

## 12. Testing the Real NHBCAP01 SOAP Builder

Generate a SOAP message using the real project implementation:

node - <<'NODE'
const { buildJournalEntrySoapRequest } =
  require('./srv/sap/journal-entry-soap');

const xml = buildJournalEntrySoapRequest(
  {
    eventType: 'PAYMENT_RECEIVED',
    companyCode: '1000',
    documentType: 'SA',
    businessTransactionType: 'RFBU',
    createdByUser: 'NHBCAP01',
    documentDate: '2026-09-30',
    postingDate: '2026-09-30',
    currency: 'USD',
    amount: 1000,
    debitAccount: '110000',
    creditAccount: '410000',
    reference: 'NHBTEST001'
  },
  {
    serviceMessageId: 'NHB-IS-TEST-001',
    journalEntryMessageId: 'NHB-JE-TEST-001',
    creationDateTime: new Date().toISOString()
  }
);

require('fs').writeFileSync(
  '/tmp/nhb-journal-entry.xml',
  xml
);

console.log('Created /tmp/nhb-journal-entry.xml');
NODE

Verify:

wc -c /tmp/nhb-journal-entry.xml

The verified generated request was approximately:

2094 bytes

Send it through Integration Suite:

curl -i \
  -X POST \
  -H "Authorization: Bearer $IS_TOKEN" \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data-binary @/tmp/nhb-journal-entry.xml \
  "https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry"

Verified result:

HTTP 200

This proves:

NHBCAP01 SOAP builder
→ Integration Suite
→ mock S/4
→ SAP-style confirmation

---

## 13. Temporary File Location in BAS

Files written to:

/tmp

exist in the BAS Linux filesystem but do not necessarily appear in the BAS project Explorer.

Example:

/tmp/nhb-journal-entry.xml

Verify:

ls -l /tmp/nhb-journal-entry.xml

or:

wc -c /tmp/nhb-journal-entry.xml

To display the file in the project Explorer:

cp /tmp/nhb-journal-entry.xml ./test/nhb-journal-entry.xml

Temporary test files should not automatically be committed to source control.

---

## 14. BTP Destination for Integration Suite

Destination name:

NHB-INTEGRATION-SUITE-S4

Location:

BTP Cockpit
→ Subaccount
→ Connectivity
→ Destinations

Type:

HTTP

URL:

https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry

Proxy Type:

Internet

Authentication:

OAuth2ClientCredentials

Client ID:

Use oauth.clientid from:

nhb-integration-flow-runtime-key

Client Secret:

Use oauth.clientsecret from the same service key

Token Service URL:

https://a79b9755trial.authentication.us10.hana.ondemand.com/oauth/token

Do not mix credentials from NHBCAP01 XSUAA and Integration Suite runtime.

A destination connection check may report:

HTTP request without authentication succeeded

This proves network reachability but does not by itself prove the full OAuth-authenticated POST flow.

---

## 15. NHBCAP01 Transport Selection

The deployed CAP application uses:

SAP_JOURNAL_ENTRY_DESTINATION

Set:

cf set-env NHBCAP01-srv \
  SAP_JOURNAL_ENTRY_DESTINATION \
  NHB-INTEGRATION-SUITE-S4

Restart or redeploy the application after changing environment variables.

Verify:

cf env NHBCAP01-srv | grep SAP_JOURNAL_ENTRY_DESTINATION

Expected:

SAP_JOURNAL_ENTRY_DESTINATION: NHB-INTEGRATION-SUITE-S4

The existing transport abstraction in:

srv/sap/transport.js

uses:

@​sap-cloud-sdk/http-client

executeHttpRequest

When SAP_JOURNAL_ENTRY_DESTINATION is set, destination mode is selected automatically.

No Integration Suite OAuth implementation is required directly inside NHBCAP01.

The Destination service owns OAuth2 client-credentials handling.

---

## 16. Local Destination Limitation

Running the destination-based transport directly from a local BAS Node process may fail with:

Could not find service binding of type 'destination'

Example:

ErrorWithCause: Failed to load destination.

This occurs because a local Node process does not automatically inherit the Cloud Foundry Destination service binding.

The deployed NHBCAP01-srv application is bound to:

NHBCAP01-destination

Therefore the preferred verification path is through the deployed Cloud Foundry application.

---

## 17. SAP Accounting Runtime Configuration

The following Cloud Foundry environment variables are required:

SAP_ACCOUNTING_COMPANY_CODE

SAP_ACCOUNTING_DOCUMENT_TYPE

SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE

SAP_ACCOUNTING_CREATED_BY_USER

SAP_ACCOUNTING_DEBIT_ACCOUNT

SAP_ACCOUNTING_CREDIT_ACCOUNT

SAP_ACCOUNTING_REVERSAL_REASON

Verified test values:

SAP_ACCOUNTING_COMPANY_CODE=1000

SAP_ACCOUNTING_DOCUMENT_TYPE=SA

SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE=RFBU

SAP_ACCOUNTING_CREATED_BY_USER=NHBCAP01

SAP_ACCOUNTING_DEBIT_ACCOUNT=110000

SAP_ACCOUNTING_CREDIT_ACCOUNT=410000

SAP_ACCOUNTING_REVERSAL_REASON=01

Example:

cf set-env NHBCAP01-srv SAP_ACCOUNTING_COMPANY_CODE 1000
cf set-env NHBCAP01-srv SAP_ACCOUNTING_DOCUMENT_TYPE SA
cf set-env NHBCAP01-srv SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE RFBU
cf set-env NHBCAP01-srv SAP_ACCOUNTING_CREATED_BY_USER NHBCAP01
cf set-env NHBCAP01-srv SAP_ACCOUNTING_DEBIT_ACCOUNT 110000
cf set-env NHBCAP01-srv SAP_ACCOUNTING_CREDIT_ACCOUNT 410000
cf set-env NHBCAP01-srv SAP_ACCOUNTING_REVERSAL_REASON 01

Restart after setting the variables.

---

## 18. SAP Document Reference Constraint

The SAP Journal Entry builder enforces:

DocumentReferenceID maximum length = 16 characters

Originally:

accountingEvent.correlationId

was mapped directly to the SAP document reference.

Real NHBCAP01 correlation IDs are longer than 16 characters.

Example:

PAY-SVC-002-20260925185040-25064

This caused:

Journal entry field reference exceeds SAP maximum length 16

The corrected implementation derives the SAP reference from the accounting-event UUID.

Helper:

buildSapDocumentReference(accountingEvent)

Rule:

remove hyphens from accountingEvent.ID
take the first 16 characters

Example:

Accounting Event ID:

243909b6-5b78-4a88-ae32-854abced75de

SAP DocumentReferenceID:

243909b65b784a88

The full NHBCAP01 correlationId remains stored internally for traceability.

The SAP-specific 16-character reference is deterministic and isolated to the outbound SAP contract.

---

## 19. SAP Regression Test Baseline

Relevant test files are currently located in the project root:

sap-accounting.test.js

sap-journal-entry-response.test.js

sap-journal-entry-reversal-soap.test.js

sap-journal-entry-soap.test.js

sap-transport.test.js

Run:

node --test \
  sap-journal-entry-soap.test.js \
  sap-journal-entry-response.test.js \
  sap-journal-entry-reversal-soap.test.js \
  sap-transport.test.js \
  sap-accounting.test.js

Verified result after introducing the SAP-safe document reference:

44 tests
44 pass
0 fail

---

## 20. Deployment

The repository is an MTA project.

Build:

mbt build

Deploy:

cf deploy mta_archives/*.mtar -f

A restart does not upload changed source code.

This distinction is important.

Command:

cf restart NHBCAP01-srv

reloads the existing deployed application but does not deploy new local source changes.

Verify deployment timestamp:

cf app NHBCAP01-srv | grep "last uploaded"

The verified Integration Suite application-level test used a deployment uploaded on:

30 Sep 2026

---

## 21. HANA Availability Check

A CAP request may return:

500 Internal Server Error

with logs showing:

TimeoutError: ResourceRequest timed out

This indicates that CAP could not obtain a database connection from the HANA connection pool.

Check:

cf services | grep -E 'hana|hdi'

and:

cf app NHBCAP01-srv

Then verify the HANA Cloud database runtime state in BTP Cockpit.

A simple database-backed test is:

curl -sS \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  "$APP_URL/service/NHBCAP01Service/MurabahaFinancing?\$top=1" \
  | jq

HTTP 200 proves the database path is available again.

---

## 22. Querying Pending Accounting Events

Set the CAP route:

export APP_URL='https://a79b9755trial-dev-nhbcap01-srv.cfapps.us10-001.hana.ondemand.com'

Query pending events:

curl -sS \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  "$APP_URL/service/NHBCAP01Service/MurabahaAccountingEvent?\$filter=postingStatus%20eq%20'PENDING'&\$top=5" \
  | jq

For payment posting tests, prefer:

eventType = PAYMENT_RECEIVED

postingStatus = PENDING

---

## 23. Posting a Real Accounting Event

Set the event ID:

ACCOUNTING_EVENT_ID='PASTE_PENDING_EVENT_ID_HERE'

Invoke the unbound action:

curl -sS -X POST \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"accountingEventId\":\"$ACCOUNTING_EVENT_ID\"}" \
  "$APP_URL/service/NHBCAP01Service/postAccountingEvent" \
  | jq

Verified successful PAYMENT_RECEIVED result:

postingStatus:

POSTED

externalAccountingDocument:

1900000001

externalCompanyCode:

1000

externalFiscalYear:

2026

externalAccountingDocumentId:

1000-2026-1900000001

errorMessage:

null

This proves:

NHBCAP01
→ accounting.js
→ transport.js
→ Destination Service
→ Integration Suite
→ mock S/4
→ SAP response parser
→ accounting event persisted as POSTED

---

## 24. Reversal Preconditions

A PAYMENT_REVERSED event can only be posted when its original PAYMENT_RECEIVED accounting event has already been successfully posted.

The original posting must contain:

postingStatus = POSTED

externalAccountingDocument

externalCompanyCode

externalFiscalYear

The reversal implementation uses this SAP document identity to construct the reversal reference.

If the original posting is not POSTED, the reversal is rejected.

---

## 25. Verified Reversal Flow

The original PAYMENT_RECEIVED event was first posted successfully.

Verified original SAP identity:

Accounting Document:

1900000001

Company Code:

1000

Fiscal Year:

2026

Then the corresponding PAYMENT_REVERSED event was submitted through:

postAccountingEvent

Verified reversal result:

eventType:

PAYMENT_REVERSED

postingStatus:

POSTED

externalAccountingDocument:

1900000001

externalAccountingDocumentId:

1000-2026-1900000001

externalCompanyCode:

1000

externalFiscalYear:

2026

errorMessage:

null

This proves that both normal posting and reversal are functioning through the same Integration Suite mediation architecture.

---

## 26. Error Persistence Behavior

If SAP posting fails inside postAccountingEvent, the handler updates the accounting event:

postingStatus = FAILED

errorMessage = error text

The handler then returns the updated accounting event.

Example discovered during verification:

postingStatus:

FAILED

errorMessage:

Journal entry field reference exceeds SAP maximum length 16

This behavior provides operational evidence of failed posting attempts while preserving the accounting event record.

---

## 27. Troubleshooting Catalogue

### 27.1 URL rejected: No host part in the URL

Cause:

APP_URL is empty.

Check:

echo "APP_URL=$APP_URL"

Fix:

export APP_URL='https://a79b9755trial-dev-nhbcap01-srv.cfapps.us10-001.hana.ondemand.com'

---

### 27.2 curl blank argument

Example:

curl: option : blank argument where content is expected

Cause:

one or more required shell variables are empty.

Typical variables:

IS_CLIENT_ID

IS_CLIENT_SECRET

IS_TOKEN_URL

XSUAA_CLIENT_ID

XSUAA_CLIENT_SECRET

XSUAA_TOKEN_URL

Check variable lengths before calling curl.

---

### 27.3 OAuth invalid_client

Example:

error:

invalid_client

error_description:

Bad credentials

Cause:

client ID and client secret do not belong to the same service key, or one value was copied incorrectly.

Fix:

reload both values from the same service-key JSON.

---

### 27.4 Integration Suite invalid_token

Example:

401 Unauthorized

token audience is not issued for the expected Integration Suite client IDs

Cause:

NHBCAP01 XSUAA token was used against Integration Suite.

Fix:

generate IS_TOKEN from:

nhb-integration-flow-runtime-key

---

### 27.5 Integration Suite 500 with downstream 404

Example:

Requested route 'nhb-mock-s4.cfapps.us10-001.hana.ondemand.com' does not exist

Cause:

mock S/4 application is stopped.

Fix:

cf start nhb-mock-s4

---

### 27.6 Destination cannot be loaded locally

Example:

Could not find service binding of type 'destination'

Cause:

local BAS Node process does not have the Cloud Foundry Destination service binding.

Preferred solution:

test through deployed NHBCAP01-srv.

---

### 27.7 CAP returns HANA connection timeout

Example:

TimeoutError: ResourceRequest timed out

Cause:

HANA runtime unavailable, sleeping, restarting, or temporarily unable to provide a connection.

Check:

HANA Cloud runtime state

CAP app health

simple database-backed OData request

---

### 27.8 Accounting configuration missing

Example:

SAP accounting configuration is missing:
companyCode,
documentType,
businessTransactionType,
createdByUser,
debitAccount,
creditAccount

Cause:

required SAP_ACCOUNTING_* environment variables are not configured in Cloud Foundry.

Fix:

set the required variables and restart the app.

---

### 27.9 Restart performed but new code not active

Symptom:

Cloud Foundry still executes previous source behavior.

Cause:

cf restart only restarts the currently deployed build.

Fix:

mbt build

cf deploy mta_archives/*.mtar -f

Verify:

cf app NHBCAP01-srv | grep "last uploaded"

---

## 28. Verified Integration Baseline

As of 30 September 2026, the following path has been verified:

NHBCAP01 deployed on SAP BTP Cloud Foundry
→ SAP Destination Service
→ OAuth2ClientCredentials
→ SAP Integration Suite
→ Cloud Integration iFlow
→ SOAP Receiver
→ Mock SAP S/4HANA Journal Entry endpoint
→ SAP-style synchronous confirmation
→ NHBCAP01 SAP response parser
→ MurabahaAccountingEvent persistence

Verified event types:

PAYMENT_RECEIVED

PAYMENT_REVERSED

Verified SAP-style identity:

Accounting Document:
1900000001

Company Code:
1000

Fiscal Year:
2026

External Accounting Document ID:
1000-2026-1900000001

Verified SAP regression:

44 PASS
0 FAIL

---

## 29. Current Architecture Responsibility

NHBCAP01 owns:

- Murabaha business lifecycle
- accounting-event creation
- posting eligibility
- traceability
- event status
- SAP accounting mapping
- SOAP request construction
- SAP response parsing
- persistence of SAP document identity

SAP Destination Service owns:

- destination abstraction
- Integration Suite endpoint configuration
- OAuth2 Client Credentials handling

SAP Integration Suite owns:

- enterprise integration mediation
- endpoint abstraction
- runtime routing
- integration monitoring
- receiver connectivity

Mock S/4HANA owns:

- controlled SAP-style receiver behavior
- deterministic confirmation response for testing

---

## 30. Next Steps

The current Integration Suite baseline should now be frozen and documented before additional integration complexity is introduced.

Recommended next steps:

1. update docs/architecture.md with the verified Integration Suite architecture
2. update docs/sap-test-catalog.md with posting and reversal evidence
3. record the SAP-safe DocumentReferenceID decision
4. commit the Integration Suite baseline
5. verify Cloud Foundry working tree/deployment evidence
6. consider adding correlation propagation through Integration Suite
7. strengthen Integration Suite error handling and observability
8. consider moving SAP-specific transformation into Integration Suite in a later architecture phase
9. replace the mock receiver with the live SAP S/4HANA Journal Entry service when the environment becomes available
10. update AV-03 when implementation evidence is formally modeled in the EA repository