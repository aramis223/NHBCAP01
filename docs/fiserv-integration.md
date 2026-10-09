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

The initial Account Details integration covers the following. The subsequently implemented Accountholder integration is documented in section 13:

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

The initial Account Details implementation separates authentication and account access into dedicated modules. The current Accountholder extension additionally uses `srv/fiserv/parties.js`:

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

## 13. Accountholder Integration

The deployed Account Details integration established the initial stable NHBCAP01 Cloud Foundry baseline.

Fiserv Accountholder integration was subsequently implemented through the Finxact Party Service while preserving `NHBCustomer` as the NHB-facing abstraction. The capability has been verified locally and through SAP BTP Cloud Foundry.

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

For NHB collection reads, `CustomerType` equality filtering is implemented at the NHB CAP boundary rather than being translated directly to Finxact `PersonIndicator`.

For example:

$filter=CustomerType eq 'Corporate'

CAP retrieves the Party List, transforms the provider records into the NHB-owned `NHBCustomer` representation, and then applies the `CustomerType` filter to the normalized NHB result.

This design is intentional because the Finxact Get Party List contract does not provide equivalent organization-only semantics: `PersonIndicator=false` allows all party types rather than meaning corporate/organization only.

Certification testing verified both supported equality cases:

- `CustomerType eq 'Corporate'` returned only `Corporate` customers.
- `CustomerType eq 'Individual'` returned only `Individual` customers.

An unfiltered collection READ was also regression-tested successfully and continued to return both individual and corporate customers.

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

During subsequent local regression testing, the Get Party endpoint temporarily returned HTTP 400 with Fiserv status `ESF2001` (`INTERNAL_SERVER_ERROR`). No CAP implementation change was made.

The same request was then revalidated at three levels:

1. direct HTTP request to the Fiserv Get Party endpoint;
2. the NHBCAP01 `getParty()` integration helper; and
3. the NHB-facing keyed CAP endpoint `NHBCustomer('2|98314')`.

All three subsequently returned HTTP 200 successfully. The CAP endpoint returned:

```json
{
  "CustomerNumber": "2|98314",
  "Name": "Maria Alvarez",
  "CustomerType": "Individual"
}
```

This regression test confirmed that the request contract, CAP integration helper, and NHB transformation remained valid. The `ESF2001` response has been observed intermittently for this PartyId in the Fiserv certification environment. Current evidence does not indicate a CAP request-contract defect, but the provider-side cause has not been established and should therefore not be characterized more specifically without further evidence.

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

The current identifier decision is to retain the existing `PartyId` → `CustomerNumber` mapping as a provisional integration mapping for this milestone. `PartyId` and `MemberNum` remain semantically distinct, and no unsupported `MemberNum` → `PartyId` lookup will be invented.

Review of the Party Account Relationship service confirmed a supported navigation from `AcctId` to related `PartyId` values and relationship roles, but it does not provide a general `MemberNum` → `PartyId` lookup. The organization Party List record without a mapped `PartyKeys.PartyId` therefore remains an open investigation item.

### Relationship API verification

Additional Finxact Accountholder relationship APIs were tested successfully in the certification environment.

**Party Account Relationship — by account**

Using account `110000000055` with account type `DDA`, Finxact returned multiple related parties together with their `PartyId`, relationship role, ownership indicators, access-rights indicators, and party summary information.

This verifies the supported navigation:

```text
AcctId + AcctType
        │
        ▼
Party Account Relationship
        │
        ▼
PartyId(s)
```

**Party Account Relationship — by party**

A party-centric relationship lookup was also verified successfully. Given a known `PartyId`, Finxact returned the related account together with account type, relationship role, account status, product identifier, and account summary information.

This verifies the reverse navigation:

```text
PartyId
   │
   ▼
Party Account Relationship
   │
   ▼
AcctId(s)
```

**Party Port Relationship**

Party portfolio relationships were also verified successfully. A known `PartyId` returned multiple `PortId` values together with relationship semantics including ownership type, primary-owner indicator, tax-reporting-owner indicator, access rights, account title, and FDIC ownership classification.

