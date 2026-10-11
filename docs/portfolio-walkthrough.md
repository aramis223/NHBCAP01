# NHBCAP01 — Portfolio Walkthrough

**Enterprise Architecture & Banking Integration Reference Implementation**

**Version:** 1.0 — Release candidate
**Evidence baseline:** 10 October 2026
**Demonstration duration:** 15–20 minutes
**Audience:** Enterprise architects, banking transformation leaders, solution architects, and technical reviewers

---

## 1. Purpose and Executive Summary

NHBCAP01 demonstrates how enterprise architecture and banking transformation decisions can be translated into executable application controls, external banking integration, and verifiable accounting outcomes.

The project uses Sharia-compliant Murabaha financing as its principal business scenario, connecting:

- Enterprise capabilities, value streams, and business processes.
- Banking application services and information ownership.
- Governed financing lifecycle and servicing operations.
- Fiserv Banking Hub / Finxact certification integration.
- SAP BTP application development and cloud persistence.
- SAP Integration Suite mediation and live S/4HANA accounting execution.
- Automated validation and recorded implementation evidence.

The implementation uses synthetic financing data and controlled integration environments. It is not represented as a production banking system.

**Central portfolio claim:** Selected banking business controls can be traced from architecture intent through implemented application behavior to independently reviewable verification evidence.

## 2. Architecture and Implementation Landscape

The reference implementation uses the following responsibilities:

| Layer | Technology / Evidence | Responsibility |
| --- | --- | --- |
| Enterprise architecture | Sparx Enterprise Architect | Capabilities, value streams, processes, application architecture, traceability |
| Business process | SAP Signavio | Murabaha end-to-end BPMN and control activities |
| Application implementation | SAP CAP / Node.js | Governed financing services, payment controls, accounting events |
| Application deployment | SAP BTP Cloud Foundry | Deployed CAP services and authentication |
| Information persistence | SAP HANA / HDI | Financing, installment, payment, reversal, and accounting-event persistence |
| Banking integration | Fiserv Banking Hub / Finxact | External customer, account, transaction, and certification evidence |
| Accounting mediation | SAP Integration Suite | Transport, message routing, correlation, and SAP connectivity |
| SAP backend connectivity | SAP Cloud Connector | Controlled access to the CAL environment |
| Accounting system | SAP S/4HANA 2025 CAL | Verified journal posting and reversal |
| Verification | Automated tests and recorded evidence | Behavior, integrity, deployment, and integration assurance |

The solution maintains NHB-owned business contracts rather than exposing external provider contracts directly as enterprise business semantics.

## 3. Demonstration Sequence

### Step 1 — Establish the enterprise architecture boundary

**Suggested duration: 2–3 minutes**

Present AV-03 — NHBCAP01 Architecture-to-Implementation Realization v1.0 in Sparx EA.

Explain the relationship between business capability, business process, application service, application component, and implementation evidence.

Demonstrate the selected traceability chain, using Financing & Credit Management as the principal domain.

Supporting references:

- [Architecture](architecture.md)
- [EA Understanding Guide](ea-understanding-guide.md)
- [EA Governance Baseline](ea-governance-baseline.md)

Distinguish logical architecture relationships from implementation-specific technologies.

### Step 2 — Follow the Murabaha business process

**Suggested duration: 2 minutes**

Present the SAP Signavio model:

`04 – VS-04.01 Murabaha Financing — End-to-End BPMN`

Follow the controlled sequence from credit assessment and Sharia approval through asset acquisition, sale-contract execution, delivery, activation, and servicing.

Explain why a financing operation cannot proceed without the required business decision and evidence.

Use the [Islamic Banking Product Track](islamic-banking-product-track.md) to connect BPMN activities to CAP application actions.

### Step 3 — Demonstrate executable financing controls

**Suggested duration: 3 minutes**

Review selected service definitions and handlers in:

- `srv/service.cds`
- `srv/service.js`

Present evidence for lifecycle governance, payment acceptance, duplicate-payment rejection, overpayment protection, reversal controls, default handling, and settlement.

Highlight verified HANA behavior:

- Duplicate payment references rejected under tested concurrent conditions.
- Optimistic installment-balance conflicts detected.
- Accepted payments and associated accounting events persisted consistently.
- Rejected operations did not create additional payment or accounting-event records in the verified scenarios.

These findings demonstrate tested application controls rather than exhaustive production concurrency assurance.

### Step 4 — Trace accounting integration to live SAP S/4HANA

**Suggested duration: 3–4 minutes**

Follow a `PAYMENT_RECEIVED` accounting event through the verified integration path:

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

Explain accounting-event mapping, SOAP request construction, SAP confirmation parsing, and persistence of the returned document identity.

Present the verified October 9 SAP accounting documents:

| SAP document | Recorded evidence |
| --- | --- |
| `0100000060` | Posting confirmed in S/4HANA; application event reconciled following an earlier timeout |
| `0100000061` | Posting automatically confirmed and persisted |
| `0100000062` | Posting succeeded with restricted service authorization |
| `0100000063` | Reversal execution confirmed; opposite accounting entries verified in FB03 |

The original posting and reversal used company code 1710, fiscal year 2026, and USD 100.

Explain why a transport-level success or timeout cannot independently establish the business outcome of SAP accounting execution.

**Verification boundary:** The formal SAP original-to-reversal document linkage requires separate confirmation. Historical document `0100000060` also requires application-side identifier normalization.

