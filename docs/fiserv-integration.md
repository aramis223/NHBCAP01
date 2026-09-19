# Fiserv Banking Hub / Finxact Integration

## Purpose

This document records the NHBCAP01 learning integration with the Fiserv Banking Hub and its Finxact account-processing environment.

The purpose of this integration is to demonstrate how NHB CAP can consume an external banking API through a modern API-based integration pattern.

This is a **learning and portfolio integration**, not a replacement of the target NHB core-banking architecture.

The architectural principle remains:

```text
NHB CAP
   │
   ├── SAP APIs
   ├── Temenos APIs
   └── Fiserv Banking Hub / Finxact APIs
```

NHB CAP acts as the integration/orchestration layer. External banking platforms remain responsible for their own banking-domain data and processing.

## Scope

The initial Fiserv integration focuses on:

* Fiserv Banking Hub
* Finxact account-processing APIs
* OAuth 2.0 client-credentials authentication
* Finxact Account Service
* Account Service — Get Account Details
* JSON request/response handling
* API testing with Postman
* Future implementation of the integration from NHB CAP

The current milestone validates the external API independently through Postman before implementing the same integration pattern in CAP.

## Authentication

The Fiserv Banking Hub integration uses **OAuth 2.0 Client Credentials**.

The authentication flow is:

```text
Fiserv API Key + API Secret
          │
          ▼
OAuth Token Endpoint
          │
          ▼
Access Token
          │
          ▼
Bearer Authentication
          │
          ▼
Finxact API
```

The API key and API secret are used only to obtain an OAuth access token. The access token is then supplied as a Bearer token when invoking Finxact APIs.

### OAuth Token Request

The token request uses:

* HTTP method: `POST`
* Authentication: HTTP Basic Authentication
* Username: Fiserv API Key
* Password: Fiserv API Secret
* Content type: `application/x-www-form-urlencoded`
* Grant type: `client_credentials`

The token endpoint is provided by the Fiserv Banking Hub environment.

The successful response contains an `access_token`, which is used for subsequent API requests.

### Postman

The official Fiserv Banking Hub Postman collection was used for API testing.

The imported collection provides environment variables for:

* Banking Hub host
* OAuth token host
* Organization ID
* OAuth token
* Finxact test data

The official collection also manages the required `EFXHeader` containing the organization identifier.

This approach was preferred over manually constructing the request because it provides the API-specific headers, variables, request bodies, and authentication configuration supplied by Fiserv.

### Security

Credentials and access tokens must **not** be committed to Git or stored in project source files.

For the NHBCAP01 learning project:

* API keys and API secrets remain in Postman secure variables.
* OAuth access tokens are temporary and must not be documented.
* Credentials must never be placed in `service.js`, CDS files, `.md` documentation, or Git history.
* Any credential accidentally exposed during experimentation should be treated as compromised and replaced.

The documentation describes the authentication pattern but intentionally does not contain actual credentials.

## Successful Finxact API Test

### Get Account Details

The first successful Finxact API operation was:

**Account Service → Deposit → DDA → Get Account Details**

The operation was executed through the official Fiserv Banking Hub Postman collection.

The request uses:

* HTTP method: `POST`
* Finxact Account Service
* Operation: `Get Account Details`
* Account type: `DDA`
* Authentication: OAuth 2.0 Bearer token
* Organization identifier: supplied through the official `EFXHeader`
* Request format: JSON

### Request Structure

The request follows the Finxact API schema:

```json
{
  "AcctSel": {
    "AcctKeys": {
      "AcctId": "{{acctId_DDA}}",
      "AcctType": "DDA"
    }
  }
}
```

The account identifier is supplied through a Postman environment variable rather than being hard-coded into the request.

### Successful Response

The API returned a successful Finxact response.

Key response characteristics included:

* `StatusCode`: `0`
* `StatusDesc`: `Success`
* `Severity`: `Info`
* `SvcProviderName`: `Finxact`
* Account type: DDA
* Account status: Active / Valid
* Currency: USD
* Product: DDA
* Account description: Personal Checking
* Open date: July 2026
* Account balances: zero in the supplied test data

The response also demonstrated that the Finxact API exposes detailed account information including:

* Account identification
* Product information
* Account status
* Currency
* Account balances
* Interest-rate information
* Statement configuration
* Overdraft information
* Account dates
* Transaction restrictions

### Result

This test successfully demonstrated the following integration path:

```text
Postman
   │
   │ OAuth 2.0 Bearer Token
   ▼
Fiserv Banking Hub
   │
   │ Finxact API
   ▼
Finxact Account Service
   │
   │ Get Account Details
   ▼
Successful JSON Response
```

This is the first confirmed real external banking API integration test in the NHBCAP01 learning project.

The test was performed against the Fiserv Banking Hub trial environment using its shared Finxact test environment.

### Architectural Significance

The successful call validates the external API consumption pattern independently of CAP.

The next implementation step is therefore not to redesign the architecture, but to reproduce this API interaction from NHB CAP.

The intended target pattern is:

```text
NHB CAP
   │
   │ REST / JSON
   ▼
Fiserv Banking Hub
   │
   ▼
Finxact
```

