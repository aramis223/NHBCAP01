# Fiserv Banking Hub / Finxact Integration

## 1. Purpose

This document records the NHBCAP01 learning integration with Fiserv Banking Hub and the Finxact account-processing environment.

The purpose is to demonstrate how NHB CAP consumes an external banking API while maintaining an NHB-owned service contract and integration boundary.

This is a **learning and portfolio integration**. Fiserv Banking Hub / Finxact is the external core-banking integration target used by NHBCAP01.

The architectural pattern is:

```text
NHB Consumer
     │
     ▼
NHB CAP
Integration / Orchestration Layer
     │
     │ REST / JSON
     │ OAuth 2.0
     ▼
Fiserv Banking Hub
     │
     ▼
Finxact
Account Processing
```

NHB CAP does not expose the Finxact provider model directly. CAP consumes the external API and maps the provider-specific response into an NHB-oriented service contract.

---

## 2. Scope

The implemented integration currently covers:

- Fiserv Banking Hub certification environment
- Finxact account-processing APIs
- OAuth 2.0 Client Credentials authentication
- Finxact Account Service
- Deposit / DDA account lookup
- Get Account Details
- JSON request and response processing
- Postman API validation
- CAP-based OAuth authentication
- CAP-to-Fiserv API invocation
- Provider-to-NHB response transformation
- NHB OData exposure

The first implementation is deliberately read-only.

No account CREATE, UPDATE, DELETE, funds movement, or other transactional banking operation is included at this stage.

---

## 3. Authentication

Fiserv Banking Hub uses **OAuth 2.0 Client Credentials**.

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
Fiserv Banking Hub / Finxact API
```

The token request uses:

- HTTP method: `POST`
- Authentication: HTTP Basic Authentication
- Username: Fiserv API Key
- Password: Fiserv API Secret
- Content type: `application/x-www-form-urlencoded`
- Grant type: `client_credentials`

The resulting access token is supplied as a Bearer token when invoking the Banking Hub API.

---

## 4. Security Rules

Credentials and access tokens must never be committed to Git or stored in application source files.

NHBCAP01 follows these rules:

- API keys and API secrets remain external to source code.
- OAuth access tokens are temporary.
- Tokens must not be documented.
- Secrets must not be placed in `service.js`, CDS files, Markdown documentation, or Git history.
- Runtime configuration is supplied through environment variables or platform-managed configuration.
- Any credential accidentally exposed during experimentation must be treated as compromised and replaced.
- Logs should confirm only whether required configuration exists, not print secret values.

The relevant runtime configuration includes:

```text
FISERV_API_BASE_URL
FISERV_TOKEN_URL
FISERV_API_KEY
FISERV_API_SECRET
FISERV_TEST_ACCOUNT_ID
FISERV_ORG_ID
```

Actual secret values are intentionally excluded from this document.

---

## 5. Initial Postman Validation

The official Fiserv Banking Hub Postman collection was used to validate the API independently before implementing the same interaction in CAP.

The first successful operation was:

**Account Service → Deposit → DDA → Get Account Details**

The request uses:

- HTTP method: `POST`
- Account type: `DDA`
- OAuth 2.0 Bearer authentication
- Organization identifier through `EFXHeader`
- JSON request and response payloads

The request structure is:

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

The account identifier is supplied through runtime/test configuration rather than being hard-coded into the application.

The successful Finxact response demonstrated access to information including:

- Account identification
- Account type
- Account description
- Account status
- Currency
- Account balances
- Account dates
- Other provider-specific account information

This established the external API behavior before CAP implementation.

---

## 6. CAP Fiserv Client

The CAP implementation separates authentication and account access into dedicated modules:

```text
srv/
├── fiserv/
│   ├── auth.js
│   └── accounts.js
├── service.cds
└── service.js
```

### `auth.js`

The authentication module:

1. Reads Fiserv OAuth configuration from the runtime environment.
2. Builds HTTP Basic Authentication from the API key and secret.
3. Calls the OAuth token endpoint.
4. Requests the `client_credentials` grant.
5. Validates the token response.
6. Returns the access token to the calling Fiserv client.

### `accounts.js`

The account client:

1. Validates the required account and organization identifiers.
2. Obtains an OAuth access token through `auth.js`.
3. Creates the required `EFXHeader`.
4. Calls the Fiserv Get Account Details endpoint.
5. Sends the Finxact account-selection payload.
6. Validates the HTTP response.
7. Validates the Fiserv application-level status.
8. Returns the provider response to the CAP service layer.

This keeps provider communication separate from the NHB service mapping logic.

---

## 7. CAP Service Operation

NHBCAP01 exposes the function:

```text
getFiservAccountDetails(accountId)
```

The service flow is:

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
Provider Response
     │
     ▼
CAP Response Mapping
     │
     ▼
NHB FiservAccount Contract
```

