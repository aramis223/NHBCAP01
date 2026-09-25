# Islamic Banking / Murabaha Product Track

## Purpose

Build a small, non-production Murabaha financing prototype that demonstrates how NHB Islamic-finance product design, enterprise architecture, business-process modeling, SAP CAP implementation, Finxact integration, and SAP S/4HANA accounting integration can form one traceable architecture.

The prototype uses synthetic data only and is intended as architecture, learning, implementation, and portfolio evidence rather than a production banking product.

## Prototype Scope

The current prototype covers:

- one Murabaha financing product using synthetic data only
- customer reference and optional external account reference
- asset, supplier, asset cost, profit, sale price, currency, contract date, maturity date, and financing status
- credit-decision and Sharia-approval evidence
- bank asset-ownership controls
- Murabaha sale-contract execution evidence
- asset-delivery evidence
- installment scheduling
- payment posting
- duplicate-payment prevention
- overpayment prevention
- automatic installment-status updates
- financing settlement when all installments are fully paid
- SAP CAP as the NHB-owned application, orchestration, validation, and service layer

Finxact and SAP S/4HANA remain separate external platforms with clearly defined architectural boundaries.

## Murabaha Lifecycle

The prototype financing lifecycle is:

```text
DRAFT
  │
  ▼
CREDIT_APPROVED
  │
  ▼
SHARIA_APPROVED
  │
  ▼
ASSET_ACQUIRED
  │
  ▼
CONTRACT_EXECUTED
  │
  ▼
DELIVERED
  │
  ▼
ACTIVE
  │
  ▼
SETTLED
```
The primary lifecycle above reflects the current executable control model.

Additional statuses such as `QUOTED`, `APPROVED`, `ASSET_PURCHASED`, and `OFFERED` remain reserved or legacy vocabulary and are not part of the primary governed transition path.

`CANCELLED` and `DEFAULTED` represent exceptional lifecycle states.

`SETTLED` is system-driven when all installments are fully paid and is not intended to be set manually.

These statuses represent a prototype workflow only. Production product rules would require formal Sharia, legal, risk, finance, compliance, accounting, and regulatory review.
### Governed Lifecycle Actions

The Murabaha financing lifecycle is controlled through explicit bound actions on `MurabahaFinancing` rather than unrestricted status changes.

The implemented lifecycle actions are:

- `recordCreditDecision`
- `recordShariaDecision`
- `recordAssetAcquisition`
- `executeSaleContract`
- `confirmAssetDelivery`
- `activateFinancing`

The governed transition path is:

```text
DRAFT
  │ recordCreditDecision(APPROVED)
  ▼
CREDIT_APPROVED
  │ recordShariaDecision(APPROVED)
  ▼
SHARIA_APPROVED
  │ recordAssetAcquisition
  ▼
ASSET_ACQUIRED
  │ executeSaleContract
  ▼
CONTRACT_EXECUTED
  │ confirmAssetDelivery
  ▼
DELIVERED
  │ activateFinancing
  ▼
ACTIVE
```

`SETTLED` remains system-driven and is reached only when all installments are fully paid through the payment-processing logic.

Negative or non-approval decisions are recorded without incorrectly advancing the financing lifecycle.

The lifecycle is covered by the repeatable regression script:

`test/murabaha-lifecycle.sh`

The script creates an isolated synthetic financing record, executes the complete governed lifecycle, and verifies the resulting evidence fields and final `ACTIVE` status.

### Servicing Regression

The servicing lifecycle is covered independently by:

`test/murabaha-servicing.sh`

The servicing regression creates isolated financing and installment records and verifies:

- payment rejection before activation
- partial payment and `PARTIALLY_PAID` installment status
- duplicate external-payment-ID prevention
- overpayment prevention
- payment reversal before settlement
- restoration of installment balance following reversal
- original payment transition to `REVERSED`
- prevention of a second reversal of the same payment
- duplicate external-reversal-reference prevention
- transition to `DEFAULTED`
- continued valid payment servicing while `DEFAULTED`
- automatic transition to `SETTLED` after all installments are paid
- rejection of ordinary reversal after settlement
- creation of a `PAYMENT_RECEIVED` accounting event when a payment is posted
- creation of a `PAYMENT_REVERSED` accounting event when a payment is reversed
- accounting-event correlation to the originating payment or reversal reference
- initial accounting-event status of `PENDING`, representing an accounting handoff obligation rather than completed external posting

