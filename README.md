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

The project is intentionally developed as a learning and portfolio environment rather than presented as a production banking platform. The current phase is portfolio packaging and polish.

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

## External Banking Integration — Fiserv

Fiserv integration is implemented behind an NHB-owned service abstraction.

Representative integration capabilities include:

- party/customer retrieval
- customer-list retrieval
- account-detail retrieval
- OAuth authentication
- provider-response mapping
- OData query handling
- pagination
- timeout handling
- provider-independent error handling

The architecture follows an anti-corruption principle:

    NHB Service Contract
            ↓
    NHB Mapping / Integration Layer
            ↓
    Fiserv API Contract

Provider-specific fields are not treated automatically as NHB domain semantics.

External provider indicators and identifiers are interpreted through explicit mapping logic rather than exposed directly to consuming applications.

---

## SAP S/4HANA Accounting Integration

NHBCAP01 contains an accounting-integration baseline for SAP S/4HANA Journal Entry processing.

The implemented design includes:

- Journal Entry SOAP request generation
- Journal Entry response mapping
- Journal Entry reversal request generation
- Destination-based transport support
- timeout handling
- accounting-event persistence
- external accounting-document identity fields
- posting-status tracking

Representative accounting events include:

    PAYMENT_RECEIVED
    PAYMENT_REVERSED

The project distinguishes clearly between:

- tested integration contracts and transport logic
- configured destination connectivity
- actual live SAP accounting execution

The SAP integration methodology is completed, and the SAP Integration Suite mediation baseline is implemented and verified. The controlled flow includes correlation propagation through `srv/integration/setNhbCorrelationMpl.groovy`, fixture-driven execution through `test/integration-suite-accounting-fixture.sh`, and delivery to the `mock-s4` receiver.

The current SAP S/4HANA receiver is a controlled mock endpoint. Live production-equivalent SAP execution is not claimed until an appropriate SAP S/4HANA environment and communication arrangement are available.

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

The verified test baseline includes:

    SAP accounting suite:
    44 PASS / 0 FAIL

    Murabaha servicing/accounting regression:
    14 PASS / 0 FAIL

These results represent the controlled project environment and are not presented as production certification.

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

The current S/4 receiver is the controlled `mock-s4` endpoint; this is not a claim of live SAP S/4HANA execution.

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

Broader physical-technology realization mapping, live SAP S/4HANA connectivity, and selected AWS services remain future scope where additional evidence is justified.

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
- SAP Integration Suite mediation baseline, implemented and verified against a controlled mock S/4 receiver
- SAP accounting regression baseline: **44 PASS / 0 FAIL**
- CAP internals first deep-understanding pass
- regression testing

The current phase is portfolio packaging and polish.

---

## Intentionally Deferred

The following are intentionally deferred rather than treated as missing baseline work:

- full system-of-record ownership modeling
- comprehensive Information Flow modeling
- exhaustive Integration Interface modeling
- Integration Pattern and Integration Service expansion
- physical Technology realization mapping
- expanded traceability-view presentation
- broader Information, Integration, and physical Technology modeling where additional evidence justifies it
- additional SAP or AWS tooling where it adds genuine architectural value
- live SAP S/4HANA accounting execution where environment access is required

These items will be introduced when implementation evidence is sufficient to support defensible architectural relationships and technical claims.

---

## Next Phase

The current project phase is **portfolio packaging and polish**.

Current priorities include:

1. consolidating the completed AV-03 v1.0 realization evidence
2. polishing repository navigation, diagrams, runbooks, and cross-references
3. refining the repeatable demonstration and interview narrative
4. preserving the controlled evidence boundary around the mock S/4 receiver
5. defining prerequisites and acceptance criteria for any future live-system validation

The project will continue to prefer a small number of meaningful, end-to-end implementations over superficial use of many technologies.

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

The project uses synthetic demonstration data and controlled integration environments.

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