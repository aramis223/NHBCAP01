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
| CD-03 Payment Management | In scope |
| CD-04 Financing & Credit Management | Conditional; core loan/credit lifecycle remains in core banking unless a SAP requirement is confirmed |
| CD-05 Treasury & Liquidity Management | In scope |

## 4. Signavio models

- `00 – NHB SAP Integration Overview`
- `01 – CD-01 Customer Management — NHB ↔ SAP`
- `02 – CD-03 Payment Management — NHB ↔ SAP`
- `03 – CD-05 Treasury & Liquidity Management — NHB ↔ SAP`

## 5. Confirmed SAP integration references

### CD-01 Customer Management

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

### CD-03 Payment Management

- Business object: Journal Entry
- API: Journal Entry - Post (Synchronous)
- Protocol: SOAP
- Communication scenario: `SAP_COM_0002` — Finance - Posting Integration
- Supported operation: `JOURNAL_ENTRY_CREATE_REQUEST_C`
- Relevant scope-item references: `J58` and `O58` — Accounting and Financial Close
- Deployment requirement: choose the applicable scope item and confirm service activation and authorization in the appliance.

### CD-05 Treasury & Liquidity Management

- Business object: Cash Flow
- API technical name: `CASHFLOW_IN`
- Supported operation: `CASH_FLOW_IN`
- Protocol: SOAP
- Communication scenario: `SAP_COM_0284` — Finance - Cash Management Inbound Integration
- Scope item: `34P` — Treasury Workstation Cash Integration
- Prerequisites: configure company-code value mapping and AIF monitoring in S/4HANA.

## 6. Test catalog

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

For the initial SAP integration, the CAP layer will process one accounting event at a time through a governed accounting-posting operation rather than allowing direct updates to the read-only accounting-event entity.

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
| `correlationId` | External/reference identifier for traceability |
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

On transport, SAP, parsing, or integration failure, the accounting event is updated to:

- `postingStatus = FAILED`
- `errorMessage = normalized failure information`

The current automated regression baseline verifies both normal journal-entry posting and journal-entry reversal.

Current verified test baseline:

- SAP accounting/integration regression: **43 passed, 0 failed**
- Murabaha servicing/accounting regression: **14 passed, 0 failed**

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
- correlation reference
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

 amount rejection
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

Current verified regression baseline:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

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

## 8. Regression rule

Every successful test becomes a repeatable regression scenario. Record the test date, S/4HANA environment, payload reference, returned identifier, result, and any configuration dependencies.

## 9. Sources

- [Business Partner (A2X) API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/3c916ef10fc240c9afc594b346ffaf77/85043858ea0f9244e10000000a4450e5.html)
- [Cash Flow API](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/d4eb54ea54944b04923af573b28a1e7d/80ea959a2ccf4bb29e88bf0225679283.html)