This verifies the supported navigation:

```text
PartyId
   │
   ▼
Party Port Relationship
   │
   ▼
PortId(s)
```

These relationship services establish supported Finxact navigation between parties, accounts, and portfolios. They do not, however, provide a general replacement for a missing `PartyId`. The previously observed `Acme` Party List record still exposes neither `PartyId` nor `AcctId`, so no unsupported identifier derivation or lookup will be introduced for that record.

With collection retrieval, keyed Get Party retrieval, and `CustomerType` equality filtering now verified locally and in SAP BTP Cloud Foundry, the Accountholder integration is considered a deployed extension of the established Account Details baseline.

The remaining Accountholder concerns are the permanent customer identifier strategy, query semantics beyond the supported equality and pagination baseline described below, and investigation of the observed Party List record without `PartyId`.

Broader `NHBCustomer` query semantics were extended and regression-tested.

The NHB CAP boundary now supports:

```text
Unfiltered collection READ
Keyed READ by CustomerNumber
CustomerType eq '<value>'
Name eq '<value>'
Name eq '<value>' and CustomerType eq '<value>'
```

`Name` equality is translated to the supported Finxact Get Party List `Name` selection criterion.

`CustomerType` remains an NHB-side normalized filter and is not translated directly to Finxact `PersonIndicator`, because certification testing previously confirmed that `PersonIndicator=false` is not equivalent to organization-only semantics.

Compound equality predicates joined by `and` are evaluated across the supported NHB fields. Regression testing confirmed both positive and contradictory cases:

```text
Name eq 'Vitu Armstrong' and CustomerType eq 'Individual'
→ 2 matching NHBCustomer records

Name eq 'Vitu Armstrong' and CustomerType eq 'Corporate'
→ empty result
```

The current query implementation is intentionally limited to supported equality predicates joined by `and`. It does not claim general support for arbitrary OData expressions such as `or`, `contains`, `startswith`, nested expressions, or unsupported operators.

Unsupported query semantics will not be translated mechanically into superficially similar Finxact selection fields.

### Collection pagination

The `NHBCustomer` integration also supports controlled collection pagination
at the NHB CAP boundary.

Because `NHBCustomer` is an `@cds.persistence.skip` integration entity backed
by an external Finxact result set, the custom READ handler applies OData
pagination after provider-to-NHB transformation and NHB-side filtering.

The locally verified pagination behavior is:

```text
$top=5
→ 5 NHBCustomer records

$skip=5&$top=3
→ 3 NHBCustomer records beginning after the first five

CustomerType eq 'Individual' + $top=3
→ 3 Individual NHBCustomer records
```

This preserves the intended processing order:

```text
Finxact Party List
        │
        ▼
Provider-to-NHB transformation
        │
        ▼
NHB semantic filtering
        │
        ▼
$skip / $top
        │
        ▼
NHBCustomer[]
```

Additional keyed Get Party regression testing also confirmed successful
retrieval using more than one form of valid Finxact PartyId.

Verified examples included:

```text
2|98313
4|e3861098-a2a9-4ec7-a35f-a938069199d7
```

Both returned Finxact `StatusCode = 0` and were successfully mapped through
the existing integration contract. This further confirms that the current
`PartySel.PartyKeys.PartyId` request structure is valid. The previously
observed intermittent behavior for `2|98314` therefore remains a
certification-environment/provider behavior requiring no CAP contract change
based on current evidence.

### Customer identifier strategy

The current `NHBCustomer` contract uses `CustomerNumber` as its key, with Finxact `PartyId` mapped provisionally to `CustomerNumber`.

This mapping is retained for the current milestone because it is verified and operational, but it is not considered the permanent NHB customer identity model.

The verified Finxact data shows that `PartyId` and `MemberNum` are distinct provider identifiers and must not be treated as interchangeable. NHB must also not derive or manufacture a `PartyId` from `MemberNum`, tax identifiers, names, account identifiers, or other provider data.

The target identifier model is:

