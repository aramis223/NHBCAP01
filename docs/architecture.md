# NHBCAP01 — Architecture

## 1. Purpose

NHBCAP01 is a hands-on SAP Cloud Application Programming Model (CAP) application developed to explore application architecture, service development, persistence, frontend integration, external banking API integration, SAP BTP deployment, and enterprise architecture patterns in a banking context.

The project uses a simplified NHB banking scenario to demonstrate how SAP CAP can act as an application, integration, and orchestration layer between user-facing applications, NHB business services, external banking platforms, and future SAP enterprise services.

This document describes the **current implemented architecture** and distinguishes it from capabilities planned for future development.

---

## 2. Architecture Principles

### 2.1 Service-oriented integration

Applications communicate with backend capabilities through services and APIs rather than through direct database access.

### 2.2 Separation of concerns

The project separates:

- Domain and data modeling
- Persistence
- Service contracts
- Service implementation
- Frontend applications
- External API clients
- Authentication
- Integration and mapping logic
- Platform configuration

### 2.3 CAP as the application and orchestration layer

CAP exposes NHB business services and orchestrates interactions with persistence and external platforms.

CAP does not directly access external core-banking or SAP S/4HANA databases.

### 2.4 External-system abstraction

External systems retain their own API contracts and provider-specific representations.

NHB CAP maps those representations into NHB-oriented service contracts instead of exposing external provider structures directly to consumers.

The architectural principle is:

```text
NHB Business Contract
        ↑
        │
    CAP Mapping
        ↑
        │
External Provider Contract
```

### 2.5 Current state vs target state

Implemented and tested capabilities are explicitly distinguished from future architecture.

Documentation must not describe planned functionality as already implemented.

### 2.6 Security boundaries

Consumer authentication and external-provider authentication are separate concerns.

The deployed architecture therefore supports two distinct security boundaries:

```text
Consumer
   │
   │ XSUAA
   ▼
NHB CAP
   │
   │ Fiserv OAuth 2.0
   ▼
Fiserv Banking Hub / Finxact
```

Credentials and access tokens are not stored in application source code or Git.

---

# 3. Current Architecture

The current architecture is:

```text
                         NHB Consumer / UI
                                │
                                │ OData
                                ▼
                    ┌─────────────────────────┐
                    │       NHB CAP           │
                    │       NHBCAP01          │
                    │                         │
                    │ Service Contracts       │
                    │ Node.js Handlers        │
                    │ Integration Mapping     │
                    └───────────┬─────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
          NHB Persistence                Fiserv Client
        SQLite / SAP HANA               OAuth + REST/JSON
                                               │
                                               ▼
                                      Fiserv Banking Hub
                                               │
                                               ▼
                                            Finxact
```

The architecture contains five principal areas:

1. SAPUI5/Fiori frontend
2. SAP CAP application and service layer
3. NHB domain and persistence layer
4. Fiserv integration client
5. Fiserv Banking Hub / Finxact external banking platform

The application operates locally with SQLite during development and has also been deployed to SAP BTP Cloud Foundry with SAP HANA HDI persistence and XSUAA authentication.

---

# 4. Frontend Layer

The project contains an SAPUI5/Fiori customer application under:

```text
app/customer-ui/
```

The frontend communicates with the CAP service through OData.

The frontend does not directly access persistence or external banking APIs.

The boundary is:

```text
SAPUI5 / Fiori
      │
      │ OData
      ▼
CAP Service
```

The customer application has been used to exercise customer-oriented CRUD operations through CAP.

The frontend remains decoupled from external banking-provider contracts.

---

# 5. Domain and Persistence Layer

The local domain model is defined in:

```text
db/schema.cds
```

The original learning model includes:

```text
Customer
   │
   │ 1 : many
   ▼
Account
```

The `Customer` entity separates the technical UUID from the business identifier `CustomerNumber`.

This allows persistence identity and business identity to evolve independently.

The project has subsequently introduced Murabaha financing-domain entities, including:

```text
MurabahaFinancing
MurabahaInstallment
MurabahaPayment
MurabahaPaymentReversal
```

