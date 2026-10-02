# SAP Integration Suite Runbook — NHBCAP01 to SAP S/4HANA Journal Entry

## 1. Purpose

This runbook documents the verified setup, configuration, deployment, testing, and troubleshooting steps for the NHBCAP01 SAP Integration Suite mediation flow.

The verified integration path is:

NHBCAP01
→ SAP Destination Service
→ OAuth2 Client Credentials
→ SAP Integration Suite
→ Cloud Integration iFlow
→ HTTP Receiver
→ Mock SAP S/4HANA Journal Entry endpoint
→ SAP-style SOAP confirmation
→ NHBCAP01 response parsing
→ MurabahaAccountingEvent persisted as POSTED

The current implementation has been verified for both:

- PAYMENT_RECEIVED
- PAYMENT_REVERSED

The current receiver is a controlled mock S/4HANA endpoint deployed to Cloud Foundry. A live SAP S/4HANA Journal Entry service remains pending external verification.

The mediation and correlation-observability baseline is implemented and verified. AV-03 — NHBCAP01 Architecture-to-Implementation Realization is completed as v1.0, and portfolio packaging and documentation polish are now the current phase.

The commands below reproduce the verified prototype workflow; they are not evidence of live SAP accounting execution.

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

```bash
export IS_CLIENT_ID='PASTE_INTEGRATION_SUITE_CLIENT_ID_HERE'
```

Load the client secret without displaying it:

```bash
read -s -p "Integration Suite client secret: " IS_CLIENT_SECRET
export IS_CLIENT_SECRET
echo
```

Set the token URL:

```bash
export IS_TOKEN_URL='https://a79b9755trial.authentication.us10.hana.ondemand.com/oauth/token'
```

Verify only safe values:

```bash
echo "IS_CLIENT_ID length: ${#IS_CLIENT_ID}"
echo "IS_CLIENT_SECRET length: ${#IS_CLIENT_SECRET}"
echo "IS_TOKEN_URL: $IS_TOKEN_URL"
```

Generate a token:

```bash
TOKEN_RESPONSE=$(curl -sS \
  -u "$IS_CLIENT_ID:$IS_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  "$IS_TOKEN_URL")
```

```bash
export IS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
```

```bash
echo "IS_TOKEN length: ${#IS_TOKEN}"
```

The Integration Suite token was approximately 1995 characters in the recorded test. Token length is historical diagnostic evidence, not a validity check; confirm that token acquisition succeeds and that the response contains an access token.

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

```bash
export XSUAA_CLIENT_ID='sb-nhb-cap01!t711977'
```

Load the secret safely:

```bash
read -s -p "XSUAA client secret: " XSUAA_CLIENT_SECRET
export XSUAA_CLIENT_SECRET
echo
```

Set the token URL:

```bash
export XSUAA_TOKEN_URL='https://a79b9755trial.authentication.us10.hana.ondemand.com/oauth/token'
```

Generate the token:

```bash
XSUAA_RESPONSE=$(curl -sS \
  -u "$XSUAA_CLIENT_ID:$XSUAA_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  "$XSUAA_TOKEN_URL")
```

```bash
export XSUAA_TOKEN=$(echo "$XSUAA_RESPONSE" | jq -r '.access_token')
```

```bash
echo "XSUAA_TOKEN length: ${#XSUAA_TOKEN}"
```

The NHBCAP01 XSUAA token was approximately 1375 characters in the recorded test. Token length does not establish token validity or the correct audience.

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

```bash
curl -i \
  -X POST \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data '<Envelope>test</Envelope>' \
  "https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry"
```

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

### 9.2 HTTP Receiver

Receiver adapter:

HTTP

Receiver address:

https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry

Proxy Type:

Internet

Method:

POST

Authentication:

None

Content-Type:

text/xml; charset=utf-8

The Phase 1 design preserves SAP SOAP/XML construction inside NHBCAP01.

Integration Suite therefore does not need to interpret or reconstruct the SOAP message. It acts as an enterprise mediation and transport layer:

NHBCAP01
→ SOAP/XML request generated by CAP
→ SAP Destination Service
→ Integration Suite HTTPS sender
→ correlation logging
→ HTTP receiver
→ mock S/4HANA

