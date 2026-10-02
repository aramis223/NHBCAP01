# NHB SAP Test Catalog

## 1. Purpose

This catalog defines the SAP S/4HANA preparation, integration, and regression tests for NHBCAP01. Signavio diagrams are the visual process source; this file is the versioned technical and test reference.

## 2. Target environment

- SAP S/4HANA 2025 FPS01 appliance on SAP Cloud Appliance Library
- NHB CAP integration layer
- Connected system: Fiserv Banking Hub / Finxact; the Temenos mock is a legacy learning artifact and not part of the target architecture
- AWS account: paid plan with budget alerts configured

## 3. SAP scope

| NHB capability domain | SAP decision |
|---|---|
| CD-01 Customer Management | In scope |
| CD-02 Product Management | Conditional; reassess if SAP Product Master becomes required |
| CD-03 Deposit Management | In scope |
| CD-04 Financing & Credit Management | Conditional; core loan/credit lifecycle remains in core banking unless a SAP requirement is confirmed |
| CD-05 Treasury & Liquidity Management | In scope |

## 4. Signavio models

- `00 – NHB SAP Integration Overview`
- `01 – CD-01 Customer Management — NHB ↔ SAP`
- `02 – CD-03 Payment Management — NHB ↔ SAP`
- `03 – CD-05 Treasury & Liquidity Management — NHB ↔ SAP`

The Signavio titles above retain their recorded names. The approved capability baseline uses CD-03 Deposit Management; payment handoff remains an integration use case.

## 5. Confirmed SAP integration references

### 5.1 CD-01 Customer Management

- Business object: Business Partner
- API: Business Partner (A2X)
- Technical name: `API_BUSINESS_PARTNER`
- Protocol: OData V2
- Communication scenario: `SAP_COM_0008` — Business Partner, Customer and Supplier Integration
- Scope-item baseline: `1RO` — Integration of Core Master Data
- Catalog reference version: 1.7.0
- Fallback/reference version: 1.6.0
- Deployment requirement: confirm service metadata, authentication, and compatible API version in the deployed S/4HANA 2025 FPS01 system.

Initial organization Business Partner payload:

- `BusinessPartnerCategory`
- `BusinessPartnerGrouping`
- `OrganizationBPName1`
- Optional NHB search key: `SearchTerm1`

Start with the parent Business Partner entity. Add Address and Role associations only after the basic create test succeeds.

### 5.2 CD-03 Deposit Management — Payment Accounting Handoff

- Business object: Journal Entry
- API: Journal Entry - Post (Synchronous)
- Protocol: SOAP
- Communication scenario: `SAP_COM_0002` — Finance - Posting Integration
- Supported operation: `JOURNAL_ENTRY_CREATE_REQUEST_C`
- Relevant scope-item references: `J58` and `O58` — Accounting and Financial Close
- Deployment requirement: choose the applicable scope item and confirm service activation and authorization in the appliance.

### 5.3 CD-05 Treasury & Liquidity Management

- Business object: Cash Flow
- API technical name: `CASHFLOW_IN`
- Supported operation: `CASH_FLOW_IN`
- Protocol: SOAP
- Communication scenario: `SAP_COM_0284` — Finance - Cash Management Inbound Integration
- Scope item: `34P` — Treasury Workstation Cash Integration
- Prerequisites: configure company-code value mapping and AIF monitoring in S/4HANA.

## 6. Test catalog

The table defines target scenarios and expected results. Recorded verification status is described in sections 7 and 8; these expectations do not imply successful live SAP execution.

| ID | Test | Expected result |
|---|---|---|
| SAP-T01 | Create Business Partner | CAP creates an organization Business Partner through `API_BUSINESS_PARTNER`; SAP returns a new identifier and the record persists. |
| SAP-T02 | Read Business Partner | CAP retrieves the specified Business Partner and returns the expected master-data attributes. |
| SAP-T03 | Update Business Partner | CAP updates permitted Business Partner attributes and SAP persists the revised values. |
| SAP-T04 | Validate Payment Handoff | CAP validates, enriches, and maps valid payment instructions; invalid inputs return meaningful validation errors and a correlation ID. |
| SAP-T05 | Post Journal Entry | CAP sends `JOURNAL_ENTRY_CREATE_REQUEST_C`; SAP posts the accounting document and returns its number and status. |
| SAP-T05R | Reverse Journal Entry | CAP submits a reversal for a previously posted accounting document using the SAP synchronous Journal Entry service; SAP returns the resulting accounting document identity and NHBCAP01 records the reversal event as `POSTED`. |
| SAP-T06 | Update Cash Position and Liquidity Forecast | CAP sends `CASH_FLOW_IN`; SAP creates the external cash flow and reflects it in cash-position and liquidity-forecast reporting. |

## 7. Murabaha Accounting Handoff Baseline

NHBCAP01 uses `MurabahaAccountingEvent` as the NHB-owned accounting handoff boundary between Murabaha servicing and SAP S/4HANA.

The first implemented accounting-event types are:

