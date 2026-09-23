# Islamic Banking / Murabaha Product Track

## Purpose

Build a small, non-production Murabaha financing prototype that demonstrates how NHB Islamic-finance product design, enterprise architecture, business-process modeling, SAP CAP implementation, Finxact integration, and future SAP S/4HANA integration can form one traceable architecture.

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
SAP S/4HANA accounting and cash-management integration remains target architecture and has not yet been implemented end to end.
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
The original discovery-to-prototype sequence was:
1. Define the Murabaha customer journey and product rules.
2. Map relevant banking capabilities and accounting events.
3. Implement CAP lifecycle and validation logic.
4. Prototype financing, installment, payment, and control scenarios using synthetic data.
5. Integrate supported SAP accounting and cash-management services when the SAP lab is available.
6. Demonstrate the architecture and decide the next product phase.
The current prototype has already completed significant parts of steps 1–4.
Implemented and demonstrated capabilities include:
- Murabaha financing persistence
- installment persistence
- payment persistence
- payment-reversal persistence
- lifecycle controls
- credit-decision evidence
- Sharia-approval evidence
- bank-ownership evidence
- sale-contract evidence
- delivery evidence
- installment payment posting
- duplicate external-payment-ID prevention
- overpayment prevention
- automatic installment status management
- automatic financing settlement logic
The principal next phases are:
- strengthen domain and control testing
- expand traceability evidence where useful
- identify justified Finxact touchpoints rather than forcing provider integration into NHB-owned domain logic
- select a concrete SAP S/4HANA accounting use case
- inspect and validate the corresponding supported SAP API
- implement the first CAP → SAP integration
- document the resulting accounting and cash-management architecture baseline
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
| Prevent overpayment | Excess-payment exception path | Financial control and reconciliation requirement | Outstanding-balance validation in `service.js` | USD 11,000 against a USD 10,500 outstanding balance was rejected without data change. |
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