The receiver was changed from the SOAP 1.x adapter to the HTTP adapter after runtime verification showed that the SOAP/CXF receiver reached the mock successfully but failed while parsing the valid SOAP response with:

Unexpected EOF in prolog

The mock endpoint independently returned HTTP 200 and a valid 715-byte SOAP 1.1 response.

Using the HTTP receiver removes unnecessary SOAP/CXF interpretation while preserving the Phase 1 architecture decision that NHBCAP01 owns SOAP request construction and SAP response parsing.

---

## 10. Verifying the Integration Suite Endpoint

A request without authentication can be used to verify that the endpoint exists:

```bash
curl -i \
  "https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry"
```

Expected result:

401 Unauthorized

This is a positive authentication-boundary signal at the requested route. It does not by itself prove successful iFlow execution or receiver connectivity.

Use the authenticated POST smoke test in section 11 to verify mediation to the mock receiver. A 404 warrants checking the sender address, deployed iFlow, and runtime route.

---

## 11. Direct Integration Suite Smoke Test

Generate a fresh Integration Suite token first.

Then send:

```bash
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
```

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
→ HTTP receiver
→ mock S/4
→ response through Integration Suite
→ BAS

---

## 12. Testing the Real NHBCAP01 SOAP Builder

Generate a SOAP message using the real project implementation:

```bash
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
```

Verify:

wc -c /tmp/nhb-journal-entry.xml

The verified generated request was approximately:

2094 bytes

Send it through Integration Suite:

```bash
curl -i \
  -X POST \
  -H "Authorization: Bearer $IS_TOKEN" \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data-binary @/tmp/nhb-journal-entry.xml \
  "https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry"
```

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

@sap-cloud-sdk/http-client

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

Verified prototype test values (not a production accounting design):

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

```bash
node --test \
  sap-journal-entry-soap.test.js \
  sap-journal-entry-response.test.js \
  sap-journal-entry-reversal-soap.test.js \
  sap-transport.test.js \
  sap-accounting.test.js
```

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

```bash
curl -sS \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  "$APP_URL/service/NHBCAP01Service/MurabahaFinancing?\$top=1" \
  | jq
```

HTTP 200 proves the database path is available again.

---

## 22. Querying Pending Accounting Events

Set the CAP route:

export APP_URL='https://a79b9755trial-dev-nhbcap01-srv.cfapps.us10-001.hana.ondemand.com'

Query pending events:

```bash
curl -sS \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  "$APP_URL/service/NHBCAP01Service/MurabahaAccountingEvent?\$filter=postingStatus%20eq%20'PENDING'&\$top=5" \
  | jq
```

For payment posting tests, prefer:

eventType = PAYMENT_RECEIVED

postingStatus = PENDING

---

## 23. Posting a Real Accounting Event

Set the event ID:

ACCOUNTING_EVENT_ID='PASTE_PENDING_EVENT_ID_HERE'

Invoke the unbound action:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $XSUAA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"accountingEventId\":\"$ACCOUNTING_EVENT_ID\"}" \
  "$APP_URL/service/NHBCAP01Service/postAccountingEvent" \
  | jq