- `PAYMENT_RECEIVED`
- `PAYMENT_REVERSED`

New accounting events are persisted with `postingStatus = PENDING`.

`PENDING` means that NHBCAP01 has recorded an accounting obligation that has not yet been posted to SAP S/4HANA.

For the initial SAP integration, the CAP layer processes one accounting event at a time through a governed accounting-posting operation rather than allowing direct updates to the read-only accounting-event entity.

### 7.1 Initial Posting Lifecycle

The initial posting lifecycle is:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        |
        v
Validate accounting event
        |
        v
Resolve accounting configuration
        |
        v
Map NHB event to SAP Journal Entry request
        |
        v
JOURNAL_ENTRY_CREATE_REQUEST_C
        |
        +-- success
        |      |
        |      +-- postingStatus = POSTED
        |      +-- externalAccountingDocumentId = SAP document reference
        |
        +-- failure
               |
               +-- postingStatus = FAILED
               +-- errorMessage = normalized integration error
```

### 7.2 NHB-to-SAP Mapping Contract

The initial NHB-to-SAP mapping contract is:

| NHB accounting-event field | SAP integration purpose |
| --- | --- |
| `eventType` | Selects the accounting-posting scenario |
| `eventDate` | Candidate accounting/document date |
| `amount` | Journal-entry amount |
| `currency` | Transaction currency |
| `ID` | Event UUID used to derive the SAP-safe 16-character `DocumentReferenceID` |
| `correlationId` | Full business correlation identifier retained for traceability and the `X-Correlation-ID` header |
| `payment_ID` | NHB payment traceability |
| `financing_ID` | NHB financing traceability |
| `installment_ID` | NHB installment traceability |
| `externalAccountingDocumentId` | Stores the SAP document reference after successful posting |
| `postingStatus` | Tracks NHB-side accounting-posting state |
| `errorMessage` | Stores normalized posting failure information |

### 7.3 Accounting Configuration Boundary

The following accounting values are intentionally not hard-coded into the Murabaha domain model and must be resolved through SAP configuration, NHB accounting configuration, or an approved mapping decision:

- company code
- document type
- business transaction type where required
- debit G/L account
- credit G/L account
- profit center or cost center where required
- ledger or accounting principle where required
- tax treatment where applicable
- assignment and reference-field formatting

The prototype must not invent production accounting policy. Debit and credit account determination remains subject to formal accounting, finance, Sharia, and SAP configuration decisions.

### 7.4 Payment Reversal Accounting Treatment

`PAYMENT_REVERSED` is implemented through a dedicated SAP journal-entry reversal path.

NHBCAP01 does not treat a reversal as an unrelated debit/credit posting. Instead, the reversal is anchored to the SAP accounting document created by the corresponding `PAYMENT_RECEIVED` event.

For a successful original posting, NHBCAP01 persists the SAP-native accounting-document identity:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

The first three fields preserve the SAP-native identity required by the reversal contract. `externalAccountingDocumentId` remains the NHB normalized composite reference used for traceability.

Before a `PAYMENT_REVERSED` accounting event can be submitted, NHBCAP01 verifies that:

1. the corresponding `PAYMENT_RECEIVED` accounting event exists;
2. the original event has `postingStatus = POSTED`;
3. the original SAP accounting document number is available;
4. the original SAP company code is available;
5. the original SAP fiscal year is available; and
6. the original SAP company code matches the configured reversal company code.

The reversal reference is derived from the SAP-native identity of the original posting:

```text
AccountingDocument
        +
CompanyCode
        +
FiscalYear
        │
        ▼
ReversalReferenceDocument
1900000123 + NHB1 + 2026
        │
        ▼
1900000123NHB12026
```
The dedicated reversal request uses:
- ReversalReason
- ReversalReferenceDocument
- ReversalDate
- CompanyCode
- AccountingDocumentType
- BusinessTransactionType
- CreatedByUser
- document date
- posting date

The reversal request intentionally does not contain normal debit/credit <Item> elements.
The operational reversal reason stored by NHBCAP01 remains separate from the SAP reversal-reason code. The NHB reason may contain business explanation text, while the SAP ReversalReason value is runtime configuration and is limited by the SAP contract.

The reversal path uses the same synchronous SAP transport and response parser as normal journal-entry posting, but has a separate mapping and SOAP-building contract.

The current reversal implementation is application-side verified against the published SAP Journal Entry contract and automated regression tests. Live posting against an SAP S/4HANA system remains pending because no runnable SAP S/4HANA appliance is currently available.

### 7.5 Governed CAP Accounting Operation

The accounting-event entity remains read-only to service consumers. Accounting posting is triggered through the explicit CAP action:

```cds
action postAccountingEvent(
    accountingEventId : UUID
) returns MurabahaAccountingEvent;
```
The implemented operation is responsible for:

- loading the specified accounting event
- verifying that the event exists
- verifying that `postingStatus` is `PENDING`
- validating the event data required for SAP posting
- resolving the applicable NHB accounting configuration
- selecting the normal-posting or reversal path according to `eventType`
- mapping the NHB event to the applicable normalized SAP model
- building the applicable synchronous SAP Journal Entry SOAP request
- invoking the configured SAP transport
- parsing the SAP synchronous confirmation
- recording the resulting SAP accounting-document identity on success
- recording a normalized error on posting failure
- preventing uncontrolled duplicate submission of a non-pending event

The governed CAP accounting operation now supports two accounting-event paths.

Normal payment posting:

```text
PAYMENT_RECEIVED
        │
        ▼
