# NHBCAP01 — Architecture
## 1. Purpose

NHBCAP01 is the application and integration layer for the NHB banking architecture learning environment.

The project demonstrates how NHB-defined business capabilities can be implemented through SAP Cloud Application Programming Model (CAP) while integrating with external banking platforms through controlled service boundaries.

The current external banking platform is Fiserv Banking Hub / Finxact.

The architecture is designed so that NHB consumers depend on NHB-owned service contracts rather than directly on provider-specific APIs, authentication mechanisms, or data structures.

The project currently validates two primary integration capabilities:

- Account retrieval through Fiserv Accounts
- Customer/accountholder retrieval through Fiserv Accountholder

The architecture also provides the foundation for future integration with SAP S/4HANA and additional NHB capability domains.

---
## 2. Architecture Principles

### 2.1 NHB owns the business-facing contract

NHB service consumers should interact with NHB-defined contracts.

External provider structures must remain behind the CAP integration boundary.

For example:

```text
NHB Consumer
     │
     ▼
NHB Service Contract
     │
     ▼
SAP CAP
     │
     ▼
Provider-Specific Integration
```

This prevents NHB applications from becoming directly dependent on Fiserv or Finxact data structures.

### 2.2 CAP is the application and orchestration layer

SAP CAP provides the application boundary between NHB consumers, NHB persistence, and external systems.

Its responsibilities include:

- exposing NHB service contracts
- validating requests
- orchestrating external service calls
- obtaining provider authentication
- transforming NHB requests into provider requests
- transforming provider responses into NHB responses
- controlling integration errors
- isolating provider-specific implementation details

CAP does not replace the external banking platform. It integrates and orchestrates external banking capabilities.

### 2.3 Separation of concerns

The architecture separates:

```text
NHB Business Contract
        │
        ▼
CAP Service Layer
        │
        ▼
CAP Integration Client
        │
        ▼
Fiserv Banking Hub
        │
        ▼
Finxact
```

Authentication is also separated from business-specific Fiserv clients.

The shared Fiserv OAuth module obtains access tokens, while individual integration modules implement specific provider capabilities such as Accounts and Parties.

### 2.4 External-system abstraction

Provider-specific structures such as:

- `AcctSel`
- `AcctRec`
- `PartySel`
- `PartyRec`
- `PartyListRec`
- `EFXHeader`

are not exposed as NHB service contracts.

CAP maps these structures into NHB-owned entities and actions.

This allows provider integrations to evolve without requiring every NHB consumer to understand the external API.

### 2.5 Incremental integration

New external capabilities are introduced incrementally.

The verified Account Details integration remains a stable baseline while additional capabilities are added and tested independently.

The current progression is:

```text
Account Details
      │
      ▼
Stable deployed baseline
      │
      ▼
Accountholder / Party List
      │
      ▼
Accountholder / Get Party
      │
      ▼
Further customer query and identifier refinement
```

Each capability should be validated locally before being promoted to the deployed Cloud Foundry baseline.

### 2.6 Security boundaries

NHBCAP01 currently uses two independent authentication boundaries:

```text
External Consumer
       │
       │ SAP BTP XSUAA JWT
       ▼
NHBCAP01
       │
       │ Fiserv OAuth 2.0
       │ Client Credentials
       ▼
Fiserv Banking Hub / Finxact
```

Consumer authentication and provider authentication are therefore separate architectural concerns.

No Fiserv API credentials, secrets, or access tokens are stored in project documentation.

---
## 3. Current Architecture

NHBCAP01 currently operates across local SAP Business Application Studio development and SAP BTP Cloud Foundry deployment environments.

The main architectural components are:

```text
                         NHB Consumer
                              │
                              ▼
                       NHBCAP01 Service
                        SAP CAP / OData
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             NHB Persistence       Fiserv Clients
             SQLite / HANA              │
                                        │
                                  Fiserv OAuth
                                        │
                                        ▼
                               Fiserv Banking Hub
                                        │
                                        ▼
                                     Finxact
```

### 3.1 CAP application structure

The current service implementation separates the CAP service layer from provider-specific integration modules.

```text
NHBCAP01
│
├── db/
│   └── NHB domain persistence model
│
├── srv/
│   ├── service.cds
│   ├── service.js
│   │
│   └── fiserv/
│       ├── auth.js
│       ├── accounts.js
│       └── parties.js
│
└── app/
    └── NHB user interface
```

The primary responsibilities are separated as follows:

- `service.cds` defines NHB-facing service contracts.
- `service.js` implements CAP service orchestration and response mapping.
- `fiserv/auth.js` handles Fiserv OAuth 2.0 Client Credentials authentication.
- `fiserv/accounts.js` implements the Fiserv Accounts integration.
- `fiserv/parties.js` implements Fiserv Accountholder Party integration.
- the persistence layer supports NHB-owned application data independently of external provider data.

### 3.2 Local development environment

During local development:

```text
NHB Consumer / Test Client
          │
          ▼
      CAP Runtime
      localhost:4004
          │
     ┌────┴────┐
     │         │
     ▼         ▼
  SQLite    Fiserv APIs
```

SQLite provides lightweight development persistence.

External Fiserv calls are made against the Banking Hub certification environment rather than simulated as NHB persistence.

### 3.3 SAP BTP Cloud Foundry environment

The deployed architecture uses SAP BTP Cloud Foundry.

```text
External Consumer
       │
       │ XSUAA JWT
       ▼
NHBCAP01-srv
       │
       ├── SAP HANA HDI
       │
       └── Fiserv Integration
                │
                │ OAuth 2.0
                ▼
        Fiserv Banking Hub
                │
                ▼
             Finxact
```

The deployed Account Details integration has been verified end to end with HTTP 200.

The Accountholder integration has now been verified locally and through SAP BTP Cloud Foundry. Query semantics beyond the currently verified equality predicates joined by `and` and the final customer identifier strategy remain open architecture concerns.

### 3.4 Frontend layer

NHBCAP01 contains an SAPUI5/Fiori customer application under:

```text
app/customer-ui/
```

The frontend communicates with NHB services through the CAP OData boundary:

```text
SAPUI5 / Fiori
      │
      │ OData
      ▼
NHBCAP01Service
      │
      ▼
CAP Application Layer
```

The frontend does not directly access NHB persistence or Fiserv / Finxact APIs.

This preserves the architectural boundary:

```text
UI → NHB CAP Contract → Persistence / External Integration
```

The customer application has been used during the project to exercise customer-oriented CAP operations.

Provider-specific authentication, endpoints, payloads, and response structures remain behind the CAP service boundary.

---
## 4. Domain and Persistence Layer

The NHB domain persistence model is defined primarily in:

```text
db/schema.cds
```

### 4.1 Customer and Account learning model

The original CAP learning model establishes a relationship between locally persisted customers and accounts:

```text
Customer
   │
   │ 1 : many
   ▼
Account
```

The `Customer` entity separates its technical UUID from the business identifier `CustomerNumber`.

This distinction allows technical persistence identity and business identity to evolve independently.

The locally persisted Customer and Account entities should not be confused with external Fiserv account or accountholder records. External provider data is accessed through the CAP integration layer and mapped into NHB-facing service contracts.

### 4.2 Financing domain

The project also contains Murabaha financing-domain entities, including:

```text
MurabahaFinancing
MurabahaInstallment
MurabahaPayment
MurabahaPaymentReversal
```

These entities represent NHB-owned application/domain data and are independent of the provider-specific Fiserv integration contracts.

Development data is maintained under:

```text
db/data/
```

### 4.3 Local persistence

Local CAP development uses SQLite in-memory persistence.

This provides a lightweight environment for developing and testing NHB-owned domain behavior without requiring the cloud database for every development cycle.

### 4.4 Cloud persistence

The SAP BTP Cloud Foundry deployment uses SAP HANA HDI through the configured HANA service binding.

The persistence architecture is therefore:

```text
Development                  Cloud
     │                         │
     ▼                         ▼
   SQLite                  SAP HANA
                             HDI
```

This separates lightweight local development persistence from deployed cloud persistence.

### 4.5 Persistence versus external data

Not every entity exposed through the NHB service is persisted by NHB.

For example, `NHBCustomer` is currently defined with:

```cds
@cds.persistence.skip
entity NHBCustomer {
    key CustomerNumber : String;
    Name               : String;
    CustomerType       : String;
}
```

`NHBCustomer` therefore acts as an NHB-facing abstraction whose current data is obtained from the Fiserv Accountholder integration rather than from an NHB database table.

This distinction is important:

```text
NHB-owned persistent data
        │
        └── SQLite / HANA HDI

Externally sourced banking data
        │
        └── CAP integration → Fiserv Banking Hub / Finxact
```

The CAP service layer provides a common NHB-facing boundary across both categories without treating external provider records as locally owned persistence.

---
## 5. Service Layer

The primary CAP service is defined in:

```text
srv/service.cds
```

and is exposed under:

```text
/service/NHBCAP01Service
```

The service represents the NHB-owned API boundary. It exposes persisted NHB domain entities as well as externally sourced abstractions and integration operations.

### 5.1 Persisted service projections