NHB CAP remains the orchestration/integration layer. Finxact remains responsible for the underlying banking account-processing capability.

## Architecture and Learning Outcome

### Integration Pattern

The Fiserv experiment demonstrates a standard API-based banking integration pattern.

```text
┌──────────────────────┐
│      NHB CAP         │
│ Integration Layer    │
└──────────┬───────────┘
           │
           │ REST / JSON
           │ OAuth 2.0
           ▼
┌──────────────────────┐
│ Fiserv Banking Hub   │
│ API Layer            │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│       Finxact        │
│ Account Processing   │
└──────────────────────┘
```

NHB CAP does not access the Finxact database directly.

Instead, CAP consumes APIs exposed through the Fiserv Banking Hub. This preserves the separation between the NHB integration layer and the external banking platform.

### Core-Banking Integration Direction

Fiserv Banking Hub / Finxact is the sole external core-banking integration target for NHBCAP01.

The Temenos access request was not approved. The existing Temenos mock, service model, and UI remain only as legacy learning artifacts until they are safely retired; they are not part of the target architecture.

The target landscape is:

```text
┌─────────────────────────────────┐
│ Fiserv Banking Hub / Finxact    │
│ Core banking and account data   │
└───────────────┬─────────────────┘
                │ REST / JSON + OAuth 2.0
                ▼
┌─────────────────────────────────┐
│ NHB CAP                         │
│ Product and integration layer   │
└───────────────┬─────────────────┘
                │ OData V2 / SOAP
                ▼
┌─────────────────────────────────┐
│ SAP S/4HANA                     │
│ Business partner, accounting,   │
│ cash-flow and liquidity APIs    │
└─────────────────────────────────┘
```

Fiserv / Finxact uses REST/JSON APIs with OAuth 2.0. CAP owns the integration boundary and translates external provider data into NHB product contracts.


### Learning Outcome

The Fiserv exercise has demonstrated the complete external API consumption lifecycle independently of CAP:

1. Register for a developer environment.
2. Create a Banking Hub workspace.
3. Obtain API credentials.
4. Authenticate using OAuth 2.0 Client Credentials.
5. Obtain an access token.
6. Configure the official Postman collection.
7. Invoke a Finxact API.
8. Receive and interpret a successful banking-domain response.
9. Identify the integration boundary between CAP and an external core-banking platform.

The next phase is to implement this same interaction from **NHB CAP**, while keeping credentials outside the application source code.

### Next Implementation Target

The first CAP implementation will remain deliberately small:

```text
NHB CAP
   │
   │ authenticate
   ▼
Fiserv OAuth Endpoint
   │
   │ access_token
   ▼
NHB CAP
   │
   │ Get Account Details
   ▼
Fiserv Banking Hub / Finxact
   │
   ▼
JSON response
```

The first CAP operation will be **read-only Get Account Details**.

No CREATE, UPDATE, DELETE, or transactional banking operation will be introduced at this stage.

## CAP Service Integration and NHB Response Mapping

The Fiserv integration was extended from an isolated API client to a working CAP service operation.

### CAP Service Operation

The NHB CAP service exposes:

`getFiservAccountDetails(accountId)`

The operation accepts an NHB account identifier and invokes the Fiserv account service through the local Fiserv client.

The CAP service does not expose the raw Fiserv response directly.

### End-to-End Flow

```text
NHB Consumer
    ↓
NHB CAP Service
    ↓
Fiserv OAuth 2.0
    ↓
Fiserv Banking Hub
    ↓
Finxact
    ↓
Fiserv Account Response
    ↓
NHB CAP Mapping
    ↓
NHB FiservAccount Contract
```

The integration was successfully tested against the Fiserv Banking Hub certification environment and Finxact provider.

The successful response contained:

* `StatusCode = 0`
* `StatusDesc = Success`
* `SvcProviderName = Finxact`
* DDA account information
* account status
* currency
* account balances

### NHB Response Contract

NHB CAP defines its own business-oriented response contract:

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
    ├── balanceType
    ├── amount
    └── currency
```

The balance collection is mapped from the Fiserv `AcctBal` structure.

### Response Transformation

The Fiserv response uses provider-specific structures such as:

* `AcctRec`
* `AcctKeys`
* `DepositAcctInfo`
* `AcctBal`
* `CurAmt`
* `AcctStatus`

NHB CAP transforms these structures into the NHB service contract before returning the response to the consumer.

This creates an abstraction boundary between NHB and Fiserv and prevents the Fiserv provider-specific response model from becoming part of the NHB API contract.

### Architectural Learning

This milestone demonstrates the intended integration pattern:

```text
NHB Business Contract
        ↑
   CAP Mapping
        ↑
Provider API Contract
```

NHB CAP acts as the integration/orchestration layer. It consumes the external Fiserv API and translates the provider-specific response into an NHB-oriented contract.

The Fiserv integration therefore follows the same architectural principle established for the Temenos integration: **NHB CAP owns the integration boundary rather than exposing the external core-banking API model directly.**

No API keys, secrets, access tokens, or other credentials are stored in source code or documentation.