Development data is maintained under:

```text
db/data/
```

### Local development

Local CAP development uses SQLite in-memory persistence.

### SAP BTP

The Cloud Foundry deployment uses SAP HANA HDI through the configured HANA service binding.

This establishes a clear separation between lightweight local development persistence and cloud persistence.

---

# 6. Service Layer

The main CAP service is defined in:

```text
srv/service.cds
```

and exposed under:

```text
/service/NHBCAP01Service
```

The service exposes NHB-oriented entities, projections, types, functions, and actions.

The service contract is not simply an unrestricted exposure of the persistence model.

It represents the API boundary owned by NHB.

The service includes the Fiserv account response contract:

```text
FiservAccount
├── accountId
├── accountType
├── description
├── currency
├── accountTitle
├── openDate
├── status
└── balances[]
```

and exposes:

```text
getFiservAccountDetails(accountId)
```

This function provides an NHB-facing operation while hiding the underlying Finxact response structure.

---

# 7. Service Implementation

The main implementation is contained in:

```text
srv/service.js
```

The implementation uses Node.js and CAP service handlers.

Responsibilities include:

- Customer validation
- Duplicate customer-number checking
- Murabaha business operations
- Calling the Fiserv integration client
- Mapping Finxact responses into NHB contracts
- Validating input
- Handling external-provider failures
- Returning controlled CAP/OData responses

Provider-specific connectivity is separated from the main service implementation.

Fiserv connectivity is implemented under:

```text
srv/fiserv/
├── auth.js
└── accounts.js
```

This separation keeps authentication and provider-specific request construction outside the primary NHB business-service logic.

---

# 8. Fiserv Banking Hub / Finxact Integration

Fiserv Banking Hub / Finxact is the active external core-banking integration target for NHBCAP01.

The previous Temenos learning integration has been retired from the active implementation.

The Fiserv integration uses:

- REST
- JSON
- OAuth 2.0 Client Credentials
- Bearer authentication
- Fiserv `EFXHeader`
- Finxact Account Service

The implemented flow is:

```text
NHBCAP01Service
      │
      ▼
service.js
      │
      ▼
srv/fiserv/accounts.js
      │
      ├──────────────► srv/fiserv/auth.js
      │                       │
      │                       ▼
      │                Fiserv OAuth
      │                       │
      │◄──────────── access_token
      │
      ▼
Fiserv Banking Hub
      │
      ▼
Finxact Account Service
      │
      ▼
Get Account Details
```

The current operation is read-only.

Transactional banking operations have deliberately not yet been introduced.

Detailed implementation information is maintained in:

```text
docs/fiserv-integration.md
```

---

# 9. Data Representation Boundaries

The NHB service contract and the Fiserv provider contract intentionally use different representations.

Fiserv/Finxact returns structures such as:

```text
AcctRec
AcctKeys
DepositAcctInfo
AcctBal
CurAmt
AcctStatus
```

CAP maps these into:

```text
FiservAccount
```

For example:

```text
Finxact AcctRec
       │
       ▼
CAP Integration Mapping
       │
       ▼
NHB FiservAccount
       │
       ▼
NHB Consumer
```

This prevents provider-specific data structures from becoming part of the NHB public service contract.

It also establishes an anti-corruption/abstraction boundary between NHB and the external banking platform.

---

# 10. Integration Flow

The successfully tested account-details flow is:

```text
NHB Consumer
     │
     │ OData
     ▼
NHBCAP01Service
     │
     ▼
getFiservAccountDetails(accountId)
     │
     ▼
service.js
     │
     ▼
Fiserv Account Client
     │
     ├── Obtain OAuth token
     │
     ▼
Fiserv Banking Hub
     │
     ▼
Finxact
     │
     ▼
Account Details
     │
     ▼
CAP Mapping
     │
     ▼
NHB FiservAccount Response
```

The local end-to-end test successfully returned:

```text
HTTP 200 OK
```

with an NHB-mapped DDA account response.

This proves the complete local path:

```text
CAP
 ↓
OAuth
 ↓
Fiserv Banking Hub
 ↓
Finxact
 ↓
CAP Mapping
 ↓
NHB OData Response
```

---

# 11. Request and Response Transformation

CAP acts as the translation boundary between NHB consumers and provider-specific APIs.

For the current Get Account Details implementation, an NHB account identifier is transformed into the Finxact account-selection request:

```text
NHB accountId
      │
      ▼
CAP Fiserv Client
      │
      ▼
AcctSel
 └── AcctKeys
      ├── AcctId
      └── AcctType = DDA
```

The provider response is then transformed back into the NHB `FiservAccount` contract.

The consumer therefore does not need knowledge of:

- `AcctRec`
- `DepositAcctInfo`
- `AcctBal`
- Fiserv authentication
- `EFXHeader`
- Finxact provider structures

This preserves a stable NHB-facing interface.

---

# 12. Error Handling

External Fiserv calls are protected by controlled error handling.

The integration distinguishes several failure categories:

```text
Input validation failure
OAuth failure
HTTP/API failure
Fiserv application response
Test-data/business lookup failure
```

For example, testing with an incorrect account identifier resulted in a Fiserv response indicating:

```text
StatusCode: 1121
No Records Found
Account not found
```

This demonstrated that OAuth, network connectivity, and the Banking Hub request were functioning even though the requested test account was incorrect.

After correcting the account identifier, the same integration returned HTTP 200.

The CAP service currently converts external integration failures into controlled service responses rather than exposing raw provider errors directly to consumers.

Further refinement of provider-error mapping remains future work.

---

# 13. SAP BTP Cloud Foundry Deployment

NHBCAP01 has been deployed to SAP BTP Cloud Foundry.

The deployed runtime includes:

```text
NHBCAP01-srv
      │
      ├── SAP HANA HDI
      ├── XSUAA
      └── Destination Service
```

The application is running successfully in Cloud Foundry.

### Persistence

The deployed service is bound to the NHB HANA HDI container.

### Authentication

Production CAP authentication uses XSUAA/JWT.

An unauthenticated request correctly returned HTTP 401.

A valid OAuth/JWT token was then obtained through XSUAA and used to call the deployed CAP OData service successfully.

The authenticated request returned HTTP 200.

This validates:

```text
External Consumer
       │
       │ JWT
       ▼
SAP XSUAA
       │
       ▼
NHBCAP01-srv
       │
       ▼
CAP OData Service
```

### Destination Service

The application is also bound to the SAP BTP Destination service.

The binding was refreshed after credential rotation during deployment validation.

The current Fiserv client uses runtime configuration for its external API connectivity; future architecture may determine whether additional Destination-service mediation is appropriate.

---

# 14. Current vs Target Architecture

## Current verified architecture

```text
                         NHB Consumer
                              │
                              ▼
                         NHB CAP
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             NHB Persistence       Fiserv Client
            SQLite / HANA HDI           │
                                        │ OAuth 2.0
                                        ▼
                               Fiserv Banking Hub
                                        │
                                        ▼
                                     Finxact
```

The following have been individually verified:

- Local CAP runtime
- SQLite development persistence
- HANA HDI cloud binding
- XSUAA-protected deployed CAP service
- Authenticated deployed OData access
- Fiserv OAuth
- CAP-to-Fiserv local integration
- Finxact Get Account Details
- Provider-to-NHB response transformation

## Target architecture

```text
                       NHB Applications
                              │
                              ▼
                     SAP BTP / NHB CAP
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
       Fiserv Banking Hub            SAP APIs
                 │                         │
                 ▼                         ▼
              Finxact                 SAP S/4HANA
         Core Banking              Enterprise Services
```

The target architecture uses supported APIs and controlled service boundaries.

It does not rely on direct database-to-database integration.

---

# 15. Target SAP S/4HANA Integration

SAP S/4HANA integration remains a target capability.

The intended approach is to integrate through supported SAP APIs and services rather than direct database access.

Potential integration areas include:

- Finance
- Accounting
- Business Partner
- Cash-flow and liquidity-related capabilities
- Procurement
- Controlling
- Other enterprise services required by the NHB architecture

