# NHBCAP01 — Banking Enterprise Architecture & SAP BTP Implementation Project

## Overview

**NHBCAP01** is a hands-on enterprise architecture, banking transformation, and SAP implementation project.

The project is designed to demonstrate how a banking capability can be traced from:

    Business Architecture
        ↓
    Business Process
        ↓
    Application Architecture
        ↓
    Information and Integration Architecture
        ↓
    Technology Architecture
        ↓
    SAP CAP implementation
        ↓
    deployed and tested integration evidence

The project combines enterprise architecture modeling, banking domain design, SAP BTP application development, API integration, security, testing, and implementation traceability.

The principal banking demonstration scenario is **Sharia-compliant Murabaha financing**, supported by customer/account integration and SAP accounting integration patterns.

The project is intentionally developed as a learning and portfolio environment rather than presented as a production banking platform. The current phase is final portfolio verification and reference-release preparation.

---

## Portfolio Story

NHBCAP01 demonstrates a practical architecture-to-implementation journey using:

- **Sparx Enterprise Architect** for enterprise architecture modeling
- **SAP Signavio** for selected business-process and BPMN modeling
- **SAP Cloud Application Programming Model (CAP)** for application and service implementation
- **SAP BTP / Cloud Foundry** for cloud deployment
- **SAP HANA / HDI** for cloud persistence
- **XSUAA** for application authentication
- **SAP Destination Service** for managed outbound connectivity
- **Fiserv APIs** as an external banking integration
- **SAP S/4HANA Journal Entry integration patterns** for accounting integration
- **Git** for source control and controlled architecture/documentation evolution

The objective is not simply to demonstrate individual technologies.

The project is intended to show how business intent, architecture decisions, application services, integration contracts, implementation controls, and verification evidence fit together.

---

## Enterprise Architecture Baseline

The project includes an enterprise architecture repository maintained in Sparx Enterprise Architect.

The current checkpoint is:

**NHB Enterprise Architecture Baseline v1.0**

The repository is organized into:

    00 Architecture Governance
    01 Business Architecture
    02 Application Architecture
    03 Data & Information Architecture
    04 Integration Architecture
    05 Technology Architecture
    06 Traceability & Matrices
    07 Architecture Views

The principal Level-1 business domains are:

- Customer Management
- Product Management
- Deposit Management
- Financing & Credit Management
- Treasury & Liquidity Management

The repository contains:

- Business Capabilities
- Value Streams
- Outcomes
- Business Processes
- BPMN process models
- Application Components
- Application Services
- Information Objects
- Integration Interactions
- logical Technology Nodes
- System Software
- Technology Services
- cross-layer traceability relationships

A lightweight architecture governance baseline defines repository scope, modeling conventions, naming/versioning rules, and review principles.

---

## Architecture Exhibits

The following diagrams provide visual evidence of the selected
architecture-to-implementation traceability and Murabaha business process.

### AV-03 — Architecture-to-Implementation Realization

![NHBCAP01 Architecture-to-Implementation Realization](docs/diagrams/AV-03%20%E2%80%94%20NHBCAP01%20Architecture-to-Implementation%20Realization.png)

### VS-04.01 — Murabaha End-to-End BPMN

[View the Signavio Murabaha BPMN diagram](docs/diagrams/04%20%E2%80%93%20VS-04.01%20Murabaha%20Financing%20%E2%80%94%20End-to-End%20BPMN.svg)

These exports represent the recorded architecture and process baselines.
The implementation and verification evidence are documented separately.

---

## Key Architecture Views

### AV-01 — NHB Enterprise Architecture Overview

A representative cross-layer architecture view spanning:

    Business
       ↓
    Application
       ↓
    Information
       ↓
    Integration
       ↓
    Technology

The view is intentionally concise and uses selected repository relationships for executive-level communication.

### AV-02 — Sharia-Compliant Financing End-to-End View

A presentation-oriented view showing the financing journey across:

    Value / Business
            ↓
    Business Process
            ↓
    Application Service
            ↓
    Information