Resolve normal accounting configuration
        │
        ▼
Map NHB accounting event
        │
        ▼
Build SAP Journal Entry request
        │
        ▼
Debit / credit Item elements
        │
        ▼
SAP synchronous confirmation
```

Payment reversal:

```text
PAYMENT_REVERSED
        │
        ▼
Load original PAYMENT_RECEIVED event
        │
        ▼
Verify original event is POSTED
        │
        ▼
Resolve original SAP document identity
        │
        ▼
Resolve reversal configuration
        │
        ▼
Build dedicated SAP reversal request
        │
        ▼
ReversalReason
ReversalReferenceDocument
ReversalDate
        │
        ▼
SAP synchronous confirmation
```

The SAP-specific implementation is separated under:

```text
srv/sap/
├── accounting.js
├── config.js
├── journal-entry-soap.js
├── journal-entry-reversal-soap.js
├── journal-entry-response.js
└── transport.js
```

The responsibilities are separated as follows:

- `config.js` loads normal-posting and reversal configuration from runtime configuration.
- `accounting.js` validates NHB accounting events, maps normal and reversal events to their respective normalized SAP models, and orchestrates both posting flows.
- `journal-entry-soap.js` builds the normal synchronous SAP Journal Entry SOAP request.
- `journal-entry-reversal-soap.js` builds the dedicated SAP journal-entry reversal request and deliberately excludes normal debit/credit posting items.
- `transport.js` provides the shared HTTP transport boundary.
- `journal-entry-response.js` parses the SAP synchronous confirmation and returns the SAP accounting document, company code, fiscal year, processing result, severity, log notes, and normalized external accounting-document reference.
- Cross-cutting outbound timeout handling is provided through `srv/integration/http.js`.

The shared timeout baseline provides:

- a default outbound timeout of 10,000 milliseconds
- runtime override through `NHB_HTTP_TIMEOUT_MS`
- validation that the configured timeout is a positive integer
- `AbortController`-based timeout handling for native `fetch` transports
- normalized timeout failures using `OutboundTimeoutError`
- stable error code `NHB_HTTP_TIMEOUT`

Fiserv OAuth, Account Details, Get Party List, and Get Party use the shared timeout-aware HTTP boundary.

SAP transport applies the same timeout policy through:

- `fetchWithTimeout()` for direct/basic transport
- the SAP Cloud SDK request `timeout` configuration for Destination-based transport

Automatic retry is deliberately not part of this baseline.

In particular, SAP accounting posting and reversal are not automatically retried because a transport timeout does not prove that the remote financial operation was not processed.

The transport supports two execution modes:

```text
Local / test
        │
        ▼
Explicit SAP endpoint
        │
        ▼
Basic Authentication
```

and:

```text
SAP BTP Cloud Foundry
        │
        ▼
SAP BTP Destination
        │
        ▼
SAP Cloud SDK HTTP client
```

On successful normal posting or reversal, NHBCAP01 records:

- `postingStatus = POSTED`
- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`
- `errorMessage = null`

On transport, SAP, parsing, or integration failure after the external posting attempt begins, the accounting event is updated to:

- `postingStatus = FAILED`
- `errorMessage = normalized failure information`

The current automated regression baseline verifies both normal journal-entry posting and journal-entry reversal.

Current verified test baseline:

- SAP accounting/integration regression: **44 passed, 0 failed**
- Murabaha servicing regression: **15 passed, 0 failed**
- Murabaha accounting boundary regression: **4 passed, 0 failed**

These tests verify the NHBCAP01 application-side integration contract and behavior. They do not constitute live SAP S/4HANA posting verification.

The CAP operation therefore remains the governed boundary between NHB-owned Murabaha servicing and the external SAP accounting platform.

---

### 7.6 Posting Status Model

The initial accounting-posting lifecycle uses three statuses:

- `PENDING`
- `POSTED`
- `FAILED`

`PENDING` indicates that NHBCAP01 has created an accounting obligation that has not yet been successfully posted to SAP S/4HANA.

For a valid `PAYMENT_RECEIVED` accounting event, `postAccountingEvent` attempts the SAP posting flow.

A confirmed SAP accounting document produces:

```text
PENDING
   │
   ▼
POSTED
```

and NHBCAP01 stores the resulting SAP accounting-document reference in:

```text
externalAccountingDocumentId
```

The current normalized external identifier combines:

```text
CompanyCode-FiscalYear-AccountingDocument
```

For example:

```text
NHB1-2026-1900000123
```

A successful HTTP response alone is not treated as a successful accounting posting.

NHBCAP01 parses the synchronous SAP response and requires a valid:

- accounting document
- company code
- fiscal year

before changing the accounting event to `POSTED`.

An SAP confirmation containing:

```text
AccountingDocument = 0000000000
```

is treated as a failed business posting rather than a successful posting.

If transport, SOAP processing, SAP response validation, or SAP business posting fails after the posting attempt begins, NHBCAP01 records:

```text
postingStatus = FAILED
errorMessage  = normalized failure information
```

The failed accounting event is returned as a committed audit state.

This avoids updating the event to `FAILED` and then rejecting the same CAP request, which could cause the request transaction to roll back the failure evidence.

If required SAP accounting configuration is unavailable before external posting begins, the event is not falsely marked as a failed SAP posting. It remains `PENDING`.

`PAYMENT_REVERSED` is processed through the dedicated SAP reversal path once the corresponding `PAYMENT_RECEIVED` event has been successfully posted and the original SAP document identity is available.

The initial prototype deliberately does not introduce additional operational states such as:

- `RETRYING`
- `QUEUED`
- `IN_PROGRESS`
- `CANCELLED`

Retry orchestration, asynchronous queues, recovery workflows, and operational monitoring should be introduced only when demonstrated integration requirements justify them.

---

### 7.7 SAP Accounting Integration Verification

The NHBCAP01 SAP accounting-posting boundary is now implemented and verified through isolated SAP-layer tests and CAP-level regression tests.

The implemented flow is:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        │
        ▼
Validate accounting event
        │
        ▼
Resolve NHB accounting configuration
        │
        ▼
Map to normalized journal-entry candidate
        │
        ▼
Build SAP synchronous SOAP request
        │
        ▼
Invoke SAP transport
        │
        ▼
Parse SAP synchronous confirmation
        │
        ├── valid accounting document
        │       │
        │       ▼
        │     POSTED
        │       +
        │ externalAccountingDocumentId
        │
        └── posting / transport / response failure
                │
                ▼
              FAILED
                +
           errorMessage
```

The normalized journal-entry model currently includes:

- event type
- company code
- accounting document type
- business transaction type
- created-by user
- document date
- posting date
- transaction currency
- amount
- debit G/L account
- credit G/L account
- SAP-safe document reference derived from the accounting-event UUID
- full business correlation identifier for traceability
- NHB accounting-event identifier
- payment identifier
- financing identifier
- installment identifier

The synchronous SOAP request uses the SAP Journal Entry request hierarchy beginning with:

```text
JournalEntryBulkCreateRequest
```

and contains the nested:

```text
JournalEntryCreateRequest
```

together with:

- outer message header
- journal-entry request message header
- creation timestamps
- journal-entry data
- debit item
- credit item

The current request baseline uses:

```text
OriginalReferenceDocumentType = BKPFF
```

and the configured business transaction type, currently tested with:

```text
RFBU
```

Accounting configuration is deliberately externalized from the Murabaha domain model.

The current required configuration includes:

- company code
- document type
- business transaction type
- created-by user
- debit G/L account
- credit G/L account

These values remain prototype configuration and must not be interpreted as approved production accounting policy.

The verified automated coverage includes:

- invalid accounting amount rejection
- SAP configuration loading from environment variables
- missing SAP configuration detection
- normal journal-entry SOAP construction
- dedicated reversal SOAP construction
- exclusion of `PAYMENT_REVERSED` from the normal debit/credit posting builder
- exclusion of normal debit/credit `<Item>` elements from the reversal request
- SAP document-reference length validation
- SAP field-length validation
- currency-format validation
- reversal-reason length validation
- reversal-reference length validation
- SOAP message-context validation
- XML escaping
- Basic Authentication transport
- SAP BTP Destination transport
- dependency-injected SAP transport testing
- shared outbound HTTP timeout configuration
- native-fetch timeout and abort handling
- SAP Destination request timeout propagation
- controlled `NHB_HTTP_TIMEOUT` error classification
- preservation of no-automatic-retry behavior for financial posting
- successful SAP confirmation parsing
- SAP business-failure parsing
- SOAP Fault handling
- incomplete SAP confirmation rejection
- persistence of SAP accounting document number
- persistence of SAP company code
- persistence of SAP fiscal year
- persistence of the normalized external accounting-document reference
- retrieval of the original `PAYMENT_RECEIVED` accounting event for reversal
- verification that the original accounting event is `POSTED`
- rejection of reversal when the original SAP document identity is incomplete
- rejection of reversal when the original SAP company code does not match the configured reversal company code
- CAP-level `PENDING → FAILED` transition
- persistence of `errorMessage`
- CAP-level `PENDING → POSTED` transition for normal posting
- CAP-level `PENDING → POSTED` transition for reversal posting

The CAP-level regression therefore verifies the principal posting lifecycle for both normal accounting events and reversal accounting events:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        │
        ▼
Select posting path
        │
        ├── PAYMENT_RECEIVED
        │        │
        │        ▼
        │   Normal Journal Entry
        │
        └── PAYMENT_REVERSED
                 │
                 ▼
            SAP Reversal
                 │
                 ▼
        SAP synchronous response
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
     success            failure
        │                 │
        ▼                 ▼
      POSTED            FAILED
        │                 │
        ▼                 ▼
SAP document        errorMessage
identity
```