The service exposes projections over NHB-owned persistence entities:

```text
Customer
Account
MurabahaFinancing
MurabahaInstallment
MurabahaPayment
MurabahaPaymentReversal
MurabahaAccountingEvent
```

`Customer`, `Account`, and the Murabaha entities are backed by the NHB domain persistence model.

`MurabahaPayment`, `MurabahaPaymentReversal`, and `MurabahaAccountingEvent` are exposed as read-only entities.

The Murabaha service also provides business operations for payment processing and reversal, including:

```text
postPayment
postMurabahaPayment
reverseMurabahaPayment
```

These operations belong to the NHB application/domain layer and are separate from the Fiserv integration capabilities.

Murabaha servicing also persists accounting handoff events through `MurabahaAccountingEvent`.

A successful payment creates a `PAYMENT_RECEIVED` event, while an approved payment reversal creates a `PAYMENT_REVERSED` event.

These events are written within the same CAP request transaction as the corresponding servicing-state changes so that the business state and accounting obligation are committed together.

New accounting events use `postingStatus = PENDING`.

`PENDING` represents an NHB-owned accounting obligation that has not yet been successfully posted to SAP S/4HANA.

The accounting-event entity remains read-only to service consumers.

Accounting posting is governed through the explicit CAP action `postAccountingEvent(accountingEventId)` rather than through direct updates to `MurabahaAccountingEvent`.

The governed SAP accounting path now supports both `PAYMENT_RECEIVED` and `PAYMENT_REVERSED`.

The implemented SAP accounting flow is:

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
            ReversalReason
            ReversalReferenceDocument
            ReversalDate
        │
        ▼
Invoke configured SAP transport
        │
        ▼
Parse SAP synchronous confirmation
        │
        ├── valid SAP accounting document
        │        │
        │        ▼
        │     POSTED
        │        +
        │ SAP document identity
        │
        └── posting / transport / SOAP / response failure
                 │
                 ▼
               FAILED
                 +
            errorMessage
```

The SAP-specific implementation is isolated under:

```text
srv/sap/
├── accounting.js
├── config.js
├── journal-entry-soap.js
├── journal-entry-reversal-soap.js
├── journal-entry-response.js
└── transport.js
```

The responsibilities are separated as follows:

- `config.js` loads normal-posting and reversal configuration from runtime configuration.
- `accounting.js` validates accounting events, maps normal and reversal events to their respective normalized SAP models, and orchestrates both posting paths.
- `journal-entry-soap.js` builds the normal synchronous SAP Journal Entry SOAP request.
- `journal-entry-reversal-soap.js` builds the dedicated SAP reversal SOAP request and deliberately excludes normal debit/credit posting items.
- `transport.js` provides the shared SAP HTTP transport boundary.
- `journal-entry-response.js` parses the SAP synchronous confirmation and returns the accounting document, company code, fiscal year, processing result, severity, log notes, and normalized external accounting-document reference.

The transport supports two execution patterns:

- explicit endpoint and Basic Authentication for controlled local and test execution
- SAP BTP Destination-based transport using the SAP Cloud SDK for Cloud Foundry execution

A successful HTTP response alone is not treated as evidence that SAP posted an accounting document.

NHBCAP01 requires the synchronous SAP confirmation to contain a valid accounting document together with company code and fiscal year before changing the accounting event to `POSTED`.

For a successful posting or reversal, NHBCAP01 persists the SAP-native accounting-document identity through:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

The normalized external accounting reference is stored in the form:

```text
CompanyCode-FiscalYear-AccountingDocument
```

For example:

```text
NHB1-2026-1900000123
```

For `PAYMENT_REVERSED`, NHBCAP01 retrieves the corresponding original `PAYMENT_RECEIVED` accounting event and requires that it has already been successfully posted.

The reversal path also requires the original SAP-native document identity:

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

The dedicated reversal request uses the SAP reversal contract rather than creating an unrelated debit/credit journal entry.

The operational reversal reason stored by the Murabaha domain remains separate from the SAP-configured `ReversalReason` code.

If an SAP posting attempt begins but fails because of transport, SOAP processing, SAP response validation, or SAP business validation, NHBCAP01 records `postingStatus = FAILED` together with normalized failure information in `errorMessage`.

This failed state is persisted as accounting audit evidence.

If required accounting configuration is unavailable before the SAP posting attempt begins, the event remains `PENDING` rather than being falsely recorded as an SAP posting failure.

The application-side SAP accounting path is verified through isolated SAP-layer tests and CAP-level regression using controlled SAP responses.

The verified baseline includes:

- normal `PAYMENT_RECEIVED` posting
- dedicated `PAYMENT_REVERSED` posting
- `PENDING → POSTED`
- `PENDING → FAILED`
- persistence of `externalAccountingDocument`
- persistence of `externalCompanyCode`
- persistence of `externalFiscalYear`
- persistence of `externalAccountingDocumentId`
- persistence of `errorMessage`
- original-posting lookup for reversal
- validation of original SAP document identity
- prevention of posting an accounting event that is no longer `PENDING`

Current verified regression baseline:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

Live SAP S/4HANA execution remains an external verification milestone for both normal posting and reversal and is not yet claimed as completed end to end.

#### Murabaha servicing regression baseline

The Murabaha servicing behavior is covered by the repeatable local regression script `test/murabaha-servicing.sh`.

The regression creates an isolated financing and installment set for each run and verifies the governed servicing lifecycle end to end.

Verified behaviors include:

- payment before financing activation is rejected with HTTP 409
- partial installment payment produces `PARTIALLY_PAID`
- duplicate `externalPaymentId` values are rejected with HTTP 409
- payments exceeding the outstanding installment balance are rejected with HTTP 409
- a posted payment can be reversed before settlement
- reversal restores the installment paid amount and status
- the original payment is marked `REVERSED`
- the same payment cannot be reversed twice
- duplicate external reversal references are rejected
- a financing can enter `DEFAULTED`
- valid servicing payments remain accepted while financing is `DEFAULTED`
- completion of all installments automatically moves the financing to `SETTLED`
- ordinary payment reversal after `SETTLED` is rejected with HTTP 409 and requires a separate governed adjustment workflow
- payment posting creates a correlated `PAYMENT_RECEIVED` accounting event
- payment reversal creates a correlated `PAYMENT_REVERSED` accounting event
- new accounting events begin in `PENDING` posting state

The test uses run-specific external references so it can be executed repeatedly against persistent local data without colliding with evidence from earlier runs.

The same regression was subsequently executed against the deployed SAP BTP Cloud Foundry service behind XSUAA after deployment of the updated MTA, including the HANA database changes.

The deployed regression passed the complete servicing baseline, including `PAYMENT_RECEIVED` and `PAYMENT_REVERSED` accounting-event verification. This establishes parity between the verified local behavior and the deployed NHBCAP01 runtime.

### 5.2 NHBCustomer abstraction

`NHBCustomer` is defined as:

```cds
@cds.persistence.skip
entity NHBCustomer {
    key CustomerNumber : String;
    Name               : String;
    CustomerType       : String;
}
```

Because persistence is skipped, CAP does not treat `NHBCustomer` as a locally stored database entity.

Its READ implementation is provided programmatically through the Fiserv Accountholder integration.

The contract deliberately remains small:

```text
NHBCustomer
├── CustomerNumber
├── Name
└── CustomerType
```

This allows NHB to expose a stable customer abstraction without exposing the substantially larger Fiserv Party structures.

### 5.3 Fiserv account contract

The service defines an NHB-facing account response using:

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

Each balance contains:

```text
FiservBalance
├── balanceType
├── amount
└── currency
```

Account retrieval is exposed through:

```cds
function getFiservAccountDetails(
    accountId : String
) returns FiservAccount;
```

The consumer therefore interacts with an NHB-defined response rather than the underlying Finxact Account response.

### 5.4 Two external service patterns

The current service demonstrates two CAP integration patterns.

#### Function-based integration

Account retrieval uses an explicit CAP function:

```text
Consumer
   │
   ▼
getFiservAccountDetails(accountId)
   │
   ▼
CAP handler
   │
   ▼
Fiserv Accounts
```

#### Entity READ integration

Customer retrieval uses normal OData READ semantics over `NHBCustomer`:

```text
Consumer
   │
   ▼
NHBCustomer READ
   │
   ├── Collection READ
   │       │
   │       ▼
   │   Get Party List
   │
   └── Keyed READ
           │
           ▼
       Get Party
```

This allows consumers to use an NHB entity-oriented interface while CAP determines which external Fiserv operation is required.

### 5.5 Service contract boundary

The CAP service contract and the provider API contract are intentionally different.

```text
NHB Contract
     │
     ▼
CAP Service Implementation
     │
     ▼
Fiserv Client
     │
     ▼
