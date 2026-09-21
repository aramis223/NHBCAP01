# NHBCAP01 — SAP CAP Integration Learning Project

## Overview

**NHBCAP01** is a hands-on SAP Cloud Application Programming Model (CAP) project created to develop and demonstrate practical skills in SAP BTP application development, OData services, SAPUI5/Fiori, and backend integration.

The project represents a simplified banking integration scenario in which **CAP acts as the application and orchestration layer** between NHB business applications and backend services.

The project is intentionally built incrementally: first with local persistence and CRUD operations, then with a controlled Temenos mock service, and later with SAP BTP deployment and cloud-based integrations.

---

## Objectives

The project has four main objectives:

1. Build a practical SAP CAP application using CDS, Node.js, CQN and OData.
2. Develop a Fiori/UI5 application consuming CAP services.
3. Learn how CAP integrates with external OData services such as Temenos.
4. Establish a foundation for a future SAP BTP integration architecture connecting banking systems and enterprise applications through APIs and services.

---

## Architecture

The current logical architecture is:

```text
                    NHB Customer UI
                          |
                          | OData
                          v
                 +-------------------+
                 |    SAP CAP        |
                 |  NHBCAP01Service  |
                 +-------------------+
                    |             |
              Local DB          OData
                    |             |
                    v             v
             NHB Domain      Temenos Service
               Model          / Mock API
```

CAP is used as the application/runtime layer rather than allowing the UI to communicate directly with backend databases.

The intended future architecture extends this model to include SAP enterprise applications such as SAP S/4HANA through supported APIs and BTP integration mechanisms.

---

## Current Implementation

### CAP application

The project currently includes:

* CDS domain modeling
* Local SQLite persistence for development
* CAP service definitions
* CAP service projections
* Node.js service handlers
* CQN-based database and remote-service queries
* OData service exposure
* Error handling with `try/catch`
* Validation of customer creation requests

### Customer and Account model

The current domain model contains:

* `Customer`
* `Account`

A customer can have multiple accounts.

Technical UUIDs are separated from business identifiers such as `CustomerNumber`.

### Fiori/UI5

A SAPUI5 customer application has been developed with:

* Customer list/read
* Customer creation
* Customer update
* Customer deletion
* Customer/account data access
* OData integration with the CAP service

---

## Temenos Integration

A controlled mock Temenos service is used because a production Temenos environment is not available for unrestricted development.

The project demonstrates CAP consuming an external OData service through a configured remote service:

```text
CAP
 |
 | OData
 v
TemenosCustomerService
 |
 v
Mock Temenos API
```

The CAP service maps the external Temenos customer representation to the NHB-facing service representation.

For example:

```text
Temenos                     NHB CAP Service
-------                     ---------------
customerId       ------->   CustomerNumber
name             ------->   Name
customerType     ------->   CustomerType
```

The project also demonstrates transformation of an NHB-facing OData filter into the corresponding Temenos field representation.

For example:

```text
NHB request

$filter=CustomerType eq 'Corporate'

            |
            v

CAP transformation

customerType eq 'Corporate'

            |
            v

Temenos OData service
```

This illustrates an important integration principle: **the CAP service contract does not have to expose the backend system's internal naming directly.**

---

## Target Integration Architecture

The current project is a learning and prototype environment.

The target architecture is intended to evolve toward:

```text
                  NHB Applications
                         |
                         v
                 SAP BTP / CAP
                         |
              +----------+----------+
              |                     |
              v                     v
        Temenos APIs          SAP S/4HANA APIs
              |                     |
              v                     v
        Core Banking          Enterprise Systems
```

In the target architecture, CAP will orchestrate application-level interactions through APIs and services.

CAP is **not intended to connect directly to SAP S/4HANA or Temenos databases**.

---

## Technology Stack