The current integration has therefore progressed beyond request preparation alone.

The application-side SAP integration contract is now verified through automated regression tests using controlled SAP responses.

The outbound timeout baseline has additionally been verified through:

- default timeout resolution to 10,000 milliseconds
- rejection of invalid `NHB_HTTP_TIMEOUT_MS` configuration
- controlled local timeout producing `OutboundTimeoutError` / `NHB_HTTP_TIMEOUT`
- successful Fiserv OAuth execution using the timeout-aware transport
- forced 1 millisecond Fiserv OAuth timeout producing the normalized timeout error
- successful Fiserv Get Party execution after timeout migration
- dependency-injected SAP Destination verification confirming `timeout = 10000`
- deployed Murabaha servicing regression completing all 15 HTTP checks successfully after the timeout changes

Current verified regression baseline:

- SAP accounting/integration suite: **44 passed, 0 failed**
- Murabaha servicing regression: **15 passed, 0 failed**
- Murabaha accounting boundary regression: **4 passed, 0 failed**

The successful normal posting and reversal paths remain externally unverified against a live SAP S/4HANA system because no runnable SAP S/4HANA laboratory appliance is currently available.

Live SAP execution therefore remains the external verification step for both:

- `SAP-T05` — Post Journal Entry
- `SAP-T05R` — Reverse Journal Entry

`SAP-T04` is represented by the implemented validation, accounting-configuration, mapping, SOAP-request construction, and governed CAP accounting-operation layers.

`SAP-T05` will be considered externally verified when:

- NHBCAP01 sends the generated normal Journal Entry request to a live SAP S/4HANA service
- SAP creates the accounting document
- SAP returns the accounting-document identity
- NHBCAP01 records `postingStatus = POSTED`
- `externalAccountingDocument` contains the returned SAP accounting document number
- `externalCompanyCode` contains the returned SAP company code
- `externalFiscalYear` contains the returned SAP fiscal year
- `externalAccountingDocumentId` contains the normalized SAP reference
- the NHB `correlationId` remains available for end-to-end traceability

`SAP-T05R` will be considered externally verified when:

- the corresponding `PAYMENT_RECEIVED` accounting event has already been successfully posted to SAP
- NHBCAP01 retains the original SAP accounting document number, company code, and fiscal year
- NHBCAP01 derives the reversal reference from the original SAP-native document identity
- NHBCAP01 sends the dedicated reversal request to the live SAP S/4HANA service
- SAP accepts the configured reversal reason
- SAP processes the reversal against the original accounting document
- SAP returns the resulting accounting-document identity
- NHBCAP01 records the reversal accounting event with `postingStatus = POSTED`
- the original payment event and reversal event remain traceable through their NHB payment and accounting-event relationships

Every successful live SAP accounting test should then become a repeatable regression scenario in accordance with the catalog regression rule.

### 7.8 Pre-configuration Deployed CAP Accounting Boundary Verification

Before SAP accounting runtime configuration was enabled for the mock-mediated baseline in section 8, the deployed Cloud Foundry runtime was additionally verified for the governed `postAccountingEvent` boundary.

Verified deployed behavior:

- `postAccountingEvent` is exposed in the deployed OData `$metadata`
- XSUAA-authenticated requests reach the deployed CAP action
- a valid `PENDING` `MurabahaAccountingEvent` can be resolved by identifier
- missing SAP accounting runtime configuration is detected before external posting begins
- the request returns HTTP 500 for the missing required accounting configuration
- the accounting event remains `postingStatus = PENDING`
- `errorMessage` remains `null`
- `externalAccountingDocument` remains `null`
- `externalAccountingDocumentId` remains `null`
- `externalCompanyCode` remains `null`
- `externalFiscalYear` remains `null`

This verifies that NHBCAP01 does not falsely mark an accounting event as `FAILED` or `POSTED` when SAP accounting configuration is unavailable before the external posting attempt begins.

The deployed verification does not constitute live SAP posting evidence. `SAP-T05` and `SAP-T05R` remain pending successful execution against a runnable SAP S/4HANA system with valid accounting configuration and master data.


## 8. SAP Integration Suite End-to-End Verification

### Scope

This section records the verified SAP Integration Suite mediation baseline for NHBCAP01.

The tested runtime path is:

NHBCAP01
→ SAP Destination Service
→ SAP Integration Suite
→ X-Correlation-ID propagation
→ NHB_CorrelationId MPL custom property
→ HTTP receiver
→ mock SAP S/4HANA Journal Entry endpoint
→ SAP-style confirmation
→ NHBCAP01 response parsing
→ MurabahaAccountingEvent persistence