External payment, reversal, lifecycle-decision, ownership, delivery, and default references are generated with a run-specific suffix so the regression remains repeatable against persistent test data.

### Accounting Event Baseline

Murabaha servicing creates NHB-owned accounting events as part of the same CAP request transaction that changes the servicing state.

The persisted `MurabahaAccountingEvent` records include:

- `eventType`
- payment, financing, and installment references
- `eventDate`
- `amount`
- `currency`
- `correlationId`
- `postingStatus`
- optional `externalAccountingDocumentId`
- optional `errorMessage`

The currently implemented event types are:

- `PAYMENT_RECEIVED`
- `PAYMENT_REVERSED`

New accounting events are created with `postingStatus = PENDING`.

`PENDING` means that NHBCAP01 has recorded a durable accounting handoff obligation. It does not mean that SAP S/4HANA has already posted an accounting document.

The payment or reversal state change and its corresponding accounting event are executed within the same CAP request transaction so that the servicing state and accounting obligation are committed together.

NHBCAP01 now provides a governed accounting-posting operation through `postAccountingEvent(accountingEventId)`.

The governed accounting-posting operation supports both `PAYMENT_RECEIVED` and `PAYMENT_REVERSED`.

The operation:

- loads the specified accounting event
- verifies that the event exists
- verifies that `postingStatus` is `PENDING`
- validates the accounting-event data
- selects the applicable normal-posting or reversal path
- resolves the required NHB accounting configuration
- maps the event to the applicable normalized SAP request model
- builds the corresponding SAP synchronous Journal Entry SOAP request
- invokes the configured SAP transport
- parses the SAP synchronous confirmation
- records the SAP-native accounting-document identity on success
- records normalized failure information when posting fails

The current accounting lifecycle is:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        │
        ▼
postAccountingEvent
        │
        ▼
Validate accounting event
        │
        ▼
Select accounting path
        │
        ├── PAYMENT_RECEIVED
        │        │
        │        ▼
        │   Resolve normal accounting configuration
        │        │
        │        ▼
        │   Map normalized journal-entry candidate
        │        │
        │        ▼
        │   Build normal SAP Journal Entry SOAP request
        │
        └── PAYMENT_REVERSED
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
            Map normalized reversal candidate
                 │
                 ▼
            Build dedicated SAP reversal SOAP request
        │
        ▼
Invoke SAP transport
        │
        ▼
Parse SAP confirmation
        │
        ├── SAP confirmed
        │        │
        │        ▼
        │      POSTED
        │        +
        │ SAP document identity
        │
        └── SAP / transport / SOAP / response failure
                 │
                 ▼
               FAILED
                 +
            errorMessage
