# NHBCAP01 — Architecture

## 1. Purpose

NHBCAP01 is a hands-on SAP Cloud Application Programming Model (CAP) application developed to explore application architecture, service development, persistence, frontend integration, and external OData service integration in a banking context.

The project uses a simplified NHB banking scenario to demonstrate how SAP CAP can act as an application and integration/orchestration layer between user-facing applications and backend services.

This document describes the **current implemented architecture** and distinguishes it from the future target architecture.

---

## 2. Architecture Principles

The project follows these principles:

### 2.1 Service-oriented integration

Applications communicate with backend capabilities through services and APIs rather than direct database access.

### 2.2 Separation of concerns

The project separates:

* Domain/data modeling
* Service contracts
* Service implementation
* Frontend applications
* External service definitions
* Integration logic

### 2.3 CAP as an application/runtime layer

CAP is responsible for exposing business services and orchestrating interactions with external services.

CAP does not directly access the Temenos or SAP S/4HANA databases.

### 2.4 External system abstraction

External systems have their own service contracts and data representations.

The NHB-facing CAP service can transform or map those representations instead of exposing backend-specific structures directly to consumers.

### 2.5 Current state vs target state

The project clearly distinguishes functionality that has been implemented and tested from architecture that is planned for future development.

---

# 3. Current Architecture

The current implementation can be represented as follows:

```text
                         NHB Customer UI
                              |
                              | OData
                              v
                    +----------------------+
                    |      SAP CAP         |
                    |      NHBCAP01        |
                    |                      |
                    |  Service Layer       |
                    |  Node.js Handlers    |
                    +----------+-----------+
                               |
                    +----------+----------+
                    |                     |
                    v                     v
             Local Persistence      Temenos OData
                    |                     |
                    v                     v
              SQLite Database      Mock Temenos API
```

The architecture contains four principal areas:

1. SAPUI5/Fiori frontend
2. SAP CAP application
3. Local persistence
4. External Temenos OData service

---

# 4. Frontend Layer

The project contains a SAPUI5 customer application under:

```text
app/customer-ui/
```

The frontend communicates with the CAP service through OData.

The frontend does not directly access the local database or the Temenos service.

This establishes the following boundary:

```text
SAPUI5
   |
   | OData
   v
CAP Service
```

The UI currently supports customer-oriented operations including:

* Read
* Create
* Update
* Delete

The application also supports access to customer/account information through the CAP service.

---

# 5. Domain and Persistence Layer

The local domain model is defined in:

```text
db/schema.cds
```

The current domain contains:

```text
Customer
   |
   | 1 : many
   v
Account
```

The `Customer` entity contains:

* Technical UUID
* Customer Number
* Name
* Customer Type

The `Account` entity contains:

* Technical UUID
* Association to Customer

The technical UUID is separate from the business identifier `CustomerNumber`.

This distinction allows the application to maintain a technical persistence key while exposing a meaningful business identifier.

Development data is maintained under:

```text
db/data/
```

SQLite is currently used for local development.

The project also includes the SAP HANA dependency for future BTP/cloud deployment.

---

# 6. Service Layer

The main CAP service is defined in:

```text
srv/service.cds
```

The service is exposed as:

```text
/service/NHBCAP01Service
```

The service contains projections of the local domain entities:

```text
db/schema.cds
       |
       v
CAP projections
       |
       v
NHBCAP01Service
```

This means the service contract is not simply an unrestricted exposure of the persistence model.

The service also defines NHB-facing and Temenos-related entities used by the integration logic.

---

# 7. Service Implementation

Service implementation is contained in:

```text
srv/service.js
```

The implementation uses Node.js and CAP service handlers.

Current responsibilities include:

* Customer creation validation
* Duplicate customer-number checking
* Reading NHB customer information
* Calling the remote Temenos service
* Mapping Temenos data to the NHB service representation
* Reading Temenos account information
* Handling remote-service errors

The implementation uses CAP's CQN APIs for querying local and remote services.

---

# 8. External Temenos Service

The external Temenos service is defined in:

```text
srv/external/temenos.cds
```

The CAP application connects to the external service through the configured CAP requirement:

```text
TemenosCustomerService
```

The application obtains the connection through:

```text
cds.connect.to('TemenosCustomerService')
```

The current development environment uses a controlled mock Temenos service rather than a production Temenos environment.

The mock service is located under:

```text
mock-temenos/
```

and exposes an OData service representing simplified Temenos customer and account data.

---

# 9. Data Representation Boundaries

An important architectural characteristic of NHBCAP01 is that the different layers do not have to use identical data representations.

The current flow is approximately:

```text
Temenos
   |
   | customerId
   | name
   | customerType
   v
CAP Integration Logic
   |
   | mapping
   v
NHB Service Representation
   |
   | CustomerNumber
   | Name
   | CustomerType
   v
NHB Consumer
```

For example:

```text
Temenos customerId
        |
        v
NHB CustomerNumber
```

This provides an abstraction boundary between the NHB service contract and the external Temenos representation.

---

# 10. Integration Flow

A simplified Temenos customer read flow is:

```text
NHB Customer UI
       |
       | OData READ
       v
NHBCAP01Service
       |
       v
service.js
       |
       | CQN
       v
TemenosCustomerService
       |
       | OData
       v
Mock Temenos API
       |
       v
Customer data
       |
       v
CAP mapping
       |
       v
NHB Customer response
```

The CAP runtime therefore acts as the intermediary between the consumer and the external banking service.

---

# 11. Query Transformation

The integration layer can translate an NHB-facing query into the corresponding Temenos query representation.

For example:

```text
NHB consumer request

$filter=CustomerType eq 'Corporate'

            |
            v

CAP integration logic

customerType eq 'Corporate'

            |
            v

Temenos OData service
```

This is important because external systems may use different field names or service contracts.

The CAP layer can therefore provide a stable NHB-facing interface while adapting requests to backend-specific representations.

The detailed implementation and current limitations are documented separately in:

```text
docs/temenos-integration.md
```

---

# 12. Error Handling

Remote Temenos read operations are protected with `try/catch` handling.

When the remote service cannot be accessed, the CAP service returns an appropriate service error rather than exposing the raw backend failure to the consumer.

The current implementation uses HTTP status `502` for remote-service failures.

This reflects the architectural interpretation that the CAP service is acting as an intermediary and the requested backend service is unavailable.

---

# 13. Current vs Target Architecture

### Current

```text
NHB UI
  |
  v
CAP
  |
  +----> SQLite
  |
  +----> Mock Temenos OData
```

### Target

```text
                    NHB Applications
                           |
                           v
                    SAP BTP / CAP
                           |
             +-------------+-------------+
             |                           |
             v                           v
       Temenos APIs                SAP S/4HANA APIs
             |                           |
             v                           v
       Core Banking              Enterprise Systems
```

The target architecture will use supported application APIs and BTP integration mechanisms.

It will not rely on direct database-to-database integration.

---

# 14. Target SAP S/4HANA Integration

A real SAP S/4HANA system is not currently connected to NHBCAP01.

The target architecture is to integrate SAP S/4HANA through supported APIs and services.

Potential future integration areas include enterprise capabilities such as:

* Finance
* Accounting
* Procurement
* Controlling
* Other enterprise services required by the NHB architecture

The implementation will use controlled APIs or mock services where a real S/4HANA environment is unavailable.

The project documentation will explicitly distinguish these target capabilities from implemented functionality.

---

# 15. Key Architecture Decisions

| Decision                                       | Rationale                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| CAP is the application/integration layer       | Provides service exposure, business logic and orchestration      |
| UI communicates through CAP                    | Prevents direct coupling between UI and backend systems          |
| External Temenos service has its own model     | Preserves the external service contract                          |
| NHB-facing service representation is separate  | Allows backend abstraction and mapping                           |
| Technical UUID is separate from CustomerNumber | Separates persistence identity from business identity            |
| CQN is used for service queries                | Uses CAP's native query abstraction                              |
| Mock Temenos service is used                   | Enables realistic integration learning without production access |
| SQLite is used locally                         | Provides lightweight development persistence                     |
| SAP S/4HANA is a target integration            | No real S/4HANA environment is currently available               |

---

# 16. Known Limitations

The current implementation is intentionally a learning/prototype baseline.

Known limitations include:

* Temenos is represented by a mock service.
* Local SQLite is used for development.
* Cloud deployment has not yet been completed.
* BTP destinations and cloud authentication have not yet been configured.
* SAP S/4HANA integration has not yet been implemented.
* Current OData filter parsing is intentionally simple and does not yet support complex filter expressions.
* Production-grade security, monitoring and resilience patterns remain future work.

These limitations are documented rather than hidden because the objective is to maintain an accurate and technically defensible portfolio project.

---

# 17. Next Architecture Steps

The next technical architecture activities are:

1. Document the Temenos integration in detail.
2. Configure SAP BTP deployment.
3. Configure BTP destinations.
4. Establish appropriate authentication and authorization.
5. Test the CAP application in the BTP environment.
6. Introduce a controlled SAP S/4HANA API/mock integration.
7. Refine the target SAP–Temenos–CAP integration architecture.

---

## Summary

NHBCAP01 demonstrates a layered application architecture in which:

```text
UI
 |
 v
CAP Service
 |
 +---- Local Domain / Persistence
 |
 +---- External OData Services
```

CAP provides the service and orchestration boundary between NHB consumers and backend systems.

The architecture is deliberately designed so that backend-specific details can be adapted inside the integration layer while consumers interact with an NHB-oriented service contract.

The current implementation provides the foundation for progressing from local CAP development to SAP BTP deployment and broader enterprise integration.