The current target is a controlled mock receiver rather than a live SAP S/4HANA system.

---

### 8.1. Integration Suite Smoke Test

#### Purpose

Verify that the deployed Integration Suite iFlow accepts an authenticated SOAP/XML request and successfully forwards it to the configured receiver.

#### Runtime endpoint

https://a79b9755trial.it-cpitrial05-rt.cfapps.us10-001.hana.ondemand.com/http/nhb/s4/journal-entry

#### Result

PASS

Verified response:

HTTP 200

AccountingDocument:
1900000001

CompanyCode:
1000

FiscalYear:
2026

BusinessDocumentProcessingResultCode:
SUCCESS

#### Evidence

The request was sent from BAS using a valid Integration Suite OAuth bearer token.

The response was returned through Integration Suite from the mock S/4HANA receiver.

#### Conclusion

The following path is verified:

BAS
→ Integration Suite
→ mock S/4HANA
→ Integration Suite
→ BAS

---

### 8.2. NHBCAP01 SOAP Builder Through Integration Suite

#### Purpose

Verify that the real NHBCAP01 journal-entry SOAP builder produces a payload accepted by the Integration Suite mediation flow.

#### Source

srv/sap/journal-entry-soap.js

#### Test payload

A journal-entry SOAP request was generated using:

buildJournalEntrySoapRequest(...)

The generated payload was written to:

/tmp/nhb-journal-entry.xml

Verified size:

2094 bytes

#### Result

PASS

HTTP 200

Returned confirmation:

AccountingDocument:
1900000001

CompanyCode:
1000

FiscalYear:
2026

BusinessDocumentProcessingResultCode:
SUCCESS

#### Conclusion

The following path is verified:

NHBCAP01 SOAP builder
→ Integration Suite
→ mock S/4HANA
→ SAP-style confirmation

---

### 8.3. SAP DocumentReferenceID Constraint

#### Issue

A real Murabaha accounting event used a correlation identifier longer than the SAP SOAP contract allows.

Example:

PAY-SVC-002-20260925185040-25064

The journal-entry builder enforces:

DocumentReferenceID maximum length = 16

The original mapping used:

accountingEvent.correlationId

This caused:

Journal entry field reference exceeds SAP maximum length 16

#### Resolution

A deterministic SAP-safe reference is now derived from the accounting event UUID.

Rule:

remove hyphens from accountingEvent.ID
→ take the first 16 characters

Example:

Accounting Event ID:

243909b6-5b78-4a88-ae32-854abced75de

SAP DocumentReferenceID:

243909b65b784a88

The full correlationId remains persisted in NHBCAP01.

#### Regression result

PASS

The SAP accounting regression suite was updated to reflect the new outbound reference contract.

---

### 8.4. SAP Accounting Regression Baseline

#### Test command

```bash
node --test \
  sap-journal-entry-soap.test.js \
  sap-journal-entry-response.test.js \
  sap-journal-entry-reversal-soap.test.js \
  sap-transport.test.js \
  sap-accounting.test.js
```

#### Result

44 tests

44 passed

0 failed

0 skipped

0 cancelled

#### Coverage

The regression suite verifies:

- accounting configuration validation
- SAP-safe document reference generation
- PAYMENT_RECEIVED mapping
- PAYMENT_REVERSED mapping
- unsupported accounting-event rejection
- invalid accounting amount rejection
- environment configuration loading
- journal-entry orchestration
- reversal configuration
- original SAP document identity validation
- reversal company-code validation
- journal-entry response parsing
- SAP business-failure handling
- SOAP fault handling
- incomplete response handling
- journal-entry reversal validation
- SAP field-length validation
- currency validation
- journal-entry SOAP construction
- XML escaping
- Basic authorization
- destination transport configuration
- Basic HTTP transport
- SAP Destination transport
- HTTP error handling

#### Conclusion

PASS

The SAP accounting implementation remained regression-clean after introducing the SAP-safe document reference.

---

### 8.5. Destination Service Configuration Verification

#### Destination

NHB-INTEGRATION-SUITE-S4

#### Authentication

OAuth2ClientCredentials

#### Target

SAP Integration Suite runtime endpoint

#### Result

PASS

The Destination service was successfully resolved by the deployed NHBCAP01 application.

#### Conclusion

The following runtime abstraction is verified:

NHBCAP01
→ destination name
→ SAP Destination Service
→ OAuth2 Client Credentials
→ Integration Suite

---

### 8.6. Deployed PAYMENT_RECEIVED End-to-End Test

#### Purpose

Verify that a real persisted MurabahaAccountingEvent can be posted from the deployed NHBCAP01 application through the complete Integration Suite path.

#### Event

Event type:

PAYMENT_RECEIVED

Accounting Event ID:

c41bf8cb-8095-46a5-8b27-db5ce293b9b8

Amount:

USD 600.00

#### Invocation

The deployed CAP action was called:

postAccountingEvent

#### Result

PASS