```

A successful HTTP response alone is not treated as successful accounting posting.

NHBCAP01 requires the SAP synchronous confirmation to contain a valid accounting document together with company code and fiscal year before the accounting event is changed to `postingStatus = POSTED`.

For successful normal posting and reversal, NHBCAP01 persists:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

The normalized external SAP reference is stored in the form:

```text
CompanyCode-FiscalYear-AccountingDocument
```

For example:

```text
NHB1-2026-1900000123
```

For `PAYMENT_REVERSED`, NHBCAP01 retrieves the corresponding original `PAYMENT_RECEIVED` accounting event and requires that it has already been successfully posted.

The reversal path uses the original SAP-native accounting identity to derive `ReversalReferenceDocument`.

The dedicated reversal request uses:

- `ReversalReason`
- `ReversalReferenceDocument`
- `ReversalDate`

The reversal request deliberately does not contain normal debit/credit `<Item>` elements.

The operational reversal reason stored in the Murabaha domain remains separate from the SAP-configured `ReversalReason` code.

If a posting attempt begins but fails because of transport, SOAP processing, SAP response validation, or SAP business validation, NHBCAP01 records `postingStatus = FAILED` together with normalized failure information in `errorMessage`.

This failure state is persisted as accounting audit evidence.

If required accounting or transport configuration is unavailable before the SAP posting attempt begins, the event is not falsely marked as a failed SAP posting and remains `PENDING`.

The current SAP accounting integration is separated under:

```text
srv/sap/
├── accounting.js
├── config.js
├── journal-entry-soap.js
├── journal-entry-reversal-soap.js
├── journal-entry-response.js
└── transport.js
```

The implementation separates:

- normal-posting and reversal accounting configuration
- NHB accounting-event mapping
- normal SAP SOAP request construction
- dedicated reversal SOAP request construction
- shared HTTP transport
- SAP confirmation parsing
- CAP posting-state persistence

The transport supports both:

- explicit endpoint and Basic Authentication for controlled local/test execution
- SAP BTP Destination-based execution through the SAP Cloud SDK

The application-side SAP accounting path is verified through isolated SAP-layer tests and CAP-level regression using controlled SAP responses.

Current verified regression baseline:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

The verified CAP-level outcomes include:

- `PENDING → POSTED` for normal posting
- `PENDING → POSTED` for reversal posting
- persistence of the SAP-native accounting-document identity
- `PENDING → FAILED`
- persistence of `errorMessage`
- original-posting lookup for reversal
- validation of original SAP document identity

Live SAP S/4HANA execution remains the external verification milestone for both normal posting and reversal.

This baseline therefore establishes an implemented NHB-to-SAP accounting boundary for both payment posting and payment reversal without overstating live SAP verification.

### Cloud Foundry Verification

The Murabaha servicing and accounting-event baseline has been deployed to SAP BTP Cloud Foundry through the project MTA.

The deployed application includes:

- `NHBCAP01-srv`
- SAP HANA Cloud / HDI persistence
- XSUAA protection
- SAP BTP Destination service binding

The deployed CAP service was verified behind XSUAA using the same Murabaha servicing regression used locally.

The Cloud Foundry regression confirmed:

- payment rejection before financing activation
- financing activation
- partial payment and `PARTIALLY_PAID` installment status
- `PAYMENT_RECEIVED` accounting-event creation
- duplicate external-payment-ID rejection
- overpayment rejection
- payment reversal before settlement
- restoration of installment balance and payment status after reversal
- `PAYMENT_REVERSED` accounting-event creation
- prevention of duplicate reversal
- prevention of duplicate external reversal reference
- transition to `DEFAULTED`
- valid payment servicing while `DEFAULTED`
- automatic transition to `SETTLED`
- rejection of ordinary reversal after settlement

The deployed verification therefore confirms parity between the local and SAP BTP Cloud Foundry environments for the Murabaha servicing and NHB-owned accounting-event baseline.

The newer SAP accounting-posting implementation adds the following application-side capabilities:

- governed `postAccountingEvent` processing
- NHB accounting configuration resolution
- normalized journal-entry mapping
- SAP synchronous SOAP request construction
- SAP BTP Destination-aware transport
- SAP confirmation parsing
- `PENDING → POSTED` processing
- persistence of `externalAccountingDocumentId`
- `PENDING → FAILED` processing
- persistence of `errorMessage`

These newer posting capabilities are currently verified through isolated automated tests and CAP-level regression using controlled SAP responses.

They have not yet been claimed as live SAP S/4HANA posting evidence.

The verification boundary is therefore:

```text
SAP BTP Cloud Foundry
        │
        ├── Murabaha servicing
        │       VERIFIED
        │
        ├── Accounting-event creation
        │       VERIFIED
        │
        ├── XSUAA-protected CAP runtime
        │       VERIFIED
        │
        └── SAP posting implementation
                │
                ├── Application logic
                │       VERIFIED
                │
                ├── SOAP mapping
                │       VERIFIED
                │
                ├── Transport abstraction
                │       VERIFIED
                │
                ├── SAP response processing
                │       VERIFIED
                │
                └── Live S/4HANA posting
                        PENDING EXTERNAL VERIFICATION