Representative financing processes include:

- Assess & Decide Credit
- Originate Financing
- Establish & Administer Financing Agreement
- Service Financing
- Manage Repayment & Settlement

### AV-03 — NHBCAP01 Architecture-to-Implementation Realization

**AV-03 — NHBCAP01 Architecture-to-Implementation Realization** is completed as **v1.0**.

The view establishes explicit traceability from architecture elements to verified SAP CAP, integration, deployment, and test evidence. It connects the governed enterprise-architecture baseline to the implemented Murabaha, external-banking, SAP accounting, SAP Integration Suite, and verification artifacts.

---

## Sharia-Compliant Financing Value Stream

The principal financing value stream is:

**VS-04.01 — Obtain Sharia-Compliant Financing**

Representative stages include:

    Financing Need Qualified
            ↓
    Eligibility and Creditworthiness Established
            ↓
    Murabaha Offer Structured and Approved
            ↓
    Asset Acquired and Sale Contract Executed
            ↓
    Financed Asset Delivered
            ↓
    Financing Obligations Serviced
            ↓
    Financing Obligation Resolved

Relevant capabilities include:

- Financing Origination Management
- Credit Assessment and Decision Management
- Sharia-Compliant Financing Structuring
- Asset Acquisition and Supplier Coordination
- Financing Agreement Management
- Collateral Management
- Financing Servicing
- Repayment and Settlement Management
- Financing Restructuring
- Collections and Recovery Management
- Sharia Governance and Compliance

---

## Murabaha Implementation

The CAP implementation provides a governed Murabaha lifecycle rather than simple CRUD persistence.

The principal lifecycle is:

    DRAFT
      ↓
    CREDIT_APPROVED
      ↓
    SHARIA_APPROVED
      ↓
    ASSET_ACQUIRED
      ↓
    CONTRACT_EXECUTED
      ↓
    DELIVERED
      ↓
    ACTIVE
      ↓
    SETTLED

Exceptional states include:

- CANCELLED
- DEFAULTED

Lifecycle progression is controlled through explicit domain actions rather than unrestricted status updates.

Examples include:

- record credit decision
- record Sharia decision
- record asset acquisition
- execute sale contract
- confirm asset delivery
- activate financing
- post payment
- reverse payment

Activation requires the required decision and evidence conditions to be satisfied.

---

## Murabaha Servicing

The servicing implementation includes:

- financing installments
- payment allocation
- partial-payment handling
- installment status updates
- duplicate external-payment protection
- currency validation
- overpayment prevention
- payment reversal
- reversal-reference protection
- default handling
- automatic settlement when obligations are fully paid
- accounting-event generation

Payments are accepted only in permitted financing states.

A reversal restores the affected servicing balances and records a corresponding accounting event.

---

## SAP CAP Service Architecture

The primary CAP service is:

`NHBCAP01Service`

Representative implementation files include:

    db/schema.cds
    srv/service.cds
    srv/service.js

The CAP application is responsible for:

- domain modeling
- OData service exposure
- business-action handling
- validation
- lifecycle governance
- transaction processing
- persistence
- external-service orchestration
- provider abstraction
- error handling

The implementation avoids exposing external-provider data structures directly as NHB business contracts.

---

## External Banking Integration — Fiserv / Finxact

NHBCAP01 integrates with Fiserv Banking Hub / Finxact certification APIs through NHB-owned application service contracts and provider mapping components.

Verified integration capabilities include:

- OAuth-based authentication and protected API access.
- Customer, accountholder, and account retrieval.
- Customer-to-account ownership verification and credit inquiry.
- Read-only account transaction history, including cursor-based pagination.
- Provider-to-NHB data mapping and controlled error handling.
- Read-only transaction-to-financing matching preview.
- Explicit allocation of a certification-environment credit to a synthetic Murabaha installment.
- Source transaction identity preservation and duplicate-allocation rejection.
- SAP HANA payment persistence and creation of a PENDING accounting event.