Returned accounting event:

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

#### Conclusion

The following full application path is verified:

deployed NHBCAP01
→ postAccountingEvent
→ accounting.js
→ transport.js
→ SAP Destination Service
→ SAP Integration Suite
→ mock S/4HANA
→ SAP-style confirmation
→ SAP response parser
→ HANA persistence

---

### 8.7. Original Payment Posting Before Reversal

#### Purpose

Establish the SAP document identity required by the reversal path.

#### Event

Accounting Event ID:

7b9174b1-427c-48d7-bca1-808e00300d70

Event type:

PAYMENT_RECEIVED

Amount:

USD 400.00

Payment ID:

acc95f60-26b2-4ebf-8467-688ee7cee52d

#### Result

PASS

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

#### Conclusion

The original SAP accounting identity was persisted successfully and made available to the reversal implementation.

---

### 8.8. PAYMENT_REVERSED End-to-End Test

#### Purpose

Verify that a real PAYMENT_REVERSED accounting event can be posted through the same Integration Suite mediation architecture.

#### Event

Accounting Event ID:

2accd0ac-298f-47cc-bff7-c0924a19f25b

Event type:

PAYMENT_REVERSED

Amount:

USD 400.00

Payment ID:

acc95f60-26b2-4ebf-8467-688ee7cee52d

#### Preconditions

The corresponding PAYMENT_RECEIVED event was already:

postingStatus:
POSTED

and contained:

externalAccountingDocument:
1900000001

externalCompanyCode:
1000

externalFiscalYear:
2026

#### Result

PASS

Returned reversal event:

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

#### Conclusion

The reversal path is verified through:

NHBCAP01
→ SAP Destination Service
→ SAP Integration Suite
→ mock S/4HANA
→ SAP-style reversal confirmation
→ NHBCAP01 persistence

---

### 8.9. Authentication Failure Test

#### Scenario

A NHBCAP01 XSUAA token was accidentally used against the Integration Suite runtime endpoint.

#### Result

PASS — expected failure observed

HTTP status:

401 Unauthorized

The Integration Suite runtime rejected the token because its JWT audience belonged to the NHBCAP01 XSUAA client rather than the Integration Suite runtime client.

#### Conclusion

The architecture correctly enforces separate OAuth security contexts for:

- NHBCAP01 inbound authentication
- Integration Suite runtime authentication

---

### 8.10. Receiver Availability Failure Test

#### Scenario

The mock S/4HANA Cloud Foundry application was stopped.

#### Result

PASS — expected failure observed

Integration Suite returned:

500 Internal Server Error

The underlying receiver error was:

404 Not Found

Requested route:

nhb-mock-s4.cfapps.us10-001.hana.ondemand.com

#### Recovery

The receiver application was restarted:

cf start nhb-mock-s4

After restart, the same Integration Suite request returned:

HTTP 200

#### Conclusion

Integration Suite correctly surfaced downstream receiver unavailability.

---

### 8.11. Local Destination Binding Failure

#### Scenario

The SAP destination-based transport was executed directly from a BAS-local Node process.

#### Result

PASS — expected limitation observed

Error:

Could not find service binding of type 'destination'

#### Cause

The local Node process did not inherit the Cloud Foundry Destination service binding.

#### Resolution

The destination-based transport was tested through the deployed NHBCAP01-srv application, where the Destination service is bound.

#### Conclusion

The verified application-level test environment is Cloud Foundry rather than an unbound local BAS process.

---

### 8.12. Missing SAP Accounting Configuration Failure

#### Scenario

The deployed postAccountingEvent action was invoked before SAP_ACCOUNTING_* environment variables were configured.

#### Result

PASS — expected failure observed

Error:

SAP accounting configuration is missing:
companyCode,
documentType,
businessTransactionType,
createdByUser,
debitAccount,
creditAccount

#### Resolution

The following variables were configured:

SAP_ACCOUNTING_COMPANY_CODE=1000

SAP_ACCOUNTING_DOCUMENT_TYPE=SA

SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE=RFBU

SAP_ACCOUNTING_CREATED_BY_USER=NHBCAP01

SAP_ACCOUNTING_DEBIT_ACCOUNT=110000

SAP_ACCOUNTING_CREDIT_ACCOUNT=410000

SAP_ACCOUNTING_REVERSAL_REASON=01

#### Conclusion

Accounting execution correctly fails before outbound transport when mandatory business configuration is incomplete.

---

### 8.13. HANA Connection Timeout Observation

#### Scenario

Database-backed OData requests temporarily failed.

#### Result

Observed failure:

500 Internal Server Error

Runtime log:

TimeoutError: ResourceRequest timed out

#### Validation

The failure affected multiple database-backed entities and was therefore not specific to MurabahaAccountingEvent.

After database connectivity recovered, the same request returned:

HTTP 200

#### Conclusion

The failure was isolated to HANA/database availability rather than Integration Suite.

---

### 8.14. Deployment Lifecycle Verification

#### Scenario

The source code was modified locally and the Cloud Foundry application was restarted.