```

Live SAP S/4HANA verification will require the configured S/4HANA environment and destination to accept the generated synchronous Journal Entry request and return a genuine accounting-document identity.

Only after that live test succeeds should the SAP posting path be described as externally verified end to end.

### Exceptional Lifecycle States

Exceptional Murabaha states are governed through explicit bound actions rather than direct status changes.

The implemented exceptional actions are:

- `cancelFinancing`
- `markFinancingDefaulted`

The governed exceptional transitions are:

```text
DRAFT
CREDIT_APPROVED
SHARIA_APPROVED
ASSET_ACQUIRED
CONTRACT_EXECUTED
DELIVERED
        │
        ▼
    CANCELLED
```

and:

```text
ACTIVE
  │
  ▼
DEFAULTED
```

`ACTIVE` financing cannot be cancelled through the prototype cancellation workflow.

`SETTLED` remains a terminal system-driven state and cannot be reached through a direct consumer status update.

Direct lifecycle status changes through ordinary update requests are rejected. Consumers must use the governed lifecycle actions, while internal payment-processing logic retains responsibility for the automatic transition to `SETTLED`.

Cancellation records:

- cancellation date
- cancellation reason
- cancellation reference

Default records:

- default date
- default reason
- default reference

Cancellation after asset acquisition, sale execution, or delivery is represented only as a prototype lifecycle control. A production Murabaha implementation would require additional Sharia, legal, accounting, asset-disposition, and operational rules.

The exceptional-state behavior is covered by:

`test/murabaha-exceptional-states.sh`

## Architecture Boundary
The prototype follows these architecture principles:
- SAP CAP owns the NHB-facing application and service boundary.
- CAP does not access Finxact or SAP databases directly.
- Finxact capabilities are consumed through supported APIs and controlled credentials.
- SAP S/4HANA integration will use supported SAP APIs or services rather than direct database access.
- Provider-specific contracts remain behind the NHB CAP boundary.
- NHB-owned domain behavior is not automatically delegated to Finxact.
- Credentials and secrets remain outside Git and project documentation.
- Synthetic data is used for prototype and demonstration scenarios.
The intended target architecture is:
```
NHB Consumer / Application
          │
          ▼
       SAP CAP
      NHBCAP01
       ┌──┴───────────────┐
       │                  │
       ▼                  ▼
NHB Murabaha        External Integration
Domain Logic              │
                          ├── Finxact / Fiserv
                          │
                          └── SAP S/4HANA
                              (target)