```text
NHB Customer
├── CustomerId        ← NHB-owned technical identifier
├── CustomerNumber    ← NHB business identifier, when defined
├── ExternalPartyId   ← Finxact PartyId
└── ExternalMemberNum ← Finxact MemberNum
```

An NHB-owned UUID is the preferred future technical identifier for `CustomerId`.

The migration to an NHB-owned customer identifier will be handled as an explicit service-contract evolution rather than introduced into the current verified Accountholder baseline.

For the current integration, Party List records without `PartyKeys.PartyId` are excluded from the keyed `NHBCustomer` collection. No substitute identifier is manufactured. Such records are logged as provider-data exceptions for investigation.

The observed organization record `Acme` is an example of this behavior: it contains organization and tax information but no `PartyId`, `MemberNum`, or account identifier that would support a legitimate keyed NHB customer mapping.

The verified relationship APIs provide supported navigation where appropriate:

```text
AcctId   → PartyId
PartyId  → AcctId
PartyId  → PortId
```
These relationships do not provide a general substitute for a missing `PartyId`.

## 14. Architectural Principle

The key learning from this integration is not merely how to call a banking API.

The architectural principle is:

> **NHB owns its business-facing service contract and integration boundary; the external banking provider owns its provider-specific API contract and processing capabilities.**

CAP therefore performs the role of integration and orchestration rather than simply exposing the external core-banking API unchanged.

No API keys, API secrets, OAuth access tokens, or other credentials are stored in this documentation.
## Transaction history — verified 9 October 2026

Implemented read-only DDA transaction retrieval through:
POST /acctservice/acctmgmt/acctTrn/secured

CAP exposes getFiservAccountTransactions with accountId,
startDateTime, endDateTime and direction (Debit or Credit).

Verified through Postman, the local client, the local CAP endpoint,
and the deployed Cloud Foundry endpoint.

Certification example:
- Account: 110000000055
- Transaction: 53Cbz6owDW2y_Wwob3s6OtO2
- Direction: Debit
- Amount: USD 2.11
- Description: Internal Funds Trans
- Posted: 2025-05-27T14:16:54.480
- Status: Valid

Provider date-times are retained as text without assuming a timezone.
CAP obtains a fresh Fiserv OAuth token for each provider call.

Current selection limits:
- DDA accounts and CORE transactions
- Maximum five records; no cursor continuation
- Amount range 1–20000
- Posted date descending

This is a limited inquiry baseline, not complete transaction history.
The example has not been classified as a Murabaha repayment.
No payment ingestion or SAP posting is performed by this function.

Validation: JavaScript syntax and CDS compilation passed;
all 59 existing source tests passed; git diff --check was clean.
The new endpoint was separately verified against Fiserv.

## Customer, account and transaction linkage — verified 9 October 2026

Deployed CAP retrieved customer 2|98310:
Louise Payne, Individual.

Fiserv Party Account Relationship inquiry returned 24 relationships
for DDA account 110000000055. This inquiry was verified in Postman;
it is not yet exposed through a CAP relationship operation.

Verified ownership:
- 2|98310 — Louise Payne — Owner — PrimaryOwnerInd=true
- 2|98309 — Thomas Payne — JointTenancy — PrimaryOwnerInd=false

The primary owner matches the account title returned by account details.
Previously tested customer 2|98314 (Maria Alvarez) was not among the
relationships returned in this inquiry.

Deployed CAP also retrieved credit transactions for this account:
- Four USD 2.11 transactions described as Internal Transfer In
- One USD 10000 transaction described as Account Initial Deposit

The credit query returned the configured maximum of five records.
Completeness has not been established; cursor continuation is not implemented.

Customer ownership and transaction retrieval are verified.
No transaction has yet been matched to a Murabaha financing or installment.
A credit direction or account relationship alone does not establish repayment.
No transactions from this inquiry were ingested as payments or posted to SAP.

Only the identifiers and relationship evidence needed for this checkpoint
are documented; the full provider response is not committed.

## Read-only matching preview — verified 9 October 2026

