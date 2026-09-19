# Islamic Banking / Murabaha Product Track

## Purpose

Build a small, non-production Murabaha financing prototype that demonstrates how Saria/NHB product development can connect Finxact, SAP CAP, and SAP S/4HANA.

## First Prototype Scope

- One Murabaha financing product using synthetic data only.
- Customer reference and optional Finxact account reference.
- Asset, supplier, asset-cost, profit, sale-price, currency, contract-date, maturity-date, and status data.
- CAP as the orchestration and product-integration layer.
- Finxact as the external core-banking/account-processing platform.
- SAP S/4HANA as the accounting and cash-management target.

## Initial Lifecycle

`DRAFT → UNDER_REVIEW → APPROVED → ASSET_PURCHASED → ACTIVE → SETTLED`

`CANCELLED` may be used before activation.

These statuses are a prototype workflow. Product rules require Sharia, legal, risk, finance, and compliance review before production use.

## Architecture Boundary

- CAP does not access Finxact or SAP databases directly.
- CAP consumes Finxact APIs through controlled credentials.
- CAP sends accounting and cash-flow events to SAP through approved SAP integration APIs.
- API credentials remain in local environment files or managed credential stores, never in Git.

## Out of Scope

- Live customer data or real financial transactions.
- Credit decisioning, pricing approval, collections, and regulatory reporting.
- Production Sharia certification or legal interpretation.
- Direct database integration with Finxact or SAP.

## Six-Week Discovery-to-Prototype Plan

1. Define the Murabaha customer journey and product rules.
2. Map Finxact account/product capabilities and SAP accounting events.
3. Add CAP lifecycle and validation logic.
4. Prototype synthetic financing, payment, and accounting scenarios.
5. Test SAP journal-entry and cash-flow handoffs when the SAP lab is available.
6. Demonstrate results and decide the next product phase.