The verified allocation demonstrates a controlled connection between external banking transaction evidence and NHB financing servicing. It does not represent an actual customer repayment, automatic repayment classification, or production-certified financial processing.

The integration follows an anti-corruption architecture:

```text
NHB Business Service Contract
          ↓
NHB Provider Mapping and Integration Layer
          ↓
Fiserv Banking Hub / Finxact APIs
```

Fiserv identifiers and transaction attributes remain distinguishable from NHB-owned business identifiers and accounting decisions.

Provider transaction retrieval, matching, allocation, accounting-event creation, and SAP journal posting are separate operations with explicit responsibility boundaries.

Detailed certification evidence, limitations, and reconciliation findings are maintained in [Fiserv Integration](docs/fiserv-integration.md).

---

## ## SAP S/4HANA Accounting Integration

NHBCAP01 implements and has verified real SAP S/4HANA journal posting and reversal through the following integration architecture:

```text
NHBCAP01 — SAP CAP
        ↓
SAP BTP Destination Service
        ↓
SAP Integration Suite
        ↓
SAP Cloud Connector
        ↓
SAP S/4HANA 2025 — CAL Sandbox
```

The integration supports:

- `PAYMENT_RECEIVED` journal posting and `PAYMENT_REVERSED` reversal processing.
- SOAP message generation, SAP confirmation parsing, and accounting-document identity persistence.
- Business correlation propagation through SAP Integration Suite.
- Controlled connectivity to S/4HANA through SAP Cloud Connector.
- Restricted posting and reversal permissions for the dedicated integration user.
- Timeout handling and reconciliation of accounting outcomes against SAP evidence.

**Verified live SAP execution — 9 October 2026**

The following accounting documents were confirmed in S/4HANA, company code 1710, fiscal year 2026:

| SAP Document | Verification |
| --- | --- |
| `0100000060` | Journal posted; application event reconciled after timeout |
| `0100000061` | Journal posted and automatically confirmed |
| `0100000062` | Journal posted under restricted service authorization |
| `0100000063` | Reversal request processed; opposite accounting entries verified in FB03 |

The original document `0100000062` debited Petty Cash and credited External Payments Clearing for USD 100. The reversal document `0100000063` recorded the opposite entries.

**Remaining verification limitations**

- Formal SAP reversal linkage between documents `0100000062` and `0100000063` has not yet been independently confirmed.
- Historical application storage of document `0100000060` requires leading-zero and composite-identifier normalization.

The accounting accounts and configuration are synthetic sandbox mappings, not an approved production Murabaha accounting policy.

The previous controlled mock-receiver integration remains part of the regression and architecture evidence. The later CAL verification establishes real SAP system execution, but does not establish production certification, operational readiness, or regulatory compliance.

See [Integration Suite Runbook](docs/integration-suite-runbook.md) and [SAP Test Catalog](docs/sap-test-catalog.md) for implementation and verification details.

---

## Cloud Deployment

The CAP service has been deployed to SAP BTP Cloud Foundry.

The deployed application uses:

- Cloud Foundry
- SAP HANA / HDI
- XSUAA
- Destination Service

The exposed OData service requires authentication.

Observed behavior includes:

    Unauthenticated request → HTTP 401
    Authenticated Bearer request → successful service access

The deployed metadata exposes the governed Murabaha actions.

---

## Security and Cross-Cutting Architecture

The project includes an evolving cross-cutting architecture baseline covering:

- authentication
- authorization
- secret/configuration governance
- structured error handling
- correlation and observability
- outbound timeout policy
- retry and idempotency considerations
- auditability
- resilience

A shared outbound HTTP timeout mechanism is used across external integrations.

The current default timeout is configurable through environment configuration.

---

## Verification Evidence

The project uses regression scripts and unit/integration tests rather than relying only on interactive demonstrations.

### Murabaha servicing regression

Verified scenarios include:

- payment before activation rejected
- successful financing activation
- partial payment
- duplicate payment reference rejected
- overpayment rejected
- payment reversal
- duplicate reversal protection
- installment completion
- default transition
- payment while defaulted
- final settlement
- invalid reversal after settlement