Created a separate synthetic certification fixture:
- CAP customer: c7a8ff9f-91e6-494d-841a-45c3b8e3001a
- Fiserv PartyId / provisional CustomerNumber: 2|98310
- Account: 110000000055
- Financing: 6579b3a2-37a7-4dbb-bcea-a083b906c10a
- Contract: MUR-FISERV-CERT-6579b3a2
- Installment: 703133a9-c2d0-4cb6-be75-d144b3b8af0e
- Financing status: ACTIVE
- Installment status: PENDING
- Outstanding: USD 2200.00; paid amount: 0.00

The financing and lifecycle evidence are synthetic, not a real Louise Payne
contract. Existing Ahmad Trading regression fixtures remain intact.

fiserv-matching-fixture.sh creates a fresh fixture on each run.
Do not rerun to retrieve the existing fixture.

fiserv-matching-preview.py performs read-only CAP requests.
Verified output:
- One account-linked financing candidate.
- Four USD 2.11 credits marked REVIEW_REQUIRED.
- USD 10000 initial deposit blocked for this installment because its amount
  exceeds the outstanding balance.
- No payment creation, balance changes or SAP posting.

The preview is a standalone script, not a deployed CAP matching operation.
It does not verify prior ingestion, repayment purpose or allocation policy.
Transaction coverage remains limited to five CORE credits, amount 1–20000,
with no cursor continuation. All candidates require explicit review.

Next milestone: define explicit allocation, source transaction identity,
duplicate protection and audit evidence before implementing payment ingestion.

## Payment protection on HANA — verified 9 October 2026

Implementation commit: 0b8653f. Local validation: 62 tests passed.
Stored payment-reference duplicate audit was clean before deployment.

Synthetic financing: a0936c14-af6e-4ede-a89c-f13257947f9b
Installment: bf614ee4-e39f-40f6-9e31-d023db19e933
Initial paid amount: USD 100.

Concurrent submissions using HANA-DUP-a0936c14:
- One USD 100 payment accepted; one rejected with HTTP 409.
- Exactly one payment and one PENDING accounting event persisted.
- Paid amount became USD 200.

Concurrent distinct references:
- HANA-DIFF-A-a0936c14: USD 100 accepted.
- HANA-DIFF-B-a0936c14: USD 200 rejected with HTTP 409:
  "Installment changed during payment processing. Refresh and retry."
- Paid amount became USD 300.
- Rejected reference had zero payments and zero accounting events.

Retrying HANA-DIFF-B-a0936c14 succeeded with HTTP 200.
Final paid amount: USD 500; installment remained PARTIALLY_PAID.

These tests verify observed duplicate rejection and optimistic balance
conflict handling on HANA. They do not exhaust all concurrency scenarios.
No postAccountingEvent action was invoked during these checks.

## Fiserv certification allocation — verified 9 October 2026

Local validation: 68 tests passed across six suites.

A Fiserv certification credit was explicitly allocated to a synthetic
financing installment. This does not establish a real financing repayment.

Source account: 110000000055
Source transaction: 53SWeKZRHsGoRjibWoKPEYQI
Source posted datetime: 2025-06-09T13:06:00.229
Amount: USD 2.11

Financing: 6579b3a2-37a7-4dbb-bcea-a083b906c10a
Installment: 703133a9-c2d0-4cb6-be75-d144b3b8af0e
CAP payment: b4a6c7b6-6ec5-444e-b079-58022d150e63
Accounting event: 1cdb4ebd-b67f-4776-b2a2-a3b8afd84ccc

The payment preserved provider, environment, organization, account,
transaction identity, posted datetime, and explicit allocation reason.
Installment paid amount changed from USD 0.00 to USD 2.11.
Installment status became PARTIALLY_PAID.
One PAYMENT_RECEIVED accounting event was observed with status PENDING
and no external SAP document identity. No SAP posting was requested.

Repeating the allocation returned HTTP 409:
"This Fiserv source transaction has already been allocated."
The installment paid amount remained USD 2.11 after rejection.