#### Observation

The old behavior remained active.

#### Cause

cf restart does not upload changed source code.

#### Resolution

A new MTA build and deployment were performed:

mbt build

cf deploy mta_archives/*.mtar -f

#### Verification

The Cloud Foundry application showed a new:

last uploaded

timestamp.

#### Conclusion

Source changes require a real deployment rather than only an application restart.

---

### 8.15. Correlation and HTTP Receiver Verification

#### Purpose

Verify end-to-end operational traceability for SAP accounting messages and confirm the Phase 1 HTTP receiver design.

#### Correlation source

The originating NHBCAP01 accounting event contains:

correlationId

The accounting layer passes this value into the SAP transport request context.

The transport propagates it as:

X-Correlation-ID

#### Integration Suite configuration

The iFlow Runtime Configuration permits:

X-Correlation-ID

as an allowed header.

A Groovy step reads the header and creates the searchable Message Processing Log custom property:

NHB_CorrelationId

Repository source:

srv/integration/setNhbCorrelationMpl.groovy

#### Verified test fixture

A fresh accounting event was generated using:

test/integration-suite-accounting-fixture.sh

Verified identifiers included:

ACCOUNTING_EVENT_ID:
e7a31f2d-98b9-432a-ba09-62169b222308

CORRELATION_ID:
PAY-IS-20260930234523-55694

Initial status:

PENDING

#### Integration Suite result

PASS

Verified Message Processing Log evidence:

OverallStatus:
COMPLETED

IntermediateError:
false

CustomHeaderProperties:

NHB_CorrelationId =
PAY-IS-20260930234523-55694

#### Receiver result

The iFlow used an HTTP receiver to forward the SAP SOAP/XML payload unchanged to:

https://nhb-mock-s4.cfapps.us10-001.hana.ondemand.com/journal-entry

This preserves the current Phase 1 responsibility boundary:

NHBCAP01 owns SOAP request construction and SAP response parsing.

Integration Suite owns mediation, routing, monitoring, endpoint abstraction, and correlation observability.

#### CAP persistence result

The same accounting event was verified after Integration Suite processing.

Result:

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

The same NHB correlation identifier remained persisted on the accounting event.

#### Conclusion

PASS

The following observability path is verified:

MurabahaAccountingEvent.correlationId
→ accounting.js
→ transport.js
→ X-Correlation-ID
→ SAP Destination Service
→ SAP Integration Suite
→ Allowed Header
→ Groovy MPL enrichment
→ NHB_CorrelationId
→ HTTP receiver
→ mock S/4HANA
→ SAP-style response
→ NHBCAP01 response parser
→ HANA persistence

---

### 8.16. Integration Suite Verification Summary

The following verification stages are complete:

PASS — Integration Suite runtime authentication

PASS — HTTPS sender endpoint

PASS — HTTP receiver routing

PASS — X-Correlation-ID propagation

PASS — NHB_CorrelationId MPL custom property

PASS — renewable accounting-event fixture

PASS — mock S/4HANA connectivity

PASS — manual SOAP smoke test

PASS — real NHBCAP01 SOAP builder through Integration Suite

PASS — SAP Destination Service resolution

PASS — OAuth2 Client Credentials through Destination Service

PASS — SAP-safe DocumentReferenceID mapping

PASS — 44/44 SAP regression suite

PASS — deployed PAYMENT_RECEIVED posting

PASS — SAP document identity persistence

PASS — deployed PAYMENT_REVERSED posting

PASS — expected authentication failure handling

PASS — expected receiver failure handling

PASS — expected missing-configuration handling

PASS — deployment lifecycle verification

---

### 8.17. Current Test Baseline

As of 30 September 2026:

SAP accounting regression:

44 PASS
0 FAIL

Integration Suite smoke test:

PASS

NHBCAP01 SOAP builder through Integration Suite:

PASS

Deployed PAYMENT_RECEIVED through Integration Suite:

PASS

Deployed PAYMENT_REVERSED through Integration Suite:

PASS

Current receiver:

controlled mock SAP S/4HANA endpoint

Live SAP S/4HANA Journal Entry execution:

PENDING

The current baseline demonstrates a complete application-level mediation path through SAP Integration Suite while preserving a clear distinction between verified mock execution and pending live SAP execution.

AV-03 — NHBCAP01 Architecture-to-Implementation Realization is completed as v1.0. The first CAP internals deep-understanding pass is completed, and portfolio packaging and documentation polish are now the current phase.

## 9. Regression rule

Every successful test becomes a repeatable regression scenario. Record the test date, receiver environment (controlled mock or live S/4HANA), payload reference, returned identifier, result, and any configuration dependencies.

## 10. Sources

- [Business Partner (A2X) API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/3c916ef10fc240c9afc594b346ffaf77/85043858ea0f9244e10000000a4450e5.html)
- [Cash Flow API](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/d4eb54ea54944b04923af573b28a1e7d/80ea959a2ccf4bb29e88bf0225679283.html)