Fiserv / Finxact Contract
```

Provider-specific request and response structures are translated inside the CAP implementation.

NHB consumers therefore do not need knowledge of Fiserv authentication, `EFXHeader`, Finxact account structures, or Accountholder Party structures.

---
## 6. Fiserv Integration Layer

Provider-specific integration logic is isolated under:

```text
srv/fiserv/
├── auth.js
├── accounts.js
└── parties.js
```

This layer separates Fiserv-specific authentication, endpoints, request structures, headers, and response validation from the NHB-facing CAP service contract.

### 6.1 Shared OAuth authentication

`srv/fiserv/auth.js` provides the shared Fiserv authentication mechanism.

The module reads runtime configuration for:

```text
FISERV_TOKEN_URL
FISERV_API_KEY
FISERV_API_SECRET
```

It implements OAuth 2.0 Client Credentials using HTTP Basic authentication:

```text
API Key + API Secret
        │
        ▼
Base64 credentials
        │
        ▼
Fiserv OAuth Token Endpoint
        │
        ▼
Bearer Access Token
```

The token request uses:

```text
grant_type=client_credentials
```

The authentication module validates both the HTTP response and the presence of an access token before returning the token to the calling integration module.

Business-specific Fiserv clients therefore do not implement their own credential exchange.

### 6.2 Common Fiserv request pattern

The Accounts and Parties clients follow the same integration pattern:

```text
CAP Service Handler
        │
        ▼
Fiserv Capability Client
        │
        ├── Validate input/configuration
        │
        ├── Obtain access token
        │
        ├── Generate transaction ID
        │
        ├── Build EFXHeader
        │
        ├── Build provider request
        │
        ▼
Fiserv Banking Hub
        │
        ▼
Validate HTTP response
        │
        ▼
Validate Fiserv Status
        │
        ▼
Return provider data to CAP mapping layer
```

The common request headers include:

```text
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
EFXHeader
```

`EFXHeader` currently contains:

```text
OrganizationId
TrnId
```

`TrnId` is generated for each request using a random UUID.

### 6.3 Runtime configuration

The Fiserv integration obtains runtime configuration from environment variables rather than embedding credentials or environment-specific values in source code.

The integration currently uses:

```text
FISERV_TOKEN_URL
FISERV_API_BASE_URL
FISERV_API_KEY
FISERV_API_SECRET
FISERV_ORG_ID
```

Secrets and access tokens must not be committed to Git or stored in project documentation.

Local development and Cloud Foundry deployment may supply these values differently while preserving the same CAP integration implementation.

### 6.4 Accounts client

`srv/fiserv/accounts.js` implements the current Fiserv Account Details capability.

The client exposes:

```text
getAccountDetails(accountId, orgId)
```

and calls:

```text
POST /acctservice/acctmgmt/accounts/secured
```

The provider request is constructed as:

```text
AcctSel
 └── AcctKeys
      ├── AcctId   = accountId
      └── AcctType = DDA
```

The client obtains an OAuth access token through the shared authentication module and supplies the required `EFXHeader`.

It validates:

1. required runtime configuration
2. required input values
3. HTTP success
4. Fiserv application-level `Status.StatusCode`

Only a successful provider response is returned to the CAP service implementation for NHB response mapping.

### 6.5 Accountholder Parties client

`srv/fiserv/parties.js` currently implements two Fiserv Accountholder operations:

```text
getPartyList(orgId)
getParty(partyId, orgId)
```

These operations share the same authentication, `EFXHeader`, HTTP validation, and Fiserv status-validation pattern as the Accounts client.

#### Get Party List

The collection operation calls:

```text
POST /partyservice/parties/parties/secured/list
```

with:

```json
{
  "PartyListSel": {}
}
```

The returned `PartyListRec` collection is passed back to the CAP service layer for transformation into `NHBCustomer` records.

#### Get Party

The single-party operation calls:

```text
POST /partyservice/parties/parties/secured
```

with:

```text
PartySel
 └── PartyKeys
      └── PartyId = partyId
```

The returned `PartyRec` is passed to the CAP service layer for transformation into a single `NHBCustomer`.

### 6.6 Provider response ownership

The Fiserv integration modules return provider responses to the CAP service implementation rather than exposing those responses directly to NHB consumers.

The responsibility boundary is:

```text
Fiserv Client
     │
     │ Provider contract
     ▼
CAP Service Implementation
     │
     │ Mapping
     ▼
NHB Service Contract
```

This keeps provider transport and API concerns inside the integration layer while preserving NHB ownership of its externally visible service contracts.

---
## 7. Account Details Integration

The Fiserv Account Details capability is the first NHBCAP01 integration that has been validated both locally and in SAP BTP Cloud Foundry against the real Fiserv Banking Hub certification environment.

It therefore serves as the stable external-integration baseline for subsequent Fiserv capabilities.

### 7.1 Independent provider validation

Before CAP implementation, the Fiserv Account Details API was validated independently using the official Fiserv Banking Hub Postman collection.

The verified operation was:

```text
Account Service
    │
    ▼
Deposit
    │
    ▼
DDA
    │
    ▼
Get Account Details
```

The operation uses:

```text
POST /acctservice/acctmgmt/accounts/secured
```

with an account-selection request based on:

```text
AcctSel
 └── AcctKeys
      ├── AcctId
      └── AcctType = DDA
```

Successful provider testing established the API behavior before the same interaction was implemented through CAP.

### 7.2 CAP integration flow

NHBCAP01 exposes the NHB-facing function:

```text
getFiservAccountDetails(accountId)
```

The end-to-end flow is:

```text
NHB Consumer
     │
     ▼
getFiservAccountDetails(accountId)
     │
     ▼
CAP service.js
     │
     ▼
srv/fiserv/accounts.js
     │
     ├── OAuth via auth.js
     │
     ▼
Fiserv Banking Hub
     │
     ▼
Finxact Account Service
     │
     ▼
Get Account Details
     │
     ▼
Provider Response
     │
     ▼
CAP Response Mapping
     │
     ▼
NHB FiservAccount
```

The raw provider response is not exposed directly to the NHB consumer.

### 7.3 Response transformation

The Finxact response contains provider-specific structures including:

```text
AcctRec
AcctKeys
DepositAcctInfo
AcctBal
CurAmt
AcctStatus
```

CAP transforms the relevant provider information into the NHB-owned `FiservAccount` contract.

The transformation boundary is:

```text
Finxact Provider Contract
          │
          ▼
      CAP Mapping
          │
          ▼
  NHB FiservAccount
```

This prevents NHB consumers from depending directly on Finxact account structures.

### 7.4 Local verification

The complete integration was successfully tested through the local CAP runtime.

The verified path was:

```text
OData Consumer
      │
      ▼
NHBCAP01Service
      │
      ▼
CAP Fiserv Handler
      │
      ▼
Fiserv OAuth
      │
      ▼
Fiserv Banking Hub
      │
      ▼
Finxact Get Account Details
      │
      ▼
CAP Mapping
      │
      ▼
HTTP 200
```

The mapped response demonstrated successful retrieval and transformation of account information including:

- DDA account identification
- account description
- currency
- account status
- account open date
- multiple balance types

This established the first confirmed NHBCAP01 integration with the real external banking platform.

### 7.5 Cloud Foundry verification

The same Account Details capability was subsequently deployed and verified through SAP BTP Cloud Foundry.

The deployed path is:

```text
External Consumer
       │
       │ XSUAA JWT
       ▼
NHBCAP01-srv
       │
       │ Fiserv OAuth 2.0
       ▼
Fiserv Banking Hub
       │
       ▼
Finxact
       │
       ▼
Get Account Details
       │
       ▼
CAP Response Mapping
       │
       ▼
NHB OData Response
       │
       ▼
HTTP 200
```

This validates two independent security boundaries:

1. Consumer → NHBCAP01 through SAP BTP XSUAA.
2. NHBCAP01 → Fiserv through OAuth 2.0 Client Credentials.

The successful deployed test confirms that the integration pattern is not limited to the local BAS environment.

### 7.6 Diagnostic learning

During integration testing, an incorrect or truncated account identifier produced a structured Fiserv response indicating:

```text
StatusCode: 1121
No Records Found
Account not found
```

This was not an OAuth or connectivity failure.

The response demonstrated that:

```text
CAP
 │
 ▼
OAuth
 │
 ▼
Network
 │
 ▼
Banking Hub
 │
 ▼
Finxact
```

were all functioning sufficiently for Finxact to process the request and return a business/application response.

After the correct configured account identifier was used, the same integration returned HTTP 200.

This established an important diagnostic distinction between:

```text
Input/configuration failure
OAuth failure
Transport/API failure
Provider application response
Test-data/business lookup failure
```

### 7.7 Stable integration baseline

The Account Details implementation is now treated as the stable deployed Fiserv baseline.

New provider capabilities should follow the same general architecture:

```text
NHB Contract
     │
     ▼
CAP Orchestration
     │
     ▼
Fiserv Client
     │
     ▼
Fiserv OAuth
     │
     ▼
Banking Hub / Finxact
     │
     ▼
Provider Response
     │
     ▼
CAP Mapping
     │
     ▼