The project will explicitly distinguish actual implemented SAP integration from target architecture until end-to-end API calls have been demonstrated.

---

# 16. Key Architecture Decisions

| Decision | Rationale |
| --- | --- |
| CAP is the application/integration layer | Provides service exposure, business logic, mapping and orchestration |
| UI communicates through CAP | Prevents direct coupling between UI and backend systems |
| Fiserv/Finxact retains its own API contract | Preserves external-provider boundaries |
| NHB-facing contracts are provider-independent | Prevents provider structures from leaking into NHB consumers |
| Fiserv connectivity is isolated under `srv/fiserv/` | Separates provider connectivity from NHB business-service logic |
| OAuth credentials remain outside source code | Protects secrets and supports runtime configuration |
| Technical UUID is separate from business identifiers | Separates persistence identity from business identity |
| SQLite is used for local development | Provides lightweight development persistence |
| HANA HDI is used for BTP persistence | Provides SAP-managed cloud persistence |
| XSUAA protects the deployed CAP service | Establishes the consumer-to-CAP authentication boundary |
| Fiserv OAuth protects CAP-to-Fiserv calls | Establishes a separate provider security boundary |
| SAP S/4HANA is a target integration | Keeps SAP enterprise integration separate from the verified Fiserv baseline |

---

# 17. Known Limitations

NHBCAP01 remains a learning and portfolio architecture rather than a production banking platform.

Current limitations include:

- The Fiserv integration currently covers only a small subset of the available APIs.
- Get Account Details is the first implemented Finxact operation.
- Fiserv integration is currently read-only.
- Provider error mapping can be refined further.
- Resilience patterns such as retries, circuit breakers, and production observability have not yet been implemented.
- Secret management can be strengthened as the deployment architecture matures.
- SAP S/4HANA integration has not yet been implemented end-to-end.
- `NHBCustomer` remains an NHB-facing abstraction and is not currently backed by a replacement Fiserv Accountholder implementation.
- Production-grade authorization design remains future work.
- The deployed CAP → Fiserv end-to-end Cloud Foundry call still requires final validation.

These limitations are explicitly documented to keep the architecture technically defensible and distinguish implemented capability from target design.

---

# 18. Next Architecture Steps

The next architecture activities are:

1. Validate the deployed **Cloud Foundry CAP → Fiserv Banking Hub → Finxact** call.
2. Record the successful deployed integration as a new technical baseline.
3. Review runtime secret-management and external-service configuration.
4. Evaluate the next appropriate Fiserv API, particularly Accountholder/customer capabilities.
5. Determine how `NHBCustomer` should be backed by Fiserv without exposing provider-specific structures.
6. Continue the Murabaha product/service track.
7. Introduce controlled SAP S/4HANA API integration when the SAP environment is available.
8. Extend observability, resilience, authorization, and error-mapping patterns as the prototype matures.

---

## Summary

NHBCAP01 now demonstrates a layered banking application and integration architecture:

```text
NHB Consumer / UI
        │
        ▼
    NHB CAP
     /    \
    /      \
   ▼        ▼
NHB Data   External APIs
   │            │
   ▼            ▼
SQLite/HANA   Fiserv Banking Hub
                   │
                   ▼
                Finxact
```

CAP owns the NHB service boundary, business logic, integration mapping, and orchestration.

Fiserv Banking Hub / Finxact owns the external banking-provider API and account-processing capability.

SAP BTP provides the deployed CAP runtime, HANA persistence, XSUAA authentication, and supporting cloud services.

The architecture deliberately prevents NHB consumers from becoming directly coupled to external-provider data structures.

The next major proof point is the deployed Cloud Foundry end-to-end path:

```text
Authenticated Consumer
        ↓
SAP BTP / XSUAA
        ↓
NHBCAP01-srv
        ↓
Fiserv OAuth
        ↓
Fiserv Banking Hub
        ↓
Finxact
        ↓
NHB Response
```

Once that path is verified, NHBCAP01 will have demonstrated both its inbound SAP BTP security boundary and its outbound real banking-platform integration boundary.