The servicing regression has been verified both locally and against the deployed Cloud Foundry service.

### SAP accounting tests

The SAP accounting baseline includes tests for:

- SOAP request creation
- response mapping
- reversal request generation
- transport behavior
- accounting-event processing

The project maintains separate verification baselines for accounting integration, Murabaha servicing, and subsequent application changes.

| Verification baseline | Recorded result |
| --- | --- |
| SAP accounting regression | 44 PASS / 0 FAIL — earlier recorded baseline |
| Murabaha servicing/accounting regression | 15 PASS / 0 FAIL — earlier recorded baseline |
| October 10, 2026 validation | 81 tests passed across eight suites |
| Live SAP S/4HANA accounting | Posting and reversal execution verified October 9, 2026 |
| Production deployment and data preservation | Deployment successful; seven HANA collections verified unchanged October 10 |

These are distinct verification activities and should not be added together as one aggregate test count.

The implementation uses synthetic financing data and controlled integration environments. Successful validation does not establish production banking certification or complete historical data reconciliation.

---

## Information Architecture

Representative information objects include:

- Customer
- Customer Profile
- Product
- Product Offering
- Financing Application
- Credit Assessment
- Credit Decision
- Financing Agreement
- Financing
- Financing Schedule
- Financing Position
- Financing Collateral
- Repayment
- Repayment Obligation
- Collection Case
- Recovery Arrangement
- Recovery Action
- Payment Instruction

The Information Architecture represents business information meaning rather than physical database-table design.

Explicit system-of-record ownership is intentionally deferred until sufficient implementation evidence exists.

---

## Integration Architecture

The current EA repository contains selected Application Interactions such as:

- Customer Information Exchange for Credit Assessment
- Customer Information Exchange for Deposit Account Establishment
- Customer Information Exchange for Financing Origination
- Product Offering Exchange for Deposit Account Establishment
- Product Offering Exchange for Financing Origination

The SAP integration methodology is completed. The implemented SAP Integration Suite mediation baseline now provides concrete evidence for accounting-message mediation, NHB correlation propagation, controlled receiver handling, and repeatable regression verification.

The implemented baseline complements the existing CAP, Fiserv, and destination-based integration patterns. Broader modeling of Integration Interfaces, Integration Patterns, Integration Services, and explicit Integration Information Flows remains intentionally selective and will be expanded only where supported by concrete implementation requirements.

The original integration baseline used the controlled `mock-s4` receiver. On 9 October 2026, the integration was also verified against a real SAP S/4HANA 2025 CAL sandbox through SAP Cloud Connector.

---

## Technology Architecture

The logical technology baseline contains:

### Infrastructure Nodes

- NHB Application Hosting Environment
- NHB Data Hosting Environment
- NHB Integration Hosting Environment

### System Software

- NHB Application Runtime Platform
- NHB Database Management Platform
- NHB Integration Runtime Platform

### Technology Services

- NHB Application Hosting Service
- NHB Data Management Service
- NHB Integration Service
- NHB Technology Security Service

The logical Technology Architecture is now connected to verified implementation-realization evidence for:

- SAP BTP
- Cloud Foundry
- SAP CAP / Node.js
- SAP HANA / HDI
- XSUAA
- SAP Destination Service
- SAP Integration Suite mediation
- controlled SAP S/4HANA receiver simulation

Broader physical-technology realization mapping and additional AWS services remain future scope where further architectural evidence is justified.

---

## Technology Stack

| Area | Technology / Approach |
| --- | --- |
| Enterprise Architecture | Sparx Enterprise Architect |
| Process Modeling | SAP Signavio / BPMN |
| Application Framework | SAP CAP |
| Programming | Node.js / JavaScript |
| Domain Modeling | CDS / CDL |
| Query Model | CQN |
| Service Protocol | OData |
| Cloud Platform | SAP BTP |
| Runtime | Cloud Foundry |
| Cloud Persistence | SAP HANA / HDI |
| Authentication | XSUAA |
| Managed Connectivity | SAP Destination Service |
| External Banking Integration | Fiserv APIs |
| SAP Accounting Integration | SAP S/4HANA Journal Entry service pattern |
| Development Environment | SAP Business Application Studio |
| Version Control | Git |
| Enterprise Architecture Repository | Sparx `.xea` |