NHB Contract
```

New integrations should be introduced incrementally without destabilizing this verified Account Details path.

---
## 8. Accountholder Integration

The second Fiserv capability introduced into NHBCAP01 is Accountholder integration through the Finxact Party Service.

Like Account Details, the Accountholder implementation has now been verified locally and through SAP BTP Cloud Foundry against the Fiserv certification environment.

`NHBCustomer` remains the NHB-facing abstraction. NHB consumers do not interact directly with Finxact Party structures.

### 8.1 Capability model

The current implementation uses two Party Service operations:

```text
NHBCustomer
     │
     ├── Collection READ
     │       │
     │       ▼
     │   Get Party List
     │
     └── Keyed READ
             │
             ▼
         Get Party
```

This separates customer discovery/list retrieval from retrieval of a specific known party.

### 8.2 Get Party List

The collection operation uses:

```text
POST /partyservice/parties/parties/secured/list
```

with the initial request:

```json
{
  "PartyListSel": {}
}
```

Its purpose in NHBCAP01 is to:

- retrieve a collection of available parties
- discover `PartyId` values
- retrieve frequently used person or organization information
- support the NHB customer collection scenario

The provider response contains:

```text
PartyListRec[]
```

with separate person and organization structures.

The CAP flow is:

```text
NHBCustomer READ
       │
       ▼
service.js
       │
       ▼
getPartyList()
       │
       ▼
Fiserv Banking Hub
       │
       ▼
PartyListRec[]
       │
       ▼
CAP Mapping
       │
       ▼
NHBCustomer[]
```

This flow has been successfully verified against the Fiserv certification environment with HTTP 200.

Both individual and corporate party records were successfully transformed into the NHB `NHBCustomer` contract.

### 8.3 Get Party

When a customer key is supplied, CAP uses the Finxact Get Party operation:

```text
POST /partyservice/parties/parties/secured
```

with:

```text
PartySel
 └── PartyKeys
      └── PartyId
```

The CAP flow is:

```text
NHBCustomer('<CustomerNumber>')
       │
       ▼
service.js
       │
       ▼
getParty()
       │
       ▼
Fiserv Banking Hub
       │
       ▼
PartyRec
       │
       ▼
CAP Mapping
       │
       ▼
NHBCustomer
```

The CAP READ handler distinguishes collection retrieval from keyed retrieval using the supplied `CustomerNumber`.

### 8.4 Person mapping

For an individual party, the current mapping uses:

```text
PartyRec.PartyKeys.PartyId
        │
        ▼
CustomerNumber

PersonPartyInfo
  .PersonData
  .PersonName[0]
  .FullName
        │
        ▼
Name

PersonPartyInfo present
        │
        ▼
CustomerType = Individual
```

The certification environment successfully returned and mapped the tested individual party:

```text
PartyId:   2|98314
MemberNum: 98314
Name:      Maria Alvarez
Type:      Individual
```

The final CAP request returned HTTP 200 through the NHB `NHBCustomer` contract.

### 8.5 Organization mapping

For an organization party, the current mapping uses:

```text
PartyRec.PartyKeys.PartyId
        │
        ▼
CustomerNumber

OrgPartyInfo
  .OrgData
  .OrgName[0]
  .Name
        │
        ▼
Name

OrgPartyInfo present
        │
        ▼
CustomerType = Corporate
```

The certification environment successfully returned and mapped the tested organization:

```text
PartyId:   2|1002020310
MemberNum: 1002020310
Name:      Boyer Group
Type:      Corporate
```

The final CAP request returned HTTP 200 through the NHB `NHBCustomer` contract.

### 8.6 Customer identifier boundary

The current integration maps:

```text
Finxact PartyId
      │
      ▼
NHBCustomer.CustomerNumber
```

This is an initial integration mapping, not a finalized NHB business-identifier decision.

Certification testing demonstrated that `PartyId` and `MemberNum` are distinct identifiers.

For example:

```text
PartyId   = 2|98314
MemberNum = 98314
```

The architecture must therefore not assume that these fields are interchangeable.

The final NHB customer identifier strategy remains an explicit architecture decision.

### 8.7 Party List identifier observation

During Get Party List certification testing, at least one organization record was returned without a mapped:

```text
PartyKeys.PartyId
```

The observed organization was `Acme`.

This behavior requires further investigation before the NHB customer identifier strategy is finalized.

The implementation should not manufacture a PartyId or silently substitute another provider identifier without an explicit architecture decision.

### 8.8 Query and filter behavior

NHB OData query semantics must not be translated mechanically into superficially similar Finxact fields.

The currently verified `NHBCustomer` query surface is:

```text
Unfiltered collection READ
Keyed READ by CustomerNumber
CustomerType eq '<value>'
Name eq '<value>'
Name eq '<value>' and CustomerType eq '<value>'
$top=<n>
$skip=<n>
$skip=<n>&$top=<n>
```

For collection retrieval, pagination is applied at the NHB CAP boundary after
Finxact Party records have been transformed and NHB-side filters have been
evaluated. This is required because `NHBCustomer` is a non-persistent
integration entity and the custom READ handler owns the external result set.

Local regression testing verified:

```text
$top=5
→ exactly 5 NHBCustomer records

$skip=5&$top=3
→ exactly 3 NHBCustomer records beginning after the first five
```

Pagination was also verified together with NHB-side filtering:

```text
CustomerType eq 'Individual' and $top=3
→ exactly 3 Individual NHBCustomer records
```

### 8.9 Current verification status

The current Accountholder status is:

```text
Get Party List
    │
    ├── Implemented
    ├── Certification environment verified
    ├── HTTP 200
    └── Individual + Corporate mapping verified

Get Party
    │
    ├── Implemented
    ├── Certification environment verified
    ├── HTTP 200
    ├── Individual mapping verified
    └── Corporate mapping verified
```

The Accountholder capability has now been promoted to SAP BTP Cloud Foundry and verified end to end against the Fiserv Banking Hub certification environment.

The Cloud Foundry deployment and subsequent local regression verification collectively cover:

- unfiltered `NHBCustomer` collection READ — HTTP 200
- `CustomerType eq 'Corporate'` — HTTP 200 with Corporate records only
- `CustomerType eq 'Individual'` — HTTP 200 with Individual records only
- `Name eq 'Vitu Armstrong'` — HTTP 200 with two matching Party records
- `Name eq 'Vitu Armstrong' and CustomerType eq 'Individual'` — HTTP 200 with two Individual records
- `Name eq 'Vitu Armstrong' and CustomerType eq 'Corporate'` — HTTP 200 with an empty result
- duplicate customer names with distinct Finxact `PartyId` values verified
- keyed `NHBCustomer` retrieval using PartyId `2|98314` — HTTP 200 for Maria Alvarez
- XSUAA-protected consumer access to the deployed CAP service
- CAP → Fiserv OAuth → Banking Hub / Finxact Party integration

The remaining incremental concerns are:

- NHBCustomer query/filter semantics beyond the currently verified equality predicates joined by `and`
- NHB customer identifier strategy
- investigation of Party List records without `PartyId`

---
## 9. Data and Transformation Boundaries

NHB service contracts and Fiserv / Finxact provider contracts intentionally use different representations.

CAP provides the translation and abstraction boundary between them.

### 9.1 Anti-corruption boundary

Provider-specific structures remain inside the integration boundary.

For Account Details, examples include:

```text
AcctRec
AcctKeys
DepositAcctInfo
AcctBal
CurAmt
AcctStatus
```

For Accountholder, examples include:

```text
PartySel
PartyKeys
PartyRec
PartyListRec
PersonPartyInfo
OrgPartyInfo
```

These structures are translated into NHB-owned contracts before data is returned to consumers.

The architectural pattern is:

```text
Provider Contract
       │
       ▼
Fiserv Integration Client
       │
       ▼
CAP Transformation
       │
       ▼
NHB Service Contract
       │
       ▼
NHB Consumer
```

This acts as an anti-corruption boundary between the NHB domain and the external banking platform.

### 9.2 Request transformation

Transformation occurs in both directions.

For Account Details:

```text
NHB accountId
      │
      ▼
CAP / Fiserv Client
      │
      ▼
AcctSel
 └── AcctKeys
      ├── AcctId
      └── AcctType = DDA
```

For keyed customer retrieval:

```text
NHB CustomerNumber
        │
        ▼
CAP / Fiserv Client
        │
        ▼
PartySel
 └── PartyKeys
      └── PartyId
```

The current `CustomerNumber → PartyId` transformation is provisional because the final NHB customer identifier strategy has not yet been established.

### 9.3 Response transformation

Provider responses are reduced and normalized before being exposed through NHB contracts.

For Accounts:

```text
Finxact AcctRec
       │
       ▼
CAP Mapping
       │
       ▼
NHB FiservAccount
```

For Accountholder:

```text
Finxact PartyRec / PartyListRec
              │
              ▼
          CAP Mapping
              │
              ▼
         NHBCustomer
```

The mapping layer selects information relevant to the NHB contract rather than reproducing the complete provider payload.

### 9.4 Semantic transformation

Transformation is not limited to renaming fields.

CAP may also normalize provider semantics into NHB semantics.

For example:

```text
PersonPartyInfo present
        │
        ▼
CustomerType = Individual
```

and:

```text
OrgPartyInfo present
        │
        ▼