```

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

This verifies normal posting and reversal orchestration through the deployed Integration Suite mediation path to the controlled mock receiver. The mock returns deterministic SAP-style document identity; the repeated document number does not prove that distinct documents were created in a live SAP ledger.

---

## 26. Error Persistence Behavior

If an accounting posting attempt begins and fails during SOAP construction, transport, confirmation parsing, or SAP response validation, the handler persists normalized failure evidence on the accounting event:

postingStatus = FAILED

errorMessage = bounded failure information

The handler then returns the updated accounting event.

Pre-attempt validation failures, such as missing accounting configuration, leave the event PENDING. They must not be described as evidence of a failed SAP posting attempt.

Example discovered during verification:

postingStatus:

FAILED

errorMessage:

Journal entry field reference exceeds SAP maximum length 16

This behavior provides operational evidence of failed posting attempts while preserving the accounting event record.

---

## 27. Correlation Observability and Renewable Test Fixture

### 27.1 Correlation propagation

NHBCAP01 propagates the accounting-event correlation identifier through the outbound SAP transport as:

X-Correlation-ID

The value originates from:

MurabahaAccountingEvent.correlationId

Example verified value:

PAY-IS-20260930234523-55694

The transport implementation adds the header in:

srv/sap/transport.js

Both destination mode and basic-auth transport mode preserve the header.

The accounting layer supplies the request context from:

srv/sap/accounting.js

using:

correlationId:
    accountingEvent.correlationId

### 27.2 Integration Suite allowed header

The Cloud Integration iFlow Runtime Configuration includes:

Allowed Header(s):

X-Correlation-ID

This permits the inbound NHBCAP01 correlation header to remain available inside the iFlow.

### 27.3 MPL custom property

The iFlow contains a Groovy script step between the HTTPS sender and Request Reply.

Repository source:

srv/integration/setNhbCorrelationMpl.groovy

The script reads:

X-Correlation-ID

and adds the searchable Message Processing Log custom header property:

NHB_CorrelationId

Verified MPL evidence:

OverallStatus = COMPLETED

IntermediateError = false

CustomHeaderProperties =
{NHB_CorrelationId=[PAY-IS-20260930234523-55694]}

This provides an operational traceability path from the NHBCAP01 accounting event into SAP Integration Suite monitoring.

The Integration Suite internal CorrelationId remains separate from the NHB business correlation identifier.

#### Runtime correlation verification — 2026-10-03

CAP persisted `PAYMENT_RECEIVED` accounting event `e7a31f2d-98b9-432a-ba09-62169b222308` with `correlationId = PAY-IS-20260930234523-55694` and `postingStatus = POSTED`.

The event records SAP-style accounting document `1900000001`, company code `1000`, fiscal year `2026`, and external document ID `1000-2026-1900000001`. The receiver remains the controlled mock SAP S/4HANA receiver.

The corresponding `NHB_S4_Journal_Entry_Mediation` MPL message `AGq9n1MJg4GgqsB1G7Y3lgIhIx4a` completed with `NHB_CorrelationId = PAY-IS-20260930234523-55694`. Its native technical correlation ID is `AGq9n1MNd3mH1YxKoLiEXOsvJC8w`, independently maintained by Integration Suite.

This verifies the business correlation value from CAP persistence through `X-Correlation-ID` to searchable MPL metadata, with MPL status `COMPLETED` and the CAP accounting event `POSTED`. The Integration Suite observability checkpoint is verified and closed.

### 27.4 Verified end-to-end correlation path

The verified path is:

MurabahaAccountingEvent.correlationId
→ srv/sap/accounting.js
→ srv/sap/transport.js
→ X-Correlation-ID
→ SAP Destination Service
→ Integration Suite HTTPS sender
→ Allowed Header
→ Groovy script
→ NHB_CorrelationId
→ Message Processing Log

The same correlation identifier remains stored on the originating NHBCAP01 accounting event.

### 27.5 Renewable accounting-event fixture

Previously generated PENDING accounting events are one-time posting candidates.

A successfully posted event must not be reset to PENDING merely to repeat an Integration Suite test because that would weaken accounting-event audit semantics.

A dedicated renewable fixture is therefore provided:

test/integration-suite-accounting-fixture.sh

The script creates:

fresh Murabaha financing
→ installment
→ governed credit decision
→ governed Sharia decision
→ asset acquisition
→ sale-contract execution
→ delivery confirmation
→ financing activation
→ payment
→ new PAYMENT_RECEIVED accounting event

Each execution produces a fresh:

FINANCING_ID
INSTALLMENT_ID
PAYMENT_ID
ACCOUNTING_EVENT_ID
CORRELATION_ID
POSTING_STATUS

Expected initial accounting status:

PENDING

Example Cloud Foundry execution:

```bash
BASE_URL="$APP_URL/service/NHBCAP01Service" \
XSUAA_TOKEN="$XSUAA_TOKEN" \
bash test/integration-suite-accounting-fixture.sh
```

Verified fixture result:

CORRELATION_ID=PAY-IS-20260930234523-55694

POSTING_STATUS=PENDING

The resulting event was subsequently posted successfully through Integration Suite and persisted as:

postingStatus=POSTED

externalAccountingDocument=1900000001

externalCompanyCode=1000

externalFiscalYear=2026

externalAccountingDocumentId=1000-2026-1900000001

errorMessage=null

---

## 28. Troubleshooting Catalogue

### 28.1 URL rejected: No host part in the URL

Cause:

APP_URL is empty.

Check:

echo "APP_URL=$APP_URL"

Fix:

export APP_URL='https://a79b9755trial-dev-nhbcap01-srv.cfapps.us10-001.hana.ondemand.com'

---

### 28.2 curl blank argument

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

### 28.3 OAuth invalid_client

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

### 28.4 Integration Suite invalid_token

Example:

401 Unauthorized

token audience is not issued for the expected Integration Suite client IDs

Cause:

NHBCAP01 XSUAA token was used against Integration Suite.

Fix:

generate IS_TOKEN from:

nhb-integration-flow-runtime-key

---

### 28.5 Integration Suite 500 with downstream 404

Example:

Requested route 'nhb-mock-s4.cfapps.us10-001.hana.ondemand.com' does not exist

Cause:

mock S/4 application is stopped.

Fix:

cf start nhb-mock-s4

---

### 28.6 Destination cannot be loaded locally

Example:

Could not find service binding of type 'destination'

Cause:

local BAS Node process does not have the Cloud Foundry Destination service binding.

Preferred solution:

test through deployed NHBCAP01-srv.

---

### 28.7 CAP returns HANA connection timeout

Example:

TimeoutError: ResourceRequest timed out

Cause:

HANA runtime unavailable, sleeping, restarting, or temporarily unable to provide a connection.

Check:

HANA Cloud runtime state

CAP app health

simple database-backed OData request

---

### 28.8 Accounting configuration missing

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

### 28.9 Restart performed but new code not active

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

## 29. Verified Integration Baseline

As of 30 September 2026, the following path has been verified:

NHBCAP01 deployed on SAP BTP Cloud Foundry
→ SAP Destination Service
→ OAuth2ClientCredentials
→ SAP Integration Suite
→ Cloud Integration iFlow
→ X-Correlation-ID propagation
→ NHB_CorrelationId MPL custom property
→ HTTP Receiver
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

## 30. Current Architecture Responsibility

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
- preservation of the inbound NHB correlation header
- searchable MPL correlation metadata

Mock S/4HANA owns:

- controlled SAP-style receiver behavior
- deterministic confirmation response for testing

---

## 31. Next Steps

The Integration Suite Phase 1 baseline is now implemented and verified.

Completed baseline:

1. NHBCAP01 accounting-event posting through SAP Destination Service
2. OAuth2ClientCredentials authentication to Integration Suite
3. Cloud Integration iFlow mediation
4. HTTP receiver transport to the controlled mock S/4HANA endpoint
5. PAYMENT_RECEIVED posting
6. PAYMENT_REVERSED posting
7. SAP-safe DocumentReferenceID derivation
8. X-Correlation-ID propagation from NHBCAP01
9. searchable NHB_CorrelationId in Integration Suite MPL
10. renewable accounting-event test fixture
11. successful CAP response parsing and SAP document identity persistence
12. SAP accounting regression baseline of 44 PASS / 0 FAIL

Current documentation and portfolio phase:

1. Complete the focused documentation polish, including `docs/sap-test-catalog.md`, against the verified 44 PASS / 0 FAIL baseline and deployed mediation evidence.
2. Keep `docs/architecture.md` aligned with the verified correlation and HTTP-receiver architecture recorded there.
3. Present the completed AV-03 v1.0 architecture-to-implementation realization and the completed first CAP internals deep-understanding pass consistently across the portfolio.
4. Review the documentation diffs before freezing and committing the polish changes.

Selective future integration work:

1. Preserve the current Phase 1 responsibility boundary while the mock receiver remains in use.
2. Strengthen Integration Suite error handling only where a demonstrated requirement exists.
3. Consider moving SAP-specific transformation into Integration Suite when a later architecture phase justifies it.
4. Replace the mock receiver with the live SAP S/4HANA Journal Entry service when the environment becomes available, then record live posting and reversal evidence.
5. Extend AV-03 only when additional verified implementation evidence warrants an update.