The CAP service does not return the complete raw Fiserv payload.

Instead, `service.js` transforms the provider response into an NHB-oriented contract.

---

## 8. NHB Response Contract

The CAP CDS model defines an NHB-facing response structure:

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

The provider response contains Fiserv/Finxact-specific structures such as:

```text
AcctRec
AcctKeys
DepositAcctInfo
AcctBal
CurAmt
AcctStatus
```

CAP transforms these structures before returning data to the NHB consumer.

This creates an abstraction boundary:

```text
NHB Business Contract
        ↑
        │
    CAP Mapping
        ↑
        │
Provider API Contract
```

The external provider contract can therefore evolve without requiring NHB consumers to depend directly on Fiserv-specific structures.

---

## 9. Successful End-to-End CAP Test

The complete integration was successfully tested locally through NHBCAP01.

The verified path was:

```text
curl / OData Consumer
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
OAuth Access Token
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
Fiserv Response
        │
        ▼
CAP Mapping
        │
        ▼
HTTP 200 + NHB FiservAccount
```

The successful test returned:

```text
HTTP/1.1 200 OK
OData-Version: 4.0
```

The mapped response demonstrated:

- DDA account identification
- Personal checking account description
- USD currency
- Valid account status
- Account open date
- Multiple account balance types
- Successful transformation into the NHB `FiservAccount` contract

This establishes the first confirmed **CAP-to-real-external-banking-platform integration** in NHBCAP01.

---

## 10. Diagnostic Learning

During testing, one request initially returned:

```text
HTTP 404
StatusCode: 1121
StatusDesc: No Records Found
ServerStatusDesc: Account not found
```

This response was useful because it proved that:

- CAP successfully invoked the Fiserv client.
- OAuth authentication succeeded.
- Network connectivity succeeded.
- Banking Hub received the request.
- Fiserv returned a structured provider response.

The cause was an incorrect/truncated test account identifier rather than an integration defect.

After using the correct configured test account identifier, the same CAP integration returned HTTP 200 successfully.

This demonstrated the importance of distinguishing:

```text
CAP failure
OAuth failure
Transport/API failure
Provider business/application response
Test-data error
```

rather than treating every upstream error as a connectivity problem.

---

## 11. Core-Banking Integration Direction

Fiserv Banking Hub / Finxact is the external core-banking integration target for NHBCAP01.

The previous Temenos learning integration has been retired from the active CAP implementation.

The obsolete Temenos external CDS service, exposed entities, connection code, and READ handlers have been removed.

The active direction is:

```text
┌─────────────────────────────────┐
│ Fiserv Banking Hub / Finxact    │
│ Core banking and account data   │
└───────────────┬─────────────────┘
                │ REST / JSON
                │ OAuth 2.0
                ▼
┌─────────────────────────────────┐
│ NHB CAP                         │
│ Integration / product layer     │
└───────────────┬─────────────────┘
                │
                │ NHB contracts
                ▼
┌─────────────────────────────────┐
│ NHB Consumers / SAP Integration │
└─────────────────────────────────┘
```

NHB CAP owns the integration boundary.

Fiserv / Finxact owns external account-processing capabilities.

NHB consumers depend on NHB service contracts rather than directly on the provider's API structures.

---

## 12. Current Technical Status

The following milestones are complete:

- Fiserv developer/API access established
- Banking Hub certification environment available
- OAuth Client Credentials tested
- Official Postman collection tested
- Finxact Get Account Details tested successfully
- CAP Fiserv OAuth module implemented
- CAP Fiserv account client implemented
- `getFiservAccountDetails(accountId)` exposed
- Fiserv response mapped into NHB CDS contract
- Local CAP runtime validated
- Fiserv runtime configuration validated
- End-to-end CAP → Fiserv → Finxact call returned HTTP 200
- Legacy Temenos runtime integration removed
- CDS model compiled successfully after cleanup

The current verified integration baseline is therefore:

