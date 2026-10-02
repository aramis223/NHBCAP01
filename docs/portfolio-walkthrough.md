# NHBCAP01 Portfolio Walkthrough

## Purpose and audience

This walkthrough presents NHBCAP01 as a traceable architecture and implementation portfolio for an architecture or engineering reviewer. It connects enterprise capabilities, business processes, application controls, external integration, and verification evidence through one Murabaha financing scenario.

The prototype uses synthetic data and demonstrates a non-production learning baseline. AV-03 — NHBCAP01 Architecture-to-Implementation Realization is completed as v1.0. The first CAP internals deep-understanding pass is completed, and portfolio packaging is the current phase.

## Opening narrative

NHB owns its business-facing service contracts and Murabaha domain controls. Sparx EA describes the enterprise structure and cross-layer relationships; SAP Signavio describes process behavior; SAP CAP makes selected controls executable. Fiserv Banking Hub / Finxact supplies external banking capabilities. SAP Integration Suite mediates the implemented SAP accounting contract to a controlled mock S/4HANA receiver.

The central portfolio claim is that a business control can be followed from architecture and process intent to application behavior and recorded verification evidence.

## Demonstration sequence

Use a 15–20 minute walkthrough. The sequence below reviews existing artifacts and recorded evidence; it does not require running financial operations or changing deployed configuration.

### 1. Establish the architecture boundary

Show AV-03 v1.0 in Sparx EA and explain the separation between logical architecture and implementation technology. Follow the relationships from capability and business process to application service, application component, and implementation evidence.

Use [Architecture](architecture.md), [EA Understanding Guide](ea-understanding-guide.md), and [EA Governance Baseline](ea-governance-baseline.md) as the repository references. Retain the approved capability-domain terminology, including CD-03 Deposit Management and CD-04 Financing & Credit Management.

### 2. Follow one Murabaha process

Show the SAP Signavio model `04 – VS-04.01 Murabaha Financing — End-to-End BPMN`. Follow credit approval, Sharia approval, asset acquisition and bank ownership, sale-contract execution, delivery, and activation.

Explain why each recorded decision or evidence field is a prerequisite for the next governed action. Use the traceability matrix in [Islamic Banking / Murabaha Product Track](islamic-banking-product-track.md) to connect process activities to CAP actions.

### 3. Show executable controls

Review the CDS service contract and selected handlers in `srv/service.cds` and `srv/service.js`. Show the governed lifecycle actions and the payment and reversal boundaries.

Use recorded regression evidence to demonstrate rejection before activation, duplicate-payment and overpayment prevention, reversal before settlement, valid servicing while defaulted, and automatic settlement after all installments are paid. Explain that servicing changes and their accounting events are persisted in the same CAP request transaction.

The supporting regression scripts are `test/murabaha-lifecycle.sh`, `test/murabaha-servicing.sh`, and `test/murabaha-exceptional-states.sh`. Consult the product-track documentation for their scope and fixture behavior before any later live demonstration.

### 4. Follow the accounting handoff

Trace a `PAYMENT_RECEIVED` accounting event from initial `PENDING` status through `postAccountingEvent`, configuration validation, mapping, SOAP construction, transport, confirmation parsing, and persistence of the returned document identity.

Then show how `PAYMENT_REVERSED` locates the original posted event and uses its accounting document, company code, and fiscal year to construct the dedicated reversal request. Explain why a successful HTTP response alone is insufficient to mark an event `POSTED`.

Use `srv/sap/` and the [SAP Test Catalog](sap-test-catalog.md). Distinguish failures after a posting attempt begins, which record `FAILED` and error evidence, from missing configuration before the attempt, which leaves the event `PENDING`.

### 5. Show mediation and correlation evidence

Follow the verified path:

```text
NHBCAP01 CAP action
        → SAP BTP Destination
        → SAP Integration Suite
        → controlled mock S/4HANA receiver
        → confirmation and CAP persistence
```

Use the recorded normal-posting and reversal evidence in the [Integration Suite Runbook](integration-suite-runbook.md) and SAP Test Catalog. Show business correlation propagation as `X-Correlation-ID` and searchable MPL enrichment as `NHB_CorrelationId`. Explain that the SAP-safe 16-character `DocumentReferenceID` is derived separately from the accounting-event UUID.

Describe returned accounting identities here as controlled mock responses. They do not prove creation of a live SAP accounting document.

### 6. Show the external banking abstraction

Use [Fiserv Integration](fiserv-integration.md) to show the verified Account Details and Accountholder retrieval paths. Explain the provider-to-NHB mapping, supported customer query behavior, and provisional `PartyId` to `CustomerNumber` mapping.

Keep this evidence distinct from Murabaha servicing: the recorded Fiserv integration verifies read-only external banking access; it does not establish that Murabaha payment processing runs through Finxact.

### 7. Close with verification and remaining milestones

Present the recorded baseline below, then identify live SAP posting and reversal as the remaining external verification milestone. Explain how the architecture preserves clear ownership boundaries while allowing that later verification.

## Evidence and claim boundaries

| Area | Recorded baseline | Claim boundary |
| --- | --- | --- |
| Architecture realization | AV-03 completed as v1.0 | Selected architecture-to-implementation traceability |
| CAP understanding | First deep-understanding pass completed | Learning/reference checkpoint |
| Murabaha servicing | Local and Cloud Foundry verification; 15 passed, 0 failed | Synthetic prototype controls |
| CAP accounting boundary | 4 passed, 0 failed | Governed action and persistence behavior under controlled responses |
| SAP accounting/integration regression | 44 passed, 0 failed | Recorded automated baseline; no fresh test run claimed by this walkthrough |
| Integration Suite | Normal posting, reversal, and correlation verified to a controlled mock receiver | Implemented mediation; live SAP execution pending |
| Fiserv / Finxact | Account Details and Accountholder retrieval verified | Read-only certification integration; provisional customer identity mapping |
| Live SAP S/4HANA | SAP-T05 and SAP-T05R pending | No live accounting posting or reversal claim |

## Portfolio evidence package

The versioned documentation is the narrative and reference layer. Assemble the following visual evidence for presentation alongside it:

- AV-03 v1.0 export showing the selected realization relationships.
- Signavio Murabaha BPMN export showing the relevant control activities.
- Selected CAP contract and implementation excerpts connected to those controls.
- Recorded regression summaries with dates and environment context.
- Integration Suite monitoring and mock receiver evidence showing the same business correlation.

The external model exports and monitoring captures are supporting presentation artifacts to assemble; this walkthrough does not claim they have been exported or attached. Use synthetic evidence and exclude credentials and access tokens from all presentation material.

## Reviewer takeaway

NHBCAP01 demonstrates a governed chain from enterprise architecture and process controls to executable CAP behavior, external service boundaries, and recorded verification. The implemented mock-mediated SAP accounting baseline and read-only Fiserv integration provide concrete evidence, with live SAP accounting execution explicitly retained as a separate milestone.