| Area                    | Technology                      |
| ----------------------- | ------------------------------- |
| Application framework   | SAP CAP                         |
| Programming language    | Node.js / JavaScript            |
| Data modeling           | CDS / CDL                       |
| Query language          | CQN                             |
| Service protocol        | OData                           |
| Frontend                | SAPUI5 / Fiori                  |
| Local database          | SQLite                          |
| Cloud database target   | SAP HANA                        |
| Cloud platform          | SAP BTP                         |
| External banking system | Temenos                         |
| Development environment | SAP Business Application Studio |
| Version control         | Git                             |

---

## Project Structure

```text
NHBCAP01/
│
├── app/
│   └── customer-ui/          # SAPUI5 customer application
│
├── db/
│   ├── schema.cds            # Domain model
│   └── data/                 # Development seed data
│
├── srv/
│   ├── service.cds           # CAP service definition
│   ├── service.js            # Service implementation
│   └── external/
│       └── temenos.cds       # External Temenos service model
│
├── mock-temenos/
│   └── server.js             # Controlled Temenos mock service
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

## Learning Focus

The project is also used as a structured learning environment for:

* CDS and domain modeling
* Associations and projections
* CAP services
* Node.js service implementation
* CQN
* OData query processing
* OData `$filter`
* External service consumption
* Error handling
* Fiori/UI5 integration
* SAP BTP deployment
* Destinations and authentication
* Enterprise integration patterns

The implementation is documented progressively so that the project can be explained and defended technically rather than functioning only as a demonstration.

---

## Current Status

### Completed

* CAP project foundation
* Customer and Account domain model
* Local persistence
* Fiori customer application
* Customer CRUD operations
* Validation and error handling
* Mock Temenos service
* CAP-to-Temenos OData integration
* Customer field mapping
* OData filter transformation
* Git repository initialization

### Next

* Structured technical documentation
* SAP BTP deployment
* BTP destination configuration
* Cloud authentication and authorization
* Cloud-based Temenos integration
* SAP S/4HANA API integration using a controlled/mock environment
* Target integration architecture refinement

---

## Portfolio Principle

NHBCAP01 distinguishes clearly between:

**Implemented capabilities** — functionality that has been developed and tested in the project.

**Target architecture** — capabilities intended for the future SAP BTP/SAP S/4HANA integration landscape.

This distinction is maintained throughout the documentation to ensure that the project remains technically credible and interview-defensible.


## Murabaha portfolio demonstration

This project demonstrates a traceable path from enterprise design to a working application: Sparx Enterprise Architect records capabilities, value streams and application relationships; the Signavio BPMN model describes the Murabaha operating process; CAP implements the financing, installment and payment controls; and the Fiori preview provides an interactive proof. The cross-reference and evidence register are in [Islamic banking product track](docs/islamic-banking-product-track.md).

### What is implemented

- Murabaha financing, installment and payment entities, with synthetic demonstration data.
- Evidence fields and lifecycle checks for credit decision, Sharia approval, asset acquisition/bank ownership, sale contract and delivery.
- Payment-posting actions with duplicate external-reference and overpayment safeguards; installment balances and status update after a valid payment.
- A Fiori preview action for posting a payment against an installment.

### Verified walkthrough

In the controlled local demo, a USD 1,000 payment with reference `TEST-PAY-20260920-001` was posted to installment 2. The installment showed `paidAmount` of USD 1,000 and status `PARTIALLY_PAID`. Reusing the external reference and attempting a USD 11,000 overpayment were both rejected without changing the balance. These are demo observations, not a claim of production readiness or exhaustive testing.

For a short interview demonstration: (1) show the Sparx-to-Signavio-to-CAP traceability matrix; (2) explain the BPMN controls before disbursement and sale; (3) open the Fiori installment and post a valid payment; (4) show the duplicate-reference and overpayment rejections; (5) explain the remaining integration and assurance work.

### Scope and next steps

The data and transactions here are synthetic. No live bank ledger, SAP S/4HANA, Finxact, or Temenos production integration is claimed. Those systems are target architecture or mock-integration context, as detailed in the project documentation. Before any production use, the solution would need security and authorization design, persistence and concurrency hardening, comprehensive automated tests, audit and reconciliation controls, formal Sharia/business validation, and approved system integrations.