```
Finxact currently provides external banking-platform capabilities through the Fiserv Banking Hub integration developed elsewhere in NHBCAP01.
The Murabaha payment and lifecycle controls described in this document are currently implemented as NHB-owned CAP domain behavior. They should not be interpreted as evidence that Murabaha payment posting is already executed through Finxact.
SAP S/4HANA accounting integration now has an implemented NHBCAP01 posting boundary, SOAP mapping, transport abstraction, confirmation parser, and CAP posting-state lifecycle. Live SAP S/4HANA posting remains pending external verification. SAP cash-management integration remains target architecture.

## Out of Scope
The current prototype does not provide:
- live customer data
- real financial transactions
- production credit decisioning
- production pricing approval
- collections
- regulatory reporting
- production Sharia certification
- legal interpretation
- direct database integration with Finxact
- direct database integration with SAP S/4HANA
- production accounting integration
- production authorization, resilience, monitoring, or operational controls

## Implementation Status and Roadmap

The Murabaha track has progressed beyond the initial domain prototype and now includes a governed accounting-integration boundary.

The original discovery-to-prototype sequence was:

1. Define the Murabaha customer journey and product rules.
2. Map relevant banking capabilities and accounting events.
3. Implement CAP lifecycle and validation logic.
4. Prototype financing, installment, payment, and control scenarios using synthetic data.
5. Introduce the SAP accounting integration boundary.
6. Verify the implementation against a live SAP S/4HANA environment.
7. Expand the architecture only where demonstrated business and integration requirements justify it.

### Implemented and Verified Baseline

The current prototype includes:

- Murabaha financing persistence
- installment persistence
- payment persistence
- payment-reversal persistence
- governed financing lifecycle transitions
- credit-decision recording
- Sharia-decision recording
- asset-acquisition recording
- sale-contract execution
- asset-delivery confirmation
- financing activation
- partial and full installment payment processing
- duplicate external-payment-ID prevention
- overpayment prevention
- payment reversal before settlement
- duplicate payment-reversal prevention
- duplicate external-reversal-reference prevention
- restoration of installment balance following reversal
- financing default handling
- continued valid payment servicing while `DEFAULTED`
- automatic transition to `SETTLED`
- protection of terminal settlement state
- `PAYMENT_RECEIVED` accounting-event creation
- `PAYMENT_REVERSED` accounting-event creation
- accounting-event correlation to the originating business transaction
- initial `PENDING` accounting-posting state
- governed `postAccountingEvent` CAP action

The servicing baseline has been verified locally and on SAP BTP Cloud Foundry behind XSUAA.

### SAP Accounting Integration Baseline

The SAP accounting layer now includes both normal payment posting and payment reversal.

The implemented capabilities include:

- externalized NHB accounting configuration
- dedicated reversal accounting configuration
- normalized NHB-to-SAP journal-entry mapping
- normalized NHB-to-SAP reversal mapping
- synchronous SAP Journal Entry SOAP request construction
- dedicated SAP reversal SOAP request construction
- SOAP message-header generation
- XML-safe request serialization
- explicit local/test Basic Authentication transport
- SAP BTP Destination-aware transport
- SAP Cloud SDK HTTP integration
- synchronous SAP response parsing
- SOAP Fault handling
- SAP business-failure detection
- normalized SAP accounting-document identification
- persistence of SAP-native accounting-document identity
- `PENDING → POSTED` state transition for normal posting
- `PENDING → POSTED` state transition for reversal posting
- `PENDING → FAILED` state transition
- persistence of normalized `errorMessage`

For successful normal posting and reversal, NHBCAP01 persists:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

The implemented accounting flow is:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        │
        ▼
postAccountingEvent
        │
        ▼
Validate accounting event
        │
        ▼
Select accounting path
        │
        ├── PAYMENT_RECEIVED
        │        │
        │        ▼
        │   Resolve normal accounting configuration
        │        │
        │        ▼
        │   Map normalized journal-entry candidate
        │        │
        │        ▼
        │   Build normal SAP synchronous SOAP request
        │
        └── PAYMENT_REVERSED
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
            Map normalized reversal candidate
                 │
                 ▼
            Build dedicated SAP reversal SOAP request
        │
        ▼
Invoke SAP transport
        │
        ▼
Parse SAP confirmation
        │
        ├── SAP confirmed
        │        │
        │        ▼
        │      POSTED
        │        +
        │ SAP document identity
        │
        └── SAP / transport / SOAP / response failure
                 │
                 ▼
               FAILED
                 +
            errorMessage
```

A successful HTTP response is not sufficient to establish successful accounting posting.

NHBCAP01 requires a valid accounting document, company code, and fiscal year in the SAP confirmation before the accounting event is marked `POSTED`.

For `PAYMENT_REVERSED`, NHBCAP01 requires the corresponding original `PAYMENT_RECEIVED` accounting event to have already been successfully posted.

The reversal path uses the original SAP-native accounting identity:

```text
AccountingDocument
        +
CompanyCode
        +
FiscalYear
        │
        ▼
ReversalReferenceDocument
```

The dedicated reversal request uses:

- `ReversalReason`
- `ReversalReferenceDocument`
- `ReversalDate`

The reversal SOAP request deliberately excludes normal debit/credit `<Item>` elements.

The operational reversal reason stored by the Murabaha domain remains separate from the SAP-configured reversal-reason code.

### Automated Verification

The current implementation is supported by automated regression at several levels.

Murabaha servicing regression verifies:

- payment lifecycle controls
- payment reversal
- duplicate prevention
- default servicing
- settlement behavior
- accounting-event creation
- `PAYMENT_RECEIVED` event creation
- `PAYMENT_REVERSED` event creation

SAP accounting unit and integration tests verify:

- normal accounting configuration validation
- reversal accounting configuration validation
- normal accounting-event mapping
- reversal-event mapping
- normal SOAP request construction
- reversal SOAP request construction
- message-context validation
- XML escaping
- SAP field-length validation
- SAP document-reference validation
- reversal-reason validation
- reversal-reference validation
- Basic Authentication transport
- SAP BTP Destination transport
- SAP response parsing
- SOAP Fault handling
- SAP business-failure handling
- original-posting identity validation
- original-company-code consistency validation

CAP-level regression verifies:

- `PENDING → FAILED` when SAP posting fails
- persistence of `errorMessage`
- `PENDING → POSTED` when SAP confirms normal posting
- `PENDING → POSTED` when SAP confirms reversal posting
- persistence of `externalAccountingDocument`
- persistence of `externalCompanyCode`
- persistence of `externalFiscalYear`
- persistence of `externalAccountingDocumentId`
- prevention of reposting an event that is no longer `PENDING`
- lookup of the original posted event before reversal
- validation of the original SAP accounting-document identity

Current verified regression baseline:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

The current automated baseline therefore verifies normal posting, reversal posting, and failure handling without requiring a live SAP system for every development regression.

### Current Verification Boundary

The present status is:

```text
Murabaha domain model
        VERIFIED
            │
Murabaha servicing
        VERIFIED
            │
Accounting-event creation
        VERIFIED
            │
Governed CAP posting action
        VERIFIED
            │
Normal NHB-to-SAP mapping
        VERIFIED
            │
Reversal NHB-to-SAP mapping
        VERIFIED
            │
Normal SAP SOAP construction
        VERIFIED
            │
Reversal SAP SOAP construction
        VERIFIED
            │
Transport abstraction
        VERIFIED
            │
SAP response processing
        VERIFIED
            │
CAP POSTED / FAILED lifecycle
        VERIFIED
            │
Live SAP S/4HANA normal posting
        PENDING EXTERNAL VERIFICATION
            │
Live SAP S/4HANA reversal posting
        PENDING EXTERNAL VERIFICATION
```

The prototype therefore demonstrates the application and integration architecture required for both SAP accounting posting and SAP accounting reversal without claiming that a live SAP accounting document or reversal has already been created.

### Next Milestones

The next milestones should continue from the verified baseline rather than broaden the prototype prematurely.

The immediate priorities are:

1. Configure the SAP S/4HANA Journal Entry service in the laboratory environment.
2. Create and validate the required SAP BTP Destination.
3. Confirm the supported authentication and communication arrangement.
4. Provide approved test accounting configuration, including a valid SAP reversal-reason code.
5. Execute the first live `PAYMENT_RECEIVED` posting.
6. Confirm the returned SAP accounting-document identity.
7. Verify the persisted `POSTED` state and SAP-native accounting identity.
8. Record the successful scenario as the live `SAP-T05` regression baseline.
9. Execute the corresponding Murabaha payment reversal.
10. Confirm creation of the `PAYMENT_REVERSED` accounting event.
11. Submit the reversal event through `postAccountingEvent`.
12. Confirm that NHBCAP01 derives the SAP reversal reference from the original accounting document, company code, and fiscal year.
13. Confirm that SAP accepts the configured reversal reason.
14. Confirm the returned SAP accounting-document identity for the reversal.
15. Verify the persisted reversal `POSTED` state.
16. Record the successful reversal scenario as the live `SAP-T05R` regression baseline.
17. Introduce additional accounting configuration only when supported by approved accounting requirements.
18. Continue SAP cash-management integration only after the normal-posting and reversal baselines are stable.

### Payment Reversal Baseline

`PAYMENT_REVERSED` is now implemented as a dedicated SAP accounting path.

It is intentionally not submitted through the normal `PAYMENT_RECEIVED` debit/credit posting contract.

The implemented architecture is:

```text
PAYMENT_REVERSED
        │
        ▼
Locate original PAYMENT_RECEIVED event
        │
        ▼
Verify original event is POSTED
        │
        ▼
Resolve original SAP accounting identity
        │
        ▼
Resolve reversal configuration
        │
        ▼
Build ReversalReferenceDocument
        │
        ▼
Build dedicated SAP reversal request
        │
        ▼
Submit through shared SAP transport
        │
        ▼
Parse SAP synchronous confirmation
        │
        ├── success
        │      │
        │      ▼
        │    POSTED
        │      +
        │ SAP reversal document identity
        │
        └── failure
               │
               ▼
             FAILED
               +
          errorMessage
```