```text
NHB CAP
   ↓
OAuth 2.0 Client Credentials
   ↓
Fiserv Banking Hub
   ↓
Finxact
   ↓
Get Account Details
   ↓
NHB Response Mapping
   ↓
HTTP 200
```

---

## 13. Next Milestone

The deployed Cloud Foundry integration proof is complete and is now part of the stable NHBCAP01 baseline.

The next milestone is **Fiserv Accountholder integration**, beginning with the Finxact Party Service while preserving `NHBCustomer` as the NHB-facing abstraction.

### 13.1 Get Party List

**Endpoint**

`POST /partyservice/parties/parties/secured/list`

**Purpose**

- Search for parties using supported selection criteria.
- Retrieve matching `PartyId` values.
- Retrieve frequently used person or organization information.
- Support the NHB customer collection/search scenario.

The response contains `PartyListRec[]`, with separate person and organization structures.

### 13.2 Get Party

**Endpoint**

`POST /partyservice/parties/parties/secured`

**Purpose**

- Retrieve a specific party when its `PartyId` is known.
- Retrieve the richer Party record for detailed customer access.
- Support the NHB single-customer retrieval scenario.

### 13.3 NHB Abstraction

NHB consumers continue to use the NHB-owned `NHBCustomer` contract rather than provider-specific Finxact Party structures.

The initial transformation target is:

```text
Finxact Party                         NHBCustomer
-------------                         -----------
PartyKeys.PartyId              ->     CustomerNumber
PersonName.FullName            ->     Name (person)
OrgName.Name                   ->     Name (organization)
Person/organization structure  ->     CustomerType
```

The mapping of `PartyId` to `CustomerNumber` remains an initial integration mapping and is not yet considered a permanent business identifier decision. Certification testing confirmed that Finxact exposes `PartyId` and `MemberNum` as distinct identifiers. For example, the tested individual party returned `PartyId` `2|98314` and `MemberNum` `98314`. The NHB customer identifier strategy will therefore remain an explicit architecture decision rather than being inferred from the provider contract.

For the first implementation proof, filtering such as:

```text
$filter=CustomerType eq 'Corporate'
```

is not yet translated to Finxact `PersonIndicator`. In the Get Party List contract, `PersonIndicator=false` does not mean organization-only; it allows all party types.

The collection retrieval flow is:

```text
NHBCustomer READ
       │
       ▼
CAP Fiserv Integration
       │
       ▼
Get Party List
       │
       ▼
PartyListRec[]
       │
       ▼
NHB transformation
       │
       ▼
NHBCustomer[]
```

The collection READ was successfully verified against the Fiserv certification environment. The end-to-end flow returned HTTP 200 and successfully transformed Finxact `PartyListRec[]` records into the NHB-owned `NHBCustomer[]` contract for both individual and corporate parties.

The certification test also identified at least one returned organization record without a mapped `PartyKeys.PartyId`. This remains an open investigation item before the NHB customer identifier strategy is finalized.

Single-customer retrieval through Finxact Get Party has also been implemented and verified against the certification environment.

The single-customer retrieval flow is:

```text
NHBCustomer('<CustomerNumber>')
       │
       ▼
CAP Fiserv Integration
       │
       ▼
Get Party
       │
       ▼
PartyRec
       │
       ▼
NHB transformation
       │
       ▼
NHBCustomer
```

Both principal party structures were verified:

- `PersonPartyInfo.PersonData.PersonName[0].FullName` is transformed to the NHB customer `Name`, with `CustomerType` normalized to `Individual`.
- `OrgPartyInfo.OrgData.OrgName[0].Name` is transformed to the NHB customer `Name`, with `CustomerType` normalized to `Corporate`.

Certification tests returned HTTP 200 for both an individual customer (`Maria Alvarez`) and a corporate customer (`Boyer Group`).

The next incremental work is query/filter behavior and investigation of the customer identifier strategy, including the observed Party List record without a mapped `PartyKeys.PartyId`.

## 14. Architectural Principle

The key learning from this integration is not merely how to call a banking API.

The architectural principle is:

> **NHB owns its business-facing service contract and integration boundary; the external banking provider owns its provider-specific API contract and processing capabilities.**

CAP therefore performs the role of integration and orchestration rather than simply exposing the external core-banking API unchanged.

No API keys, API secrets, OAuth access tokens, or other credentials are stored in this documentation.