The initial certification-environment check rejected the deployed base URL.
Setting the exact certification URL and restarting CAP resolved the issue.

Scope remains certification-only, with explicit synthetic confirmation
and a limited transaction-history query; automatic repayment classification
and complete-history ingestion are not established.


## Transaction cursor pagination — certification observation, 9 October 2026

Postman requests for account 110000000055, Credit, CORE, amount 1–20000,
and date range 2025-05-12T10:01:01.001 to 2025-10-12T10:01:01.001 used
MaxRecLimit 2. Three successive pages returned 2, 2, and 1 records,
with five distinct transaction IDs. The first two responses supplied
RecCtrlOut.Cursor; the last omitted it. Each continuation copied the
opaque cursor unchanged into RecCtrlIn.Cursor with identical filters.

CAP exposes optional cursor and pageSize inputs on
getFiservAccountTransactions. Defaults remain empty cursor and five records.
The application accepts page sizes 1–5 as a conservative local limit.
The response includes nextCursor (null when absent) and hasMore.
Each invocation retrieves one page; clients explicitly request continuation.
No cursor is constructed from transaction IDs or dates.

Allocation retains its original five-record query. Pagination does not
remove the CORE, direction, date, or amount filters, establish unfiltered
history completeness, or classify transfers as financing repayments.

Deployed CAP verification completed on 9 October 2026:
- pageSize=2 returned three pages containing 2, 2, and 1 records.
- Five distinct transaction IDs were observed, without page overlap.
- Pages 1 and 2 returned nextCursor and hasMore=true.
- Page 3 returned the USD 10000 initial deposit, nextCursor=null,
  and hasMore=false.
- Local validation passed: 70 tests across seven suites.
These checks were read-only; no allocation or SAP posting was requested.


## Read-only matching preview with pagination and allocation audit

The preview follows all cursor pages for the existing filtered CORE Credit
query, using page size 2 by default. It stops without a complete report if
a cursor loops, transaction IDs repeat, metadata is missing, or the page
limit is reached. CAP collection continuation links are followed within
the configured service.

For each transaction, the preview derives the same FISERV source key as
the allocation action from environment, organization, account and transaction
ID. Existing payments with that key are flagged ALREADY_ALLOCATED and all
candidate allocations are blocked, including when the existing payment is
REVERSED. NOT_FOUND_IN_CAP does not establish repayment eligibility.

Certification environment and organization default to the verified values
and are displayed in allocationAuditScope. They must match the CAP runtime.
This audit covers deterministic source references recorded by our allocation
action; it does not prove absence of legacy payments with other references.

The preview only sends GET requests. It does not create payments or SAP
postings. It does not extend the allocation action's five-record lookup.
Read results are not a snapshot and the allocation action must revalidate.
Offline tests: python3 -B -m unittest discover -s test -p fiserv_matching_preview_test.py

Live preview verified on 9 October 2026:
- Three cursor pages returned five distinct transactions.
- One previously allocated transaction was identified and blocked.
- Three unallocated USD 2.11 credits remained REVIEW_REQUIRED.
- The USD 10000 initial deposit was blocked for exceeding the
  installment outstanding amount of USD 2197.89.
- Eight offline preview tests passed.
The preview performed reads only; no payment or SAP posting was created.


## Provider references and reversal markers

Fiserv's supplied transaction response documentation describes SPRefIdent
as a unique service provider transaction reference, maximum 36 characters,
and notes that FNX supplies an SCO batch reference ID. It does not establish
a financing or installment reference. AcctTrnId remains our source identity;
SPRefIdent is exposed as providerReference and retained on new allocated
payments as sourceProviderReference when returned. Existing payment rows
are not backfilled. No uniqueness constraint is placed on this batch reference.

The supplied documentation describes TrnRevType as a reversal or adjustment
classification for posted transactions. Allowed values and original-transaction
linkage have not been verified. The history response preserves it as reversalType.
Certification allocation rejects any populated TrnRevType with HTTP 409,
including unknown or whitespace values. The read-only preview blocks candidates
with a populated reversalType. No automatic reversal is performed.