---

## Repository Structure

Representative project structure:

    NHBCAP01/
    │
    ├── app/
    │
    ├── db/
    │   └── schema.cds
    │
    ├── srv/
    │   ├── service.cds
    │   ├── service.js
    │   │
    │   ├── fiserv/
    │   │   ├── auth.js
    │   │   ├── accounts.js
    │   │   └── parties.js
    │   │
    │   ├── sap/
    │   │   └── transport.js
    │   │
    │   └── integration/
    │       ├── http.js
    │       └── setNhbCorrelationMpl.groovy
    │
    ├── mock-s4/
    │   └── server.js
    │
    ├── mock-temenos/
    │   └── server.js
    │
    ├── test/
    │   ├── integration-suite-accounting-fixture.sh
    │   ├── murabaha-lifecycle.sh
    │   ├── murabaha-lifecycle-negative.sh
    │   ├── murabaha-servicing.sh
    │   ├── murabaha-accounting.sh
    │   └── murabaha-exceptional-states.sh
    │
    ├── sap-accounting.test.js
    ├── sap-journal-entry-response.test.js
    ├── sap-journal-entry-reversal-soap.test.js
    ├── sap-journal-entry-soap.test.js
    ├── sap-transport.test.js
    │
    ├── docs/
    │   ├── architecture.md
    │   ├── ea-understanding-guide.md
    │   ├── ea-governance-baseline.md
    │   ├── fiserv-integration.md
    │   ├── integration-suite-runbook.md
    │   ├── islamic-banking-product-track.md
    │   └── sap-test-catalog.md
    │
    ├── package.json
    └── README.md

    ---

## Key Documentation

### `docs/architecture.md`

Detailed CAP, integration, SAP, Fiserv, security, resilience, and implementation architecture.

### `docs/ea-understanding-guide.md`

Enterprise architecture learning and repository-understanding guide covering:

- capabilities
- value streams
- outcomes
- business processes
- application architecture
- information architecture
- integration architecture
- technology architecture
- traceability
- repository-review findings

### `docs/ea-governance-baseline.md`

Defines the NHB architecture governance baseline, including:

- scope
- repository structure
- modeling conventions
- naming/versioning principles
- baseline and review rules

### `docs/fiserv-integration.md`

Documents the NHB-owned Fiserv integration abstraction, authentication, mapping, query, pagination, timeout, and error-handling approach.

### `docs/integration-suite-runbook.md`

Documents the verified SAP Integration Suite accounting mediation baseline, controlled fixture, correlation handling, mock S/4 receiver, and repeatable operational walkthrough.

### `docs/islamic-banking-product-track.md`

Tracks the Murabaha architecture and implementation journey from business architecture through CAP implementation and verification.

### `docs/sap-test-catalog.md`

Records the SAP accounting-integration test baseline and related evidence.

---

## Architecture Modeling Conventions — v1.0

The current NHB repository uses the following governed conventions.

### Application Service to Business Process

    Application Service
            → Serving →
    Business Process

### Application Component to Application Service

For the v1.0 baseline, NHB uses a controlled simplified convention:

    Application Component
            → Serving →
    Application Service

A stricter future realization chain may introduce Application Functions or Application Processes where justified.

### Business Process to Capability

    Business Process
            → Realization →
    Capability

### Application and Information

Application elements use:

    Access

relationships to relevant information objects.

The project favors semantically understandable traceability over adding architectural elements solely for structural completeness.

---

## Current Baseline Status

### Enterprise Architecture

**NHB Enterprise Architecture Baseline v1.0**

Completed baseline work includes:

- domain consistency review
- CD-03 Deposit Management correction
- collateral application-component clarification
- Business Process / Application Service direction review
- repository-wide Business-to-Application traceability review
- financing lifecycle clarification
- governance baseline
- naming and duplicate review
- application architecture review
- information architecture review
- integration architecture review
- technology architecture review
- cross-layer architecture views
- AV-03 — NHBCAP01 Architecture-to-Implementation Realization v1.0

### Application and Integration

Implemented and verified areas include:

- SAP CAP service implementation
- Murabaha lifecycle governance
- Murabaha servicing
- payment reversal
- accounting-event generation
- Fiserv integration
- SAP accounting transport and message baseline
- Cloud Foundry deployment
- XSUAA-protected access
- HANA / HDI persistence
- Destination Service integration support
- timeout and error-handling baseline
- SAP integration methodology
- SAP Integration Suite mediation verified against both the controlled mock receiver and the live SAP S/4HANA 2025 CAL system through Cloud Connector.
- Latest recorded validation: 81 tests passed across eight suites (10 October 2026). Earlier SAP and Murabaha regression baselines are documented separately.
- CAP internals first deep-understanding pass
- regression testing
- Verified live S/4HANA journal posting and reversal, including restricted service authorization.
- Verified Fiserv certification transaction retrieval, cursor pagination, and explicit allocation to a synthetic Murabaha installment.
- Verified HANA payment duplicate protection and optimistic concurrency safeguards in tested scenarios.
- Completed controlled reconstruction of 52 historical payment records, preserving original identifiers and available audit evidence.
- Verified October 10 deployment and preservation of all seven monitored HANA collections.

The current phase is final portfolio verification and reference-release preparation.

---

## Intentionally Deferred

- full system-of-record ownership modeling
- comprehensive Information Flow modeling
- exhaustive Integration Interface modeling
- Integration Pattern and Integration Service expansion
- physical Technology realization mapping
- expanded traceability-view presentation
- broader Information, Integration, and physical Technology modeling where additional evidence justifies it
- additional SAP or AWS tooling where it adds genuine architectural value
- formal SAP reversal-document linkage verification and historical accounting-document identity normalization
- resolution of two unsupported historical payment records referenced by reversals
- resolution of six historical installment reconciliation discrepancies

These items will be introduced when implementation evidence is sufficient to support defensible architectural relationships and technical claims.

---

## Next Phase

The current phase is final verification, portfolio documentation alignment, and preparation of the NHBCAP01 v1.0 reference release.

Following release, the verified baseline will be preserved while further work proceeds separately through structured learning and practical assignments covering BIAN, Sparx EA, SAP CAP, Cloud Foundry, and related integration technologies.

Additional experiments will not alter the frozen reference baseline without separate review and verification.

---

## Portfolio Principle

NHBCAP01 distinguishes explicitly between:

### Implemented and Verified Capability

Functionality that has been designed, implemented, tested, or deployed within the controlled project environment.

### Architecture Baseline

Logical architecture and governed repository relationships that describe the intended enterprise design.

### Target / Future Architecture

Capabilities or technology mappings that are intentionally deferred until appropriate implementation evidence or platform access becomes available.

This distinction is maintained throughout the project so that the architecture and implementation remain technically credible and interview-defensible.

---

## Scope and Disclaimer

NHBCAP01 is a learning, architecture, and portfolio project.

The project uses synthetic demonstration data and controlled integration environments. Real journal posting and reversal were verified in an SAP S/4HANA 2025 CAL sandbox. This demonstrates technical integration with an actual SAP system, not production deployment, formal certification, or an approved banking accounting design.

It does not claim:

- production banking readiness
- production Fiserv certification
- production SAP S/4HANA execution
- regulatory certification
- formal Sharia certification
- production security accreditation

Any production implementation would require additional work including:

- formal business and Sharia validation
- security architecture and authorization design
- concurrency and persistence hardening
- operational monitoring
- reconciliation
- audit controls
- performance testing
- disaster recovery
- regulatory review
- approved production-system integration

The purpose of NHBCAP01 is to demonstrate a traceable and technically defensible journey from enterprise architecture through implementation evidence.