CustomerType = Corporate
```

This semantic mapping belongs to the NHB integration boundary.

It should only be introduced when the provider semantics are understood and verified.

### 9.5 Query-semantic boundary

NHB query semantics and provider query semantics must be treated independently.

A field that appears similar in the provider API must not automatically be assumed to represent the same business meaning.

For example:

```text
NHB:
CustomerType = Corporate
```

cannot currently be translated directly into:

```text
Finxact:
PersonIndicator = false
```

because `PersonIndicator=false` does not represent an organization-only selection.

The architecture therefore favors correct NHB semantics over forced provider-side translation.

Where direct semantic equivalence does not exist, the integration must explicitly determine an appropriate strategy rather than leaking provider behavior into the NHB contract.

### 9.6 Provider independence

NHB consumers should not need knowledge of:

- Fiserv OAuth
- `EFXHeader`
- Banking Hub endpoint structures
- Finxact request wrappers
- Finxact response wrappers
- provider-specific identifiers unless intentionally adopted by NHB
- provider-specific error structures

The intended dependency direction is:

```text
NHB Consumer
     │
     ▼
NHB Contract
     │
     ▼
CAP Integration Boundary
     │
     ▼
External Provider
```

not:

```text
NHB Consumer
     │
     ▼
Fiserv / Finxact Contract
```

This boundary allows the external implementation to evolve while preserving a controlled NHB-facing architecture.

---
## 10. Error Handling and Diagnostics

NHBCAP01 treats external integration failures as controlled architectural conditions rather than exposing raw provider failures directly to NHB consumers.

### 10.1 Failure categories

The integration distinguishes between several categories of failure:

```text
Input validation failure
        │
        ▼
Runtime configuration failure
        │
        ▼
OAuth authentication failure
        │
        ▼
HTTP / transport failure
        │
        ▼
Provider application response
        │
        ▼
Business / test-data lookup failure
```

These categories should not be treated as equivalent because they indicate failures at different architectural layers.

### 10.2 Input and configuration validation

Fiserv client modules validate required values before making provider calls.

Examples include:

```text
accountId
partyId
organization ID
API base URL
OAuth configuration
```

Missing required configuration or input causes the integration to fail before an invalid provider request is issued.

### 10.3 OAuth errors

The shared Fiserv authentication module validates the OAuth HTTP response and verifies that the response contains an access token.

OAuth failures therefore remain distinguishable from subsequent Banking Hub or Finxact failures.

The boundary is:

```text
CAP
 │
 ▼
Fiserv OAuth
 │
 ├── Failure → Authentication error
 │
 └── Success
       │
       ▼
   Provider API
```

### 10.4 HTTP and provider-status validation

The Fiserv clients perform two levels of response validation.

First:

```text
HTTP response status
```

is checked.

Second, after successful JSON parsing:

```text
Status.StatusCode
```

is checked for the provider application result.

This distinction is important because an HTTP exchange may succeed while the provider reports a business or application-level failure.

### 10.5 Account lookup diagnostic example

During Account Details testing, an incorrect or truncated test account identifier produced:

```text
StatusCode: 1121
No Records Found
Account not found
```

This response demonstrated that the request had already passed through:

```text
CAP
 │
 ▼
OAuth
 │
 ▼
Network
 │
 ▼
Fiserv Banking Hub
 │
 ▼
Finxact
```

The problem was therefore the requested test data rather than authentication or connectivity.

After the correct account identifier was supplied, the same integration returned HTTP 200.

### 10.6 CAP consumer-facing errors

Provider integration exceptions are handled by the CAP service layer.

The current implementation converts external integration failures into controlled CAP service responses rather than returning raw Fiserv payloads directly to NHB consumers.

The intended boundary is:

```text
Provider Error
     │
     ▼
CAP Error Handling
     │
     ▼
Controlled NHB Service Response
```

More granular mapping of provider errors into NHB-specific error categories remains future refinement.

### 10.7 Diagnostic logging

Diagnostic logging is useful during integration development, but provider responses may contain information that should not be retained unnecessarily.

Temporary full-response logging was used during Accountholder certification testing to understand the Party response structures.

After the required mappings were verified, full provider-response logging was removed.

The preferred principle is:

```text
Log enough to diagnose integration behavior
                │
                ▼
Do not persist unnecessary provider/customer data
```

Secrets, OAuth access tokens, API credentials, and unnecessary customer information should not be written to project documentation or routine application logs.

### 10.8 Deployment configuration lesson

Cloud Foundry integration testing identified leading whitespace in Fiserv runtime configuration values.

This caused different failures at successive integration stages, including:

```text
Malformed token URL
OAuth HTTP 401
Get Account Details HTTP 403
```

After the runtime values were normalized and the Cloud Foundry environment was updated, the deployed integration completed successfully with HTTP 200.

This demonstrates that configuration integrity is part of integration diagnostics and should be checked separately from application code defects.

---
## 11. SAP BTP Cloud Foundry Deployment and Security

NHBCAP01 has been deployed to SAP BTP Cloud Foundry and validated as a protected CAP application.

The deployed environment establishes the cloud runtime baseline for NHB application services and external banking integration.

### 11.1 Deployed runtime

The current verified deployment is:

```text
External Consumer
       │
       │ HTTPS / OData
       │ XSUAA JWT
       ▼
SAP BTP Cloud Foundry
       │
       ▼
NHBCAP01-srv
       │
       ├── SAP HANA HDI
       │
       └── Fiserv Integration
                │
                │ OAuth 2.0
                ▼
        Fiserv Banking Hub
                │
                ▼
             Finxact
```

Both the deployed Account Details and Accountholder capabilities have completed this cloud integration path successfully with HTTP 200.

### 11.2 XSUAA authentication boundary

The deployed CAP service is protected by SAP BTP XSUAA.

An unauthenticated request to the protected service returned HTTP 401.

A valid XSUAA OAuth/JWT token was subsequently obtained and used to invoke the deployed CAP service successfully.

The consumer authentication flow is therefore:

```text
External Consumer
       │
       │ Obtain/use JWT
       ▼
SAP XSUAA
       │
       ▼
NHBCAP01-srv
```

This establishes the first security boundary:

```text
Consumer → NHBCAP01
```

### 11.3 Fiserv authentication boundary

Authentication from NHBCAP01 to Fiserv is independent of XSUAA.

The CAP application obtains a Fiserv access token using OAuth 2.0 Client Credentials:

```text
NHBCAP01-srv
       │
       │ API Key + Secret
       ▼
Fiserv OAuth
       │
       │ Access Token
       ▼
Fiserv Banking Hub
```

This establishes the second security boundary:

```text
NHBCAP01 → Fiserv
```

A consumer's XSUAA token is therefore not reused as the Fiserv provider credential.

### 11.4 Two-boundary security model

The complete security model is:

```text
NHB Consumer
     │
     │ XSUAA JWT
     ▼
NHBCAP01
     │
     │ Fiserv OAuth Access Token
     ▼
Fiserv Banking Hub
     │
     ▼
Finxact
```

The two authentication mechanisms serve different trust relationships and must remain separated.

### 11.5 Cloud persistence

The Cloud Foundry deployment is bound to SAP HANA HDI for NHB-owned persistent data.

The persistence path is:

```text
NHBCAP01-srv
      │
      ▼
SAP HANA HDI
```

This is separate from Fiserv-sourced information.

For example:

```text
NHB-owned Murabaha data
        │
        ▼
     HANA HDI
```

while externally sourced customer information follows:

```text
NHBCustomer
     │
     ▼
CAP Integration
     │
     ▼
Fiserv Accountholder
```

### 11.6 External API runtime configuration

Fiserv connection information is supplied to the deployed application through runtime configuration.

The application does not require Fiserv credentials to be embedded in CDS models, JavaScript source code, or project documentation.

The same integration modules can therefore operate in local and Cloud Foundry environments using environment-specific configuration.

### 11.7 Destination Service status

SAP BTP Destination Service was used during earlier deployment work and was previously bound to the CAP application.

It is not part of the current active Fiserv runtime path.

The current Fiserv client uses its runtime configuration directly for external API connectivity.

Destination Service is not a dependency of the current Fiserv runtime path.

For SAP S/4HANA accounting, NHBCAP01 already implements Destination-aware transport through the SAP Cloud SDK. The required SAP BTP Destination configuration and live connectivity remain pending laboratory verification.

### 11.8 Deployment verification

The deployed Account Details proof verified the complete path:

```text
XSUAA-authenticated consumer
          │
          ▼
    NHBCAP01-srv
          │
          ▼
      Fiserv OAuth
          │
          ▼
   Fiserv Banking Hub
          │
          ▼
       Finxact
          │
          ▼
Get Account Details
          │
          ▼
     CAP Mapping
          │
          ▼
       HTTP 200
