# Islamic Banking / Murabaha Product Track

## Purpose

Build a small, non-production Murabaha financing prototype that demonstrates how Saria/NHB product development can connect Finxact, SAP CAP, and SAP S/4HANA.

## First Prototype Scope

- One Murabaha financing product using synthetic data only.
- Customer reference and optional Finxact account reference.
- Asset, supplier, asset-cost, profit, sale-price, currency, contract-date, maturity-date, and status data.
- CAP as the orchestration and product-integration layer.
- Finxact as the external core-banking/account-processing platform.
- SAP S/4HANA as the accounting and cash-management target.

## Initial Lifecycle

`DRAFT → UNDER_REVIEW → APPROVED → ASSET_PURCHASED → ACTIVE → SETTLED`

`CANCELLED` may be used before activation.

These statuses are a prototype workflow. Product rules require Sharia, legal, risk, finance, and compliance review before production use.

## Architecture Boundary

- CAP does not access Finxact or SAP databases directly.
- CAP consumes Finxact APIs through controlled credentials.
- CAP sends accounting and cash-flow events to SAP through approved SAP integration APIs.
- API credentials remain in local environment files or managed credential stores, never in Git.

## Out of Scope

- Live customer data or real financial transactions.
- Credit decisioning, pricing approval, collections, and regulatory reporting.
- Production Sharia certification or legal interpretation.
- Direct database integration with Finxact or SAP.

## Six-Week Discovery-to-Prototype Plan

1. Define the Murabaha customer journey and product rules.
2. Map Finxact account/product capabilities and SAP accounting events.
3. Add CAP lifecycle and validation logic.
4. Prototype synthetic financing, payment, and accounting scenarios.
5. Test SAP journal-entry and cash-flow handoffs when the SAP lab is available.
6. Demonstrate results and decide the next product phase.

## End-to-End Architecture and Implementation Traceability

This prototype provides one traceable chain from enterprise architecture to an executable and tested SAP CAP service.

### Authoritative Artifacts

- **Sparx EA:** `NHB Enterprise Architecture - P1.5 End-to-End Traceability.qea` — enterprise capabilities, value streams, business processes, applications, and implementation links.
- **SAP Signavio:** `04 – VS-04.01 Murabaha Financing — End-to-End BPMN` — BPMN model `13978c1734a944e1adf93e1c6c86639b`.
- **SAP CAP:** `NHBCAP01` — domain entities, OData service, lifecycle controls, payment action, and synthetic evidence data.

### Traceability Matrix

| Business intent / control | Signavio process evidence | Sparx EA alignment | CAP implementation evidence | Verified behavior |
| --- | --- | --- | --- | --- |
| Assess financing request | Credit assessment and decision activities | VS-04.01 Murabaha Financing; financing-origination business process | `MurabahaFinancing.creditDecisionStatus`, `creditDecisionDate`, `creditDecisionReference` | Financing cannot advance without an approved credit decision. |
| Confirm Sharia compliance | Sharia review and approval activities | Islamic-finance governance capability and Murabaha control requirements | `shariaApprovalStatus`, `shariaApprovalDate`, `shariaApprovalReference` | Acquisition and sale execution require recorded Sharia approval. |
| Acquire asset and record bank ownership | **Acquire asset and record bank ownership** | VS-04.01.04 / BP-04.03 control trace | `bankOwnershipRecorded`, `assetAcquisitionDate`, `ownershipEvidenceReference` | Sale execution is rejected until bank ownership and its evidence are recorded. |
| Execute Murabaha sale contract | **Execute Murabaha sale contract [VS-04.01.04 / BP-04.03]** | Product execution capability, application service, and business-process realization | `saleContractExecutedOn`, `saleContractReference` | Delivery or activation cannot precede the executed sale contract. |
| Deliver asset and activate financing | Asset delivery and customer acceptance activities | Fulfilment process and servicing capability | `assetDeliveredOn`, `deliveryEvidenceReference`, financing status | ACTIVE or SETTLED status requires delivery evidence. |
| Collect installment payment | Payment receipt and allocation activity | Murabaha servicing / payment-processing capability; Finxact integration target | Bound action `MurabahaInstallment.postPayment`; `MurabahaPayment`; paid amount and installment status | USD 1,000 posted to installment 2; status changed to `PARTIALLY_PAID`. |
| Prevent duplicate financial posting | Duplicate-payment exception path | Operational resilience and payment-integrity control | Unique `externalPaymentId` validation | Reuse of `TEST-PAY-20260920-001` was rejected without changing the balance. |
| Prevent overpayment | Excess-payment exception path | Financial control and reconciliation requirement | Outstanding-balance validation in `service.js` | USD 11,000 against a USD 10,500 outstanding balance was rejected without data change. |
| Complete financing | All installments paid / settlement end state | Product lifecycle closure and accounting handoff | Automatic installment `PAID` and financing `SETTLED` transitions | Settlement occurs only when every installment is fully paid. |

### Evidence IDs and Demonstration Data

- Financing: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Tested installment: `bbbbbbbb-bbbb-bbbb-bbbb-000000000002`
- Successful payment: `TEST-PAY-20260920-001`, USD 1,000.00, 2026-09-20
- Duplicate-ID negative test: same external payment ID, correctly rejected
- Overpayment negative test: `TEST-PAY-OVER-001`, USD 11,000.00, correctly rejected

### Portfolio Narrative

The artifacts are deliberately separated by purpose: Sparx EA remains the system of record for enterprise structure and cross-layer traceability; Signavio is the collaborative BPMN source for operational process behavior; SAP CAP is the executable implementation and control-evidence layer. The value is not duplication between tools, but a governed chain showing why the capability exists, how the process operates, where controls apply, and how the behavior is implemented and tested.