The implementation preserves traceability to:

- the original payment
- the original `PAYMENT_RECEIVED` accounting event
- the original SAP accounting document
- the reversal accounting event
- the SAP accounting document returned for the reversal

The SAP-native original document identity is preserved through:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`

These values are used to derive the SAP `ReversalReferenceDocument`.

The application-side reversal contract is implemented and regression-tested.

The remaining reversal milestone is live verification against an actual SAP S/4HANA system, including confirmation that the configured SAP reversal-reason code and reversal reference are accepted by the target system.

### Scope Discipline

The prototype should continue to avoid premature production complexity.

The following capabilities should be introduced only when demonstrated requirements justify them:

- asynchronous accounting queues
- automatic retry orchestration
- dead-letter processing
- advanced observability
- operational dashboards
- multi-ledger accounting
- tax determination
- profit-center and cost-center derivation
- production chart-of-accounts mapping
- reconciliation workflows
- production authorization design
- high-availability and disaster-recovery controls

The next architectural objective is therefore not to maximize the number of integrations.

It is to convert the current verified application-side SAP accounting boundary into a genuine, repeatable live SAP S/4HANA posting baseline while preserving the clean separation between NHB domain logic, SAP integration logic, and external platform configuration.

## End-to-End Architecture and Implementation Traceability
This prototype provides one traceable chain from enterprise architecture through business-process modeling to an executable and tested SAP CAP service.
### Authoritative Artifacts
- Sparx EA: NHB Enterprise Architecture - P1.5 End-to-End Traceability.qea — enterprise capabilities, value streams, business processes, applications, controls, and implementation links.
- SAP Signavio: 04 – VS-04.01 Murabaha Financing — End-to-End BPMN — BPMN model 13978c1734a944e1adf93e1c6c86639b.
- SAP CAP: NHBCAP01 — domain entities, OData services, lifecycle controls, payment and reversal operations, validation logic, and synthetic evidence data.
### Traceability Matrix

| Business intent / control | Signavio process evidence | Sparx EA alignment | CAP implementation evidence | Verified behavior |
| --- | --- | --- | --- | --- |
| Assess financing request | Credit assessment and decision activities | VS-04.01 Murabaha Financing; financing-origination business process | Bound action `MurabahaFinancing.recordCreditDecision`; `creditDecisionStatus`, `creditDecisionDate`, `creditDecisionReference` | Financing cannot advance without an approved credit decision. |
| Confirm Sharia compliance | Sharia review and approval activities | Islamic-finance governance capability and Murabaha control requirements | Bound action `MurabahaFinancing.recordShariaDecision`; `shariaApprovalStatus`, `shariaApprovalDate`, `shariaApprovalReference` | Acquisition and sale execution require recorded Sharia approval. |
| Acquire asset and record bank ownership | **Acquire asset and record bank ownership** | VS-04.01.04 / BP-04.03 control trace | Bound action `MurabahaFinancing.recordAssetAcquisition`; `bankOwnershipRecorded`, `assetAcquisitionDate`, `ownershipEvidenceReference` | Sale execution is rejected until bank ownership and its evidence are recorded. |
| Execute Murabaha sale contract | **Execute Murabaha sale contract [VS-04.01.04 / BP-04.03]** | Product execution capability, application service, and business-process realization | Bound action `MurabahaFinancing.executeSaleContract`; `saleContractExecutedOn`, `saleContractReference` | Delivery or activation cannot precede the executed sale contract. |
| Deliver asset and activate financing | Asset delivery and customer acceptance activities | Fulfilment process and servicing capability | Bound actions `MurabahaFinancing.confirmAssetDelivery` and `MurabahaFinancing.activateFinancing`; `assetDeliveredOn`, `deliveryEvidenceReference`, financing status | `ACTIVE` or `SETTLED` status requires delivery evidence. |
| Collect installment payment | Payment receipt and allocation activity | Murabaha servicing / payment-processing capability; future external banking integration where justified | Bound action `MurabahaInstallment.postPayment`; `MurabahaPayment`; paid amount and installment status | USD 1,000 posted to installment 2; status changed to `PARTIALLY_PAID`. |
| Prevent duplicate financial posting | Duplicate-payment exception path | Operational resilience and payment-integrity control | Unique `externalPaymentId` validation | Reuse of `TEST-PAY-20260920-001` was rejected without changing the balance. |
| Prevent overpayment | Excess-payment exception path | Financial control and reconciliation requirement | Outstanding-balance validation in `service.js` | Payment exceeding the outstanding installment balance is rejected with HTTP 409 without changing servicing state. |
| Reverse payment before settlement | Payment correction / controlled reversal path | Payment-integrity, auditability, and servicing-control capability | `reverseMurabahaPayment`; `MurabahaPaymentReversal`; original payment status and installment balance update | Reversal restores the installment balance, marks the payment `REVERSED`, and persists reversal evidence. |
| Prevent duplicate reversal | Duplicate reversal exception path | Operational resilience and financial-integrity control | Payment reversal-state validation and unique external reversal reference | A second reversal of the same payment and reuse of an external reversal reference are rejected with HTTP 409. |
| Continue servicing while defaulted | Delinquency / recovery servicing path | Collections, recovery, and financing-servicing capability | `markFinancingDefaulted`; payment-processing logic | Financing transitions to `DEFAULTED` while valid installment payments remain accepted. |
| Protect settled financing | Post-settlement adjustment control | Settlement finality and governed adjustment capability | `reverseMurabahaPayment` settlement-state validation | Ordinary reversal after `SETTLED` is rejected with HTTP 409; a separate adjustment workflow is required. |
| Complete financing | All installments paid / settlement end state | Product lifecycle closure and future accounting handoff | Automatic installment `PAID` and financing `SETTLED` transitions | Settlement occurs only when every installment is fully paid. |

## Evidence IDs and Demonstration Data

- Financing: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Tested installment: `bbbbbbbb-bbbb-bbbb-bbbb-000000000002`
- Successful payment: `TEST-PAY-20260920-001`, USD 1,000.00, 2026-09-20
- Duplicate-ID negative test: same external payment ID, correctly rejected
- Overpayment negative test: `TEST-PAY-OVER-001`, USD 11,000.00, correctly rejected

All evidence values are synthetic and exist only for prototype and demonstration purposes.

## Current Versus Target Integration

The current implemented Murabaha path is:

```text
NHB Consumer
     │
     ▼