```

This Account Details flow established the initial Cloud Foundry integration baseline.

The Accountholder capability has subsequently been promoted to the same SAP BTP Cloud Foundry runtime and verified end to end through the XSUAA-protected CAP service against the Fiserv Banking Hub certification environment.

---
## 12. Current and Target Architecture

NHBCAP01 distinguishes explicitly between architecture that has been implemented and verified and capabilities that remain part of the target architecture.

This prevents planned components from being represented as current operational dependencies.

### 12.1 Current verified architecture

The current architecture is:

```text
                         NHB Consumers
                              │
                              │ OData / XSUAA
                              ▼
                           NHB CAP
                        NHBCAP01-srv
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             NHB Persistence       Fiserv Clients
                    │                   │
          ┌─────────┴─────────┐         │ OAuth 2.0
          │                   │         ▼
          ▼                   ▼   Fiserv Banking Hub
       SQLite             HANA HDI           │
   Local Development     Cloud Runtime       ▼
                                           Finxact
                                      ┌──────┴──────┐
                                      │             │
                                      ▼             ▼
                                   Accounts    Accountholder
```

The following capabilities have been verified:

- local CAP runtime
- SQLite development persistence
- SAP HANA HDI cloud binding
- XSUAA-protected Cloud Foundry CAP service
- authenticated deployed OData access
- Fiserv OAuth 2.0 Client Credentials
- Fiserv Banking Hub certification connectivity
- Finxact Get Account Details
- Account Details provider-to-NHB transformation
- deployed Account Details end-to-end HTTP 200
- Finxact Get Party List
- Finxact Get Party
- individual Party-to-NHBCustomer transformation
- corporate Party-to-NHBCustomer transformation
- Accountholder end-to-end HTTP 200 locally and through SAP BTP Cloud Foundry
- deployed NHBCustomer collection READ
- deployed Corporate and Individual `CustomerType` equality filtering
- deployed keyed Get Party retrieval

Both Account Details and Accountholder have now been verified locally and through the deployed Cloud Foundry application.

Account Details established the initial deployed Fiserv integration baseline. Accountholder extends that baseline while preserving `NHBCustomer` as an NHB-owned abstraction over Finxact Party structures.

### 12.2 Current responsibility boundaries

The current architecture separates responsibilities as follows:

```text
NHB
│
├── Business-facing service contracts
├── CAP application logic
├── Integration orchestration
├── Provider response transformation
├── NHB-owned persistence
└── Consumer-facing security

Fiserv / Finxact
│
├── Provider API contracts
├── Banking Hub
├── Core banking processing
├── Account services
└── Accountholder / Party services
```

NHB does not attempt to reproduce Finxact core-banking processing inside CAP.

Likewise, Finxact provider structures do not define the NHB public service contract.

### 12.3 Target architecture

The target architecture extends the current CAP and Fiserv foundation with SAP enterprise capabilities:

```text
                         NHB Applications
                               │
                               ▼
                       SAP BTP / NHB CAP
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
         Fiserv Banking Hub             SAP APIs
                  │                         │
                  ▼                         ▼
               Finxact                 SAP S/4HANA
          Core Banking              Enterprise Services
```

CAP remains the controlled application and integration boundary.

The target architecture does not assume direct database-to-database integration between Finxact, NHB persistence, and SAP S/4HANA.

### 12.4 SAP S/4HANA Integration

SAP S/4HANA accounting integration is now implemented at the NHBCAP01 application and integration boundary.

The current architecture follows:

NHB CAP
↓
NHB SAP accounting adapter
↓
SAP synchronous Journal Entry service
↓
SAP S/4HANA

The implementation does not use direct SAP S/4HANA database access.

The SAP accounting integration is separated under `srv/sap/` and currently provides:

- NHB accounting configuration resolution
- normalized accounting-event to journal-entry mapping
- synchronous SAP Journal Entry SOAP request construction
- SOAP message-context generation
- local/test HTTP transport using Basic Authentication
- SAP BTP Destination-aware transport through the SAP Cloud SDK
- synchronous SAP confirmation parsing
- SOAP Fault handling
- SAP business-posting failure detection
- normalized accounting-document identification
- CAP accounting-event state transitions

The governed accounting path now supports both `PAYMENT_RECEIVED` and `PAYMENT_REVERSED`.

The implemented flow is:

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
        ├── valid SAP accounting document
        │        │
        │        ▼
        │      POSTED
        │        +
        │ SAP document identity
        │
        └── posting / transport / SOAP / response failure
                 │
                 ▼
               FAILED
                 +
            errorMessage
```

A successful HTTP response alone is not considered evidence of successful accounting posting.

NHBCAP01 requires a valid SAP accounting document together with company code and fiscal year before changing the event to `POSTED`.

For successful normal posting and reversal, NHBCAP01 persists:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

For `PAYMENT_REVERSED`, the corresponding original `PAYMENT_RECEIVED` accounting event must already have `postingStatus = POSTED`.

The reversal path uses the original SAP-native accounting identity to derive `ReversalReferenceDocument` and submits a dedicated SAP reversal request using `ReversalReason`, `ReversalReferenceDocument`, and `ReversalDate`.

The reversal SOAP contract deliberately does not create normal debit/credit `<Item>` elements.

The application-side integration has been verified through isolated SAP-layer tests and CAP-level regression using controlled SAP responses.

Current verified regression baseline:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

Live SAP S/4HANA execution remains pending external verification for both normal posting and reversal.

Additional SAP integration areas remain selective future capabilities, including:

- Business Partner
- cash-flow and liquidity-related capabilities
- Procurement
- Controlling
- other enterprise services justified by NHB capability requirements

Future SAP services should continue to be introduced only when a defined NHB use case exists and the corresponding supported SAP API or service has been inspected and independently verified.

The architectural rule remains:

Supported SAP API / Service
→ controlled NHBCAP01 integration
→ no direct SAP database coupling

### 12.5 Evolution principle

The target architecture should evolve from verified increments.

The current progression is:

```text
CAP local application
        │
        ▼
NHB persistence
        │
        ▼
Fiserv OAuth
        │
        ▼
Account Details
        │
        ▼
Cloud Foundry deployment
        │
        ▼
Accountholder
        │
        ▼
Additional banking capabilities
        │
        ▼
SAP S/4HANA integration
```

A component moves from target architecture into current architecture only after its actual integration path has been implemented and demonstrated.

---
## 13. Key Architecture Decisions

The following decisions define the current NHBCAP01 architecture.

| Decision | Rationale |
| --- | --- |
| CAP is the NHB application and integration layer | Provides service exposure, orchestration, mapping, validation, and business logic |
| NHB consumers communicate through NHB-owned CAP contracts | Prevents direct consumer dependency on backend/provider APIs |
| Fiserv / Finxact retains its own provider contract | Preserves the external-system boundary |
| NHB-facing contracts remain provider-independent | Prevents provider structures from leaking into NHB applications |
| Fiserv connectivity is isolated under `srv/fiserv/` | Separates provider connectivity from NHB service logic |
| Fiserv OAuth is centralized in `auth.js` | Avoids duplicating authentication logic across capability clients |
| OAuth credentials remain outside source code | Protects secrets and supports environment-specific runtime configuration |
| XSUAA protects consumer-to-CAP access | Establishes the first authentication boundary |
| Fiserv OAuth protects CAP-to-Fiserv access | Establishes an independent provider authentication boundary |
| SQLite is used for local development | Provides lightweight development persistence |
| HANA HDI is used for deployed NHB persistence | Provides SAP-managed cloud persistence |
| External provider data is not automatically persisted by NHB | Preserves ownership boundaries between NHB and the banking platform |
| `NHBCustomer` is an NHB-owned abstraction | Prevents Finxact Party structures from becoming the NHB customer contract |
| `PartyId → CustomerNumber` is provisional | Certification testing shows `PartyId` and `MemberNum` are distinct |
| Provider query fields are not assumed to equal NHB query semantics | Prevents incorrect mappings such as Corporate → `PersonIndicator=false` |
| Account Details and Accountholder form the verified deployed Fiserv baseline | Both have been verified locally and through Cloud Foundry |
| New integrations are validated locally before cloud promotion | Reduces risk to the stable deployed baseline |
| Destination Service is not a current Fiserv runtime dependency | Current Fiserv connectivity uses runtime configuration directly |
| SAP S/4HANA accounting is an implemented NHBCAP01 integration boundary | Normal posting and reversal are implemented and regression-verified; live S/4HANA execution remains pending external verification |
| SAP integration should use supported APIs/services | Avoids direct database coupling |

---
## 14. Known Limitations and Open Architecture Items

NHBCAP01 remains a learning, architecture, and portfolio implementation rather than a production banking platform.

Current limitations and open items include:

- Only a subset of Fiserv / Finxact capabilities has been integrated.
- Account Details established the initial deployed external-banking baseline; Accountholder now extends that verified baseline.
- Accountholder Get Party List and Get Party are verified locally and through the deployed Cloud Foundry application.
- `PartyId → CustomerNumber` remains a provisional identifier mapping.
- The relationship between NHB customer identity, Finxact `PartyId`, and `MemberNum` requires an explicit architecture decision.
- At least one Party List organization record was observed without a mapped `PartyKeys.PartyId`.
- NHBCustomer query/filter behavior beyond the currently verified equality predicates joined by `and` has not yet been finalized.
- `CustomerType = Corporate` cannot currently be translated directly to `PersonIndicator=false`.
- Provider error mapping can be refined into more granular NHB error semantics.
- Production resilience patterns such as retries, circuit breakers, timeout policy, and recovery behavior have not yet been fully designed.
- Production observability and monitoring remain future work.
- Production-grade authorization design remains future work.
- Runtime secret management can be strengthened as the deployment architecture matures.
- Fiserv integration currently focuses on retrieval scenarios; broader transactional capabilities have not yet been introduced.
- SAP S/4HANA accounting integration is implemented through the NHBCAP01 application boundary and verified through controlled regression; live SAP S/4HANA posting remains pending external verification.
- SAP BTP Destination Service is not used by the current Fiserv runtime path; SAP accounting uses Destination-aware transport, while the live SAP Destination configuration remains pending laboratory verification.

