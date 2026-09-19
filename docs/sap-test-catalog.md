# NHB SAP Test Catalog

## 1. Purpose

This catalog defines the SAP S/4HANA preparation, integration, and regression tests for NHBCAP01. Signavio diagrams are the visual process source; this file is the versioned technical and test reference.

## 2. Target environment

- SAP S/4HANA 2025 FPS01 appliance on SAP Cloud Appliance Library
- NHB CAP integration layer
- Connected systems: Temenos and Fiserv
- AWS account: paid plan with budget alerts configured

## 3. SAP scope

| NHB capability domain | SAP decision |
|---|---|
| CD-01 Customer Management | In scope |
| CD-02 Product Management | Conditional; reassess if SAP Product Master becomes required |
| CD-03 Payment Management | In scope |
| CD-04 Financing & Credit Management | Conditional; core loan/credit lifecycle remains in core banking unless a SAP requirement is confirmed |
| CD-05 Treasury & Liquidity Management | In scope |

## 4. Signavio models

- `00 – NHB SAP Integration Overview`
- `01 – CD-01 Customer Management — NHB ↔ SAP`
- `02 – CD-03 Payment Management — NHB ↔ SAP`
- `03 – CD-05 Treasury & Liquidity Management — NHB ↔ SAP`

## 5. Confirmed SAP integration references

### CD-01 Customer Management

- Business object: Business Partner
- API: Business Partner (A2X)
- Technical name: `API_BUSINESS_PARTNER`
- Protocol: OData V2
- Communication scenario: `SAP_COM_0008` — Business Partner, Customer and Supplier Integration
- Scope-item baseline: `1RO` — Integration of Core Master Data
- Catalog reference version: 1.7.0
- Fallback/reference version: 1.6.0
- Deployment requirement: confirm service metadata, authentication, and compatible API version in the deployed S/4HANA 2025 FPS01 system.

Initial organization Business Partner payload:

- `BusinessPartnerCategory`
- `BusinessPartnerGrouping`
- `OrganizationBPName1`
- Optional NHB search key: `SearchTerm1`

Start with the parent Business Partner entity. Add Address and Role associations only after the basic create test succeeds.

### CD-03 Payment Management

- Business object: Journal Entry
- API: Journal Entry - Post (Synchronous)
- Protocol: SOAP
- Communication scenario: `SAP_COM_0002` — Finance - Posting Integration
- Supported operation: `JOURNAL_ENTRY_CREATE_REQUEST_C`
- Relevant scope-item references: `J58` and `O58` — Accounting and Financial Close
- Deployment requirement: choose the applicable scope item and confirm service activation and authorization in the appliance.

### CD-05 Treasury & Liquidity Management

- Business object: Cash Flow
- API technical name: `CASHFLOW_IN`
- Supported operation: `CASH_FLOW_IN`
- Protocol: SOAP
- Communication scenario: `SAP_COM_0284` — Finance - Cash Management Inbound Integration
- Scope item: `34P` — Treasury Workstation Cash Integration
- Prerequisites: configure company-code value mapping and AIF monitoring in S/4HANA.

## 6. Test catalog

| ID | Test | Expected result |
|---|---|---|
| SAP-T01 | Create Business Partner | CAP creates an organization Business Partner through `API_BUSINESS_PARTNER`; SAP returns a new identifier and the record persists. |
| SAP-T02 | Read Business Partner | CAP retrieves the specified Business Partner and returns the expected master-data attributes. |
| SAP-T03 | Update Business Partner | CAP updates permitted Business Partner attributes and SAP persists the revised values. |
| SAP-T04 | Validate Payment Handoff | CAP validates, enriches, and maps valid payment instructions; invalid inputs return meaningful validation errors and a correlation ID. |
| SAP-T05 | Post Journal Entry | CAP sends `JOURNAL_ENTRY_CREATE_REQUEST_C`; SAP posts the accounting document and returns its number and status. |
| SAP-T06 | Update Cash Position and Liquidity Forecast | CAP sends `CASH_FLOW_IN`; SAP creates the external cash flow and reflects it in cash-position and liquidity-forecast reporting. |

## 7. Regression rule

Every successful test becomes a repeatable regression scenario. Record the test date, S/4HANA environment, payload reference, returned identifier, result, and any configuration dependencies.

## 8. Sources

- [Business Partner (A2X) API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/3c916ef10fc240c9afc594b346ffaf77/85043858ea0f9244e10000000a4450e5.html)
- [Cash Flow API](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/d4eb54ea54944b04923af573b28a1e7d/80ea959a2ccf4bb29e88bf0225679283.html)