Missing, null or empty markers do not prove repayment purpose; existing
certification confirmation and all other allocation checks still apply.
Live certification examples examined so far omitted both fields.


## Retiring deployed fixture imports — October 2026

A previously verified Fiserv payment could no longer be read after deployment,
while its accounting event and USD 2.11 installment paid balance remained.
The generated payment import had include_filter=[], an unrestricted import.
This is consistent with fixture reimport replacing payment rows, but deployment
logs have not yet been used to establish the exact operation that removed it.

Preparation moves the five NHBCAP01 fixture CSVs from db/data to test/data.
The deployer start command explicitly retires their old hdbtabledata artifacts
with skip_data_deletion=true per artifact. db/undeploy.json lists the exact five
imports; no table is scheduled for undeployment. The production build must not
contain any of these five CSV/import artifacts. No other data import is retired.

Capture all seven CAP collections before deployment and compare afterwards,
with other application writes paused during the check. API snapshots are not
transactional database backups. Keep them outside the repository.
The migration preserves remaining rows; it does not recover missing payments.
Do not replay a missing payment while its balance and accounting event survive.

After the controlled migration is verified, retire its temporary command-line
flags in a separate reviewed change. Fixture CSVs remain test-only permanently.
References:
https://cap.cloud.sap/docs/guides/databases/initial-data
https://cap.cloud.sap/docs/guides/databases/hana#csv-data-gets-overridden
https://community.sap.com/t5/technology-blog-posts-by-sap/handling-csv-data-deployment-in-cap-hdi-without-data-loss/ba-p/14118322

Import-retirement deployment verification:
Operation ID: 57aeaa23-c423-11f1-b348-eeee0a88e060.
All seven collections matched the snapshot before and after deployment:
4 customers, 4 accounts, 39 financings, 51 installments, 1 payment,
7 reversals and 58 accounting events.

The snapshot audit identified 55 distinct missing payment IDs referenced
by surviving accounting events or reversals. These losses existed before
the retirement deployment. Recovery remains outstanding.
Local validation: 74 CAP tests and 9 Python preview tests passed.

## Fiserv payment recovery — verified 9 October 2026 UTC

Restored the original synthetic certification payment:
b4a6c7b6-6ec5-444e-b079-58022d150e63, USD 2.11.

Original identity, managed timestamps, and provider audit fields were preserved.
Existing installment paid amount remained USD 2.11.
The existing PENDING accounting event was preserved.
All existing rows were checked unchanged before committing.
No payment actions, new accounting events, or SAP postings were invoked.

CAP subsequently returned the restored payment.
The read-only preview recognized its source as ALREADY_ALLOCATED.
A fresh validated snapshot contained two payments; other collection counts
were unchanged. Snapshots and recovery reports remain outside the repository.

Recovery remains incomplete: 52 other review candidates, two blocked
missing payments, and six installment discrepancies remain unresolved.

## Payment reconstruction — verified 9 October 2026 UTC

Added nullable recovery metadata to distinguish reconstructed payments
from records whose original audit information is available.

Reconstructed 52 supported payment records in one HANA transaction:
47 POSTED and 5 REVERSED. Original IDs and references were retained.
Unknown original managed and provider audit fields remain null.
Recovery time, operator, reason and supporting evidence were recorded.

Existing rows, installment balances, reversals, accounting events and
SAP document identities were verified unchanged before commit.
No accounting events were created and no SAP postings were invoked.
Local validation passed: 81 tests across eight suites, including rollback tests.

Post-recovery snapshot: 20261009T230355Z.
Payment count: 54. No accounting events reference missing payments.
Two missing payments referenced by reversals remain unsupported.
Six installment discrepancies remain unresolved.

Removed completed one-time fixture-import removal options after they
caused a subsequent deployment to fail on already-retired artifacts.
The corrected deployment preserved existing data. Production fixture
imports remain excluded; test CSV fixtures and table definitions remain.

Snapshots, transaction backups and recovery receipts are stored outside
the repository. Complete historical recovery is not established.