The SAP accounting configuration is a sandbox mapping, not an approved production Murabaha accounting design.

### Step 5 — Explain integration mediation and observability

**Suggested duration: 2 minutes**

Present the SAP Integration Suite flow and supporting monitoring evidence.

Explain how `X-Correlation-ID` is propagated and recorded as searchable `NHB_CorrelationId` message-processing-log evidence.

Distinguish the earlier controlled mock receiver from the later verified live SAP CAL connection.

Describe the use of restricted service authorizations and the importance of inspecting business confirmation messages rather than treating completed middleware execution as proof of successful accounting posting.

Supporting reference:

[Integration Suite Runbook](integration-suite-runbook.md)

### Step 6 — Demonstrate external banking integration with Fiserv

**Suggested duration: 3 minutes**

Present the NHB-owned Fiserv integration abstraction.

Review evidence for customer and account retrieval, account ownership verification, credit inquiry, transaction history, and cursor-based pagination.

Explain the standalone read-only matching preview and its explicit review requirements.

Then present the verified October 9 certification allocation scenario:

- One Fiserv certification credit of USD 2.11 explicitly allocated to a synthetic Murabaha installment.
- Provider transaction identity and allocation reason preserved.
- Installment updated to `PARTIALLY_PAID`.
- One `PAYMENT_RECEIVED` accounting event created with status `PENDING`.
- Repeated allocation rejected with HTTP 409.
- No SAP accounting posting initiated by this allocation test.

Distinguish external transaction evidence, repayment classification, explicit allocation, and accounting posting as separate responsibilities.

**Claim boundary:** This verifies a controlled certification-environment allocation, not a genuine customer repayment, automatic repayment classification, complete transaction-history ingestion, or production Fiserv certification.

Supporting reference:

[Fiserv Integration](fiserv-integration.md)

### Step 7 — Present verification, integrity, and limitations

**Suggested duration: 2–3 minutes**

Summarize the recorded verification milestones:

| Verification area | Recorded baseline |
| --- | --- |
| Enterprise architecture | AV-03 v1.0 realization baseline |
| Murabaha servicing/accounting regression | Earlier recorded 15 PASS / 0 FAIL |
| SAP accounting regression | Earlier recorded 44 PASS / 0 FAIL |
| October 10 automated validation | 81 tests passed across eight suites |
| Live SAP integration | Actual S/4HANA posting and reversal verified October 9 |
| Fiserv allocation | Explicit synthetic certification allocation and duplicate rejection verified |
| HANA persistence | October 10 deployment preserved all seven monitored collections |
| Payment recovery | 52 historical records reconstructed under controlled recovery procedures |
| Git security review | Gitleaks v8.30.1 scanned 74 commits on October 11; zero leaks detected |

Test counts describe distinct recorded validation activities and must not be combined into a single aggregate result.

The historical reconstruction preserved available references and recorded unknown original audit information as unknown. It did not manufacture missing accounting evidence or invoke SAP posting.

## 4. Outstanding Findings and Controlled Limitations

The reference release explicitly retains the following boundaries:

- Formal SAP document reversal linkage not yet independently confirmed.
- Historical SAP document-number and composite-identifier normalization remains open.
- Two historical missing payment records referenced by reversals remain unsupported.
- Six historical installment reconciliation discrepancies remain unresolved.
- Permanent NHB customer identity semantics require a governed business decision.
- Fiserv automatic repayment classification and complete-history ingestion are not established.
- Upstream dependency security findings remain open in the `node-forge` and `braces` dependency chains.
- An earlier intermittent automated test failure was not reproduced; its cause remains undetermined.

These findings are disclosed rather than hidden or represented as completed functionality.

## 5. Portfolio Evidence Package

The reviewer package should make the evidence easy to navigate.

It should include:

1. Sparx EA AV-03 v1.0 and the supporting enterprise architecture repository.
2. SAP Signavio Murabaha BPMN export.
3. Selected CAP service contracts and implementation excerpts.
4. Regression and deployment verification summaries.
5. Integration Suite monitoring and correlation evidence.
6. Live SAP journal posting and reversal records, with sensitive information excluded.
7. Fiserv certification verification records and synthetic allocation example.
8. HANA recovery documentation and explicitly identified reconciliation exceptions.

Where evidence is retained outside Git, the walkthrough should reference it without claiming the file is included in the published repository.

No credentials, access tokens, private keys, or sensitive operational configuration should be included in public presentation artifacts.

## 6. Scope and Professional Positioning

NHBCAP01 is an enterprise architecture and banking integration reference implementation.

Its value lies in demonstrating how business architecture, banking domain controls, application responsibilities, cloud integration, and verification can be governed as a coherent transformation initiative.

It does not claim production banking readiness, live production processing, regulatory certification, formal Sharia certification, or production security accreditation.

Following the reference release, further BIAN, architecture, CAP, and cloud development exercises will proceed separately from the frozen implementation baseline.

## 7. Reviewer Takeaway

**NHBCAP01 demonstrates architecture-to-implementation traceability through an executable banking scenario supported by verified SAP and Fiserv integration evidence.**

The work connects enterprise capabilities and business processes to governed financing operations, HANA persistence, external banking transactions, real SAP S/4HANA accounting execution, and recorded verification.

The scope and remaining limitations are explicit, allowing reviewers to assess both demonstrated capability and the engineering judgment applied to its implementation.