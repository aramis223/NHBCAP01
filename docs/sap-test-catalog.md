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

For `PAYMENT_REVERSED`, the target behavior is to reverse or otherwise correct the accounting effect of the corresponding `PAYMENT_RECEIVED` event.

The implementation must preserve traceability between the original payment event and the reversal event.

The specific SAP treatment has not yet been selected. Depending on the capabilities exposed by the deployed SAP S/4HANA service, the implementation may use either:

- a supported SAP accounting-document reversal operation, or
- a reversing journal entry.

The selected approach must be confirmed against the supported SAP S/4HANA service behavior before implementation. NHBCAP01 must not assume that a reversal is equivalent to an unrelated new accounting posting.

### 7.5 Governed CAP Accounting Operation

The accounting-event entity remains read-only to service consumers. Accounting posting must therefore be triggered through an explicit CAP business operation rather than by permitting direct updates to `MurabahaAccountingEvent`.

The initial operation is conceptually equivalent to:

```cds
action postAccountingEvent(
    accountingEventId : UUID
) returns MurabahaAccountingEvent;
```

The operation is responsible for:

- loading the specified accounting event
- verifying that the event exists
- verifying that `postingStatus` is `PENDING`
- validating the event data required for SAP posting
- resolving the applicable accounting configuration
- mapping the NHB event to the SAP journal-entry request
- invoking the supported SAP S/4HANA accounting service
- recording the resulting SAP accounting-document reference on success
- recording a normalized error on failure
- preventing uncontrolled duplicate posting of an already completed event

The CAP operation therefore acts as the governed boundary between NHB-owned Murabaha servicing and the external SAP accounting platform.

### 7.6 Posting Status Model

The initial accounting-posting lifecycle uses three statuses:

- `PENDING`
- `POSTED`
- `FAILED`

`PENDING` indicates that NHBCAP01 has created an accounting obligation that has not yet been successfully posted to SAP S/4HANA.

`POSTED` indicates that the external SAP accounting operation completed successfully and NHBCAP01 recorded the resulting accounting-document reference.

`FAILED` indicates that an accounting-posting attempt did not complete successfully and that a normalized integration error was recorded for investigation.

The initial prototype deliberately does not introduce additional operational states such as `RETRYING`, `QUEUED`, `IN_PROGRESS`, or `CANCELLED`.

Retry orchestration, asynchronous queues, recovery workflows, and operational monitoring should be introduced only when demonstrated integration requirements justify them.

### 7.7 Initial SAP Test Scope

The first SAP accounting integration increment will focus on the existing SAP test-catalog scenarios:

- `SAP-T04` — Validate Payment Handoff
- `SAP-T05` — Post Journal Entry

`SAP-T04` verifies the NHB-side preparation of the accounting request before any external posting is attempted. The test should confirm that NHBCAP01 can:

- load a `PENDING` accounting event
- validate the required event data
- reject incomplete or inconsistent accounting events
- resolve the required accounting configuration
- preserve the NHB correlation identifier
- produce a complete SAP journal-entry request candidate

`SAP-T05` verifies the actual SAP S/4HANA posting step through `JOURNAL_ENTRY_CREATE_REQUEST_C`.

A successful test should confirm that:

- NHBCAP01 sends the mapped accounting request to SAP S/4HANA
- SAP accepts and posts the journal entry
- SAP returns an accounting-document identifier or equivalent posting reference
- NHBCAP01 changes the accounting event from `PENDING` to `POSTED`
- `externalAccountingDocumentId` is populated with the returned SAP reference
- the original NHB `correlationId` remains available for end-to-end traceability

A failed SAP posting should leave sufficient evidence for investigation through `postingStatus = FAILED` and `errorMessage`, without falsely marking the accounting event as successfully posted.

Every successful SAP accounting test should become a repeatable regression scenario in accordance with the catalog regression rule.

## 8. Regression rule

Every successful test becomes a repeatable regression scenario. Record the test date, S/4HANA environment, payload reference, returned identifier, result, and any configuration dependencies.

## 9. Sources

- [Business Partner (A2X) API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/3c916ef10fc240c9afc594b346ffaf77/85043858ea0f9244e10000000a4450e5.html)
- [Cash Flow API](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/d4eb54ea54944b04923af573b28a1e7d/80ea959a2ccf4bb29e88bf0225679283.html)