SAP CAP
     │
     ▼
Murabaha Domain Logic
     │
     ▼
NHB Persistence
```

The target external integration path is:

```text
                    SAP CAP
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
Fiserv Banking Hub            SAP APIs / Services
          │                         │
          ▼                         ▼
       Finxact                 SAP S/4HANA
```

External integration should be introduced only where a demonstrated business or architecture requirement exists.

## Portfolio Narrative

The artifacts are deliberately separated by purpose.

**Sparx EA** remains the system of record for enterprise structure, capability relationships, application architecture, and cross-layer traceability.

**SAP Signavio** provides the collaborative BPMN representation of operational process behavior and business controls.

**SAP CAP / NHBCAP01** provides the executable application, orchestration, validation, domain-control, and technical evidence layer.

**Fiserv / Finxact** provides external banking-platform capabilities through controlled API integration without defining NHB-owned service or domain contracts.

**SAP S/4HANA** remains the target enterprise accounting and cash-management platform and will be introduced through supported SAP services after a concrete Murabaha accounting use case is selected.

The value is not duplication between tools. The value is a governed chain demonstrating:

```text
Why the capability exists
        │
        ▼
How the business process operates
        │
        ▼
Where controls apply
        │
        ▼
How application behavior is implemented
        │
        ▼
How behavior is tested
        │
        ▼
How external platforms are integrated
```

This creates a portfolio artifact that connects enterprise architecture, business transformation, process design, solution architecture, implementation, integration, and verifiable technical evidence.