These items are recorded explicitly so that verified implementation, temporary integration mappings, and future architecture remain distinguishable.

---
## 15. Next Architecture Steps

The next architecture work should continue incrementally from the verified baseline.

### 15.1 Accountholder baseline — completed

The initial Accountholder baseline is implemented and verified locally and through SAP BTP Cloud Foundry.

The verified scope includes:

- Get Party List
- Get Party
- Individual and Corporate Party-to-NHBCustomer transformation
- unfiltered `NHBCustomer` collection retrieval
- `CustomerType eq 'Corporate'`
- `CustomerType eq 'Individual'`
- `Name eq '<value>'`
- `Name eq '<value>' and CustomerType eq '<value>'`
- keyed `NHBCustomer` retrieval

The following architecture questions remain open:

- NHBCustomer query/filter semantics beyond the currently verified equality predicates joined by `and`
- final NHB customer identifier strategy
- investigation of Party List records without `PartyId`

These open questions must not be resolved by inventing unverified provider semantics.

### 15.2 Accountholder Cloud Foundry promotion — completed

The Accountholder capability has been promoted successfully from the local BAS baseline to SAP BTP Cloud Foundry.

The verified deployed path is:

```text
XSUAA-authenticated consumer
        │
        ▼
NHBCAP01-srv
        │
        ▼
Fiserv OAuth
        │
        ▼
Fiserv Banking Hub
        │
        ▼
Finxact Accountholder
        │
        ▼
NHB transformation
        │
        ▼
HTTP 200
```

### 15.3 Expand Fiserv capabilities selectively

Additional Fiserv APIs should be introduced according to NHB capability requirements rather than simply integrating APIs because they are available.

Potential future work may include additional Accountholder, account, transaction, transfer, servicing, or related banking capabilities when justified by the NHB architecture.

### 15.4 Continue NHB domain implementation

The Murabaha application/domain track can continue independently of provider integration.

This preserves the distinction between:

```text
NHB-owned domain behavior
```

and:

```text
External banking-platform capabilities
```

### 15.5 Complete SAP S/4HANA Accounting Verification

The first SAP S/4HANA integration use case has now been selected and implemented.

The current implemented scope covers both:

- Murabaha payment accounting through `PAYMENT_RECEIVED`
- Murabaha payment accounting reversal through `PAYMENT_REVERSED`

Both paths use the SAP synchronous Journal Entry service, but they follow separate SAP request contracts.

The implemented progression has been:

Inspect supported SAP service\
↓\
Define the NHB accounting handoff contract\
↓\
Implement `MurabahaAccountingEvent`\
↓\
Implement governed `postAccountingEvent` action\
↓\
Externalize normal-posting and reversal accounting configuration\
↓\
Map NHB accounting events to normalized SAP request models\
↓\
Build the normal synchronous Journal Entry SOAP request\
↓\
Build the dedicated SAP reversal SOAP request\
↓\
Implement local and SAP BTP Destination-aware transport\
↓\
Parse the SAP synchronous confirmation\
↓\
Persist SAP-native accounting-document identity\
↓\
Implement `POSTED` and `FAILED` accounting-event outcomes\
↓\
Verify normal posting and reversal through automated regression

The current verified application-side architecture is:

```text
MurabahaAccountingEvent
postingStatus = PENDING
        │
        ▼
postAccountingEvent
        │
        ▼
Select accounting path
        │
        ├── PAYMENT_RECEIVED
        │        │
        │        ▼
        │   Normal SAP Journal Entry request
        │
        └── PAYMENT_REVERSED
                 │
                 ▼
            Load original posted event
                 │
                 ▼
            Resolve original SAP document identity
                 │
                 ▼
            Dedicated SAP reversal request
        │
        ▼
SAP transport
        │
        ▼
SAP confirmation parser
        │
        ├── success
        │      │
        │      ▼
        │    POSTED
        │      +
        │ SAP document identity
        │
        └── failure
               │
               ▼
             FAILED
               +
          errorMessage
```

For successful normal posting and reversal, NHBCAP01 persists:

- `externalAccountingDocument`
- `externalCompanyCode`
- `externalFiscalYear`
- `externalAccountingDocumentId`

The current automated regression baseline is:

- SAP accounting/integration suite: **43 passed, 0 failed**
- Murabaha servicing/accounting suite: **14 passed, 0 failed**

The next SAP milestone is therefore no longer to introduce normal posting or reversal.

It is to complete live SAP S/4HANA verification for both accounting paths.

The next steps are:

1. Make the SAP S/4HANA laboratory environment available.
2. Confirm that the synchronous Journal Entry service is active and accessible.
3. Configure the required SAP communication arrangement.
4. Configure and validate the SAP BTP Destination used by NHBCAP01.
5. Confirm the required authentication and endpoint settings.
6. Provide approved test accounting configuration, including a valid SAP reversal-reason code.
7. Execute a controlled `PAYMENT_RECEIVED` posting.
8. Confirm that SAP creates the accounting document.
9. Confirm the returned accounting document number, company code, and fiscal year.
10. Verify that NHBCAP01 persists `postingStatus = POSTED`.
11. Verify that the SAP-native accounting identity and normalized external accounting reference are persisted.
12. Reverse the posted payment through the NHB Murabaha servicing flow.
13. Confirm creation of the corresponding `PAYMENT_REVERSED` accounting event.
14. Submit the reversal accounting event through `postAccountingEvent`.
15. Confirm that NHBCAP01 derives the SAP reversal reference from the original accounting document, company code, and fiscal year.
16. Confirm that SAP processes the configured reversal reason against the original accounting document.
17. Confirm the returned SAP accounting-document identity for the reversal.
18. Verify that the reversal accounting event is persisted with `postingStatus = POSTED`.
19. Record the successful normal-posting scenario as the live `SAP-T05` regression baseline.
20. Record the successful reversal scenario as the live `SAP-T05R` regression baseline.

The live verification sequence should remain evidence-based:

```text
SAP service available
        │
        ▼
Destination verified
        │
        ▼
Independent SAP connectivity verified
        │
        ▼
PAYMENT_RECEIVED posting executed
        │
        ▼
Original SAP document confirmed
        │
        ▼
NHB posting state verified
        │
        ▼
PAYMENT_REVERSED executed
        │
        ▼
SAP reversal request executed
        │
        ▼
Reversal document confirmed
        │
        ▼
NHB reversal state verified
        │
        ▼
Regression evidence recorded
        │
        ▼
Architecture documentation updated
```

SAP cash-flow and liquidity integration should follow only after the normal-posting and reversal baseline is live-verified and should use the same incremental verification approach.

### 15.6 Mature cross-cutting architecture

NHBCAP01 now contains enough verified domain, integration, deployment, and accounting behavior to justify an explicit cross-cutting architecture baseline.

The objective is not to introduce production patterns indiscriminately.

Cross-cutting controls should be introduced where they protect an already demonstrated architectural boundary or address a concrete runtime risk.

The current baseline covers:

- authorization
- error semantics
- correlation and observability
- outbound timeout policy
- retry and idempotency policy
- secret and configuration governance
- auditability and resilience evolution

#### 15.6.1 Current cross-cutting baseline

Several cross-cutting controls already exist.

The current security boundaries are:

```text
NHB Consumer
      │
      │ XSUAA authentication
      ▼
NHBCAP01
      │
      ├── NHB domain validation and authorization boundary
      │
      ├── Fiserv OAuth 2.0 Client Credentials
      │        │
      │        ▼
      │     Fiserv / Finxact
      │
      └── SAP transport
               │
               ├── SAP BTP Destination-aware mode
               └── controlled direct/basic mode
```

The current implementation also provides:

- controlled CAP validation through `req.reject(...)`
- differentiated HTTP semantics including `400`, `404`, `409`, and `502`
- business-event correlation through `MurabahaAccountingEvent.correlationId`
- persistence of SAP posting outcomes
- persistence of bounded accounting error information
- runtime configuration outside application source code
- removal of temporary full provider-response logging after integration verification

These controls form the starting point for further maturity.

They should not be replaced merely to introduce a generic framework.

#### 15.6.2 Authorization

XSUAA currently establishes the authentication boundary between an NHB consumer and the deployed CAP application.

Authentication alone is not a complete authorization model.

As NHBCAP01 introduces more sensitive commands, explicit authorization rules should be defined for actions such as:

- recording credit decisions
- recording Sharia decisions
- activating financing
- posting payments
- reversing payments
- submitting accounting events
- future administrative or configuration operations

The authorization model should be based on NHB business responsibilities rather than provider-specific roles.

The intended progression is:

```text
Authenticated identity
        │
        ▼
NHB role / scope
        │
        ▼
Authorized business capability
        │
        ▼
CAP action
```

Fine-grained authorization should be introduced only after the required NHB roles and responsibilities have been defined.

Provider credentials must not be used as a substitute for NHB consumer authorization.

#### 15.6.3 Error semantics

NHBCAP01 already distinguishes several classes of service failure.

Examples include:

```text
400
│
└── invalid request or required business input

404
│
└── requested NHB business object not found

409
│
└── business-state or consistency conflict

502
│
└── external provider unavailable or unsuccessful
```

Provider failures are handled inside the CAP boundary.

Raw Fiserv or SAP responses should not become the NHB consumer contract.

The target architecture is:

```text
Provider-specific failure
        │
        ▼
Integration-layer interpretation
        │
        ▼
NHB error category
        │
        ▼
Controlled CAP response
```

Future refinement should distinguish categories such as:

- configuration failure
- authentication failure
- connectivity failure
- timeout
- provider rejection
- invalid provider response
- transient provider failure
- permanent business rejection

The provider's native status and diagnostic detail may be retained where operationally necessary, but consumer-facing responses should remain controlled and provider-independent.

#### 15.6.4 Correlation and observability

Murabaha accounting already uses a business correlation identifier.

For example:

```text
Murabaha payment
      │
      ▼
externalPaymentId
      │
      ▼
MurabahaAccountingEvent.correlationId
      │
      ▼
SAP accounting request
```

Payment reversal follows the same principle using the external reversal reference.

This correlation is part of business traceability and must be preserved.

It should remain distinct from technical request tracing.

The target observability model therefore separates:

```text
Business correlation
    correlationId
        │
        └── traces one business event across accounting processing

Technical correlation
    requestId / traceId
        │
        └── traces one runtime request across services and transports
```

Future structured logging should include only the information required for diagnosis and traceability.

Provider payloads, authentication material, access tokens, credentials, and unnecessary customer information must not be written to logs.

The governing principle remains:

```text
Log enough to diagnose system behavior
              +
Preserve end-to-end traceability
              +
Minimize sensitive and provider-owned data
```

#### 15.6.5 Outbound timeout policy

The current Fiserv integrations use outbound HTTP calls for:

- OAuth token acquisition
- Account Details
- Get Party List
- Get Party

The SAP transport supports:

- SAP BTP Destination-aware execution through the SAP Cloud SDK
- controlled direct/basic HTTP execution

Explicit timeout behavior has not yet been standardized across these paths.

This is the first justified runtime resilience control to introduce.

An outbound request must not be allowed to wait indefinitely for a remote system.

The intended pattern is:

```text
NHBCAP01 outbound call
        │
        ▼
Configured timeout boundary
        │
        ├── response received
        │       │
        │       ▼
        │   normal processing
        │
        └── timeout reached
                │
                ▼
          controlled failure
                │
                ▼
        NHB error handling
```

Timeout configuration should be externalized rather than hard-coded independently inside provider clients.

A shared default may initially be used where justified.

Provider-specific timeout overrides should be introduced only when operational evidence shows that different integration paths require different policies.

Timeout handling must remain a transport concern and must not alter Murabaha domain semantics.

#### 15.6.6 Retry and idempotency policy

Automatic retry is not universally safe.

Read-oriented operations may eventually support limited retries for clearly transient failures.

Examples may include:

- customer retrieval
- account retrieval
- OAuth token retrieval

Retry eligibility must depend on explicit failure classification.

Financial commands require stricter treatment.

The critical risk is:

```text
Financial request submitted
        │
        ▼
Provider processes request
        │
        ▼
Response is lost or times out
        │
        ▼
NHBCAP01 cannot determine outcome
        │
        ▼
Blind retry
        │
        ▼
Potential duplicate business operation
```

For this reason:

- Murabaha payment posting must not be blindly retried.
- Murabaha reversal must not be blindly retried.
- SAP Journal Entry posting must not be blindly retried.
- SAP accounting reversal must not be blindly retried.

A timeout does not prove that the remote business operation failed.

Financial retry behavior should therefore be introduced only after the architecture defines sufficient:

- idempotency
- reconciliation
- provider reference handling
- duplicate detection
- uncertain-outcome recovery

The governing rule is:

```text
Retry only when the operation
and the failure mode
are both known to be retry-safe.
```

#### 15.6.7 Secret and configuration governance

NHBCAP01 already keeps external credentials outside application source code.

Current runtime configuration includes external provider endpoints, credentials, organization identifiers, SAP transport settings, and accounting configuration.

The architecture should preserve the separation:

```text
Application logic
        │
        ▼
Configuration contract
        │
        ▼
Environment-specific values
```

Secrets must not be committed to:

- JavaScript source files
- CDS models
- test evidence
- architecture documentation
- Git history

As the deployment architecture matures, runtime secrets should move toward platform-managed secret handling where justified.

Configuration should be classified into at least:

```text
Non-secret runtime configuration
        │
        ├── endpoint selection
        ├── destination name
        ├── organization identifier
        └── timeout policy

Secret configuration
        │
        ├── API credentials
        ├── passwords
        └── other authentication material

Business configuration
        │
        ├── accounting mappings
        ├── company-code-related settings
        └── approved reversal configuration
```

This distinction prevents technical secrets, runtime parameters, and business policy from becoming one undifferentiated configuration set.

#### 15.6.8 Auditability and resilience evolution

NHBCAP01 already provides domain-level traceability through persistent Murabaha lifecycle, payment, reversal, and accounting records.

Further auditability should evolve from demonstrated requirements rather than through indiscriminate event logging.

Future audit design may require recording:

- actor identity
- authorized action
- business object
- state transition
- timestamp
- correlation identifier
- outcome

Observability is not equivalent to audit.

Diagnostic logs may be transient and operational.

Audit records represent governed evidence of business or administrative activity and may have different retention and integrity requirements.

More advanced resilience mechanisms such as:

- circuit breakers
- bulkheads
- automated recovery
- provider health policies

should not be introduced merely because they are common architectural patterns.

They should be added only when runtime behavior demonstrates a concrete requirement and when their interaction with financial-processing semantics is understood.

#### 15.6.9 Implementation sequence

The recommended implementation sequence is:

```text
Current verified baseline
        │
        ▼
1. Explicit outbound timeout policy
        │
        ▼
2. Controlled timeout error classification
        │
        ▼
3. Technical request correlation
        │
        ▼
4. Structured logging
        │
        ▼
5. NHB authorization roles and scopes
        │
        ▼
6. Retry-safe operation classification
        │
        ▼
7. Financial idempotency and reconciliation strategy
        │
        ▼
8. Stronger secret/configuration governance
        │
        ▼
9. Additional resilience controls where justified
```

The first implementation increment should therefore be explicit outbound timeout handling.

Automatic retry is deliberately deferred until retry-safe operations and uncertain financial outcomes are formally addressed.

The governing cross-cutting principle is:

> NHBCAP01 introduces security, resilience, observability, and governance controls according to demonstrated architectural risk while preserving explicit NHB business semantics and provider boundaries.

---
## Summary

NHBCAP01 demonstrates an NHB-owned application and integration architecture built on SAP CAP.

The architecture separates four primary concerns:

```text
NHB Consumers
      │
      ▼
NHB Service Contracts
      │
      ▼
SAP CAP
  ┌───┴───────────────┐
  │                   │
  ▼                   ▼
NHB Persistence        External Integration
      │                         │
      ▼                         ▼
SQLite / HANA           Fiserv Banking Hub
                                │
                                ▼
                             Finxact
```

The current verified external integration baseline consists of:

- Fiserv OAuth 2.0 Client Credentials
- Finxact Get Account Details
- NHB account-response transformation
- SAP BTP Cloud Foundry deployment
- XSUAA-protected consumer access
- deployed CAP → Fiserv → Finxact HTTP 200 verification
- Finxact Get Party List
- Finxact Get Party
- NHBCustomer transformation for individual and corporate parties

Account Details established the initial stable deployed Fiserv baseline.

Accountholder integration is now a verified deployed extension of that baseline and preserves `NHBCustomer` as an NHB-owned abstraction over Finxact Party structures.

The architecture intentionally keeps provider contracts behind the CAP boundary:

```text
NHB Contract
     │
     ▼
CAP Orchestration and Mapping
     │
     ▼
Provider Contract
```

The principal open architecture concerns are the final NHB customer identifier strategy, NHBCustomer query semantics beyond the currently verified equality predicates joined by `and`, and the observed Party List record without `PartyId`.

SAP S/4HANA accounting is now an implemented NHBCAP01 integration boundary using the supported synchronous Journal Entry service for normal posting and reversal. Live S/4HANA execution remains pending external verification, while additional SAP capabilities remain selective future integrations driven by defined NHB use cases.

The governing architecture principle remains:

> NHB owns its business-facing service contracts and integration boundary; external platforms own their provider-specific API contracts and processing capabilities.
