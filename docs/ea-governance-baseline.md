# NHB Enterprise Architecture Governance Baseline

## Purpose

This document defines the minimum governance rules for the NHB Enterprise Architecture repository.

Its purpose is to keep the architecture:

- consistent
- understandable
- traceable
- maintainable
- reviewable
- suitable for portfolio and implementation use

The governance approach is intentionally lightweight.

The repository should contain only the governance controls required to preserve architectural quality and meaning.

---

# 1. Architecture Scope and Purpose

The NHB Enterprise Architecture repository provides a logical architecture baseline covering:

- Business Architecture
- Application Architecture
- Data & Information Architecture
- Integration Architecture
- Technology Architecture
- Traceability
- selected implementation evidence

The repository is designed to connect business needs to implementation through explicit architectural relationships.

The primary architecture chain is:

Business Need
    ↓
Capability
    ↓
Business Process
    ↓
Application Service
    ↓
Application Component
    ↓
Information
    ↓
Integration
    ↓
Technology
    ↓
Implementation Evidence

The repository is not intended to model every operational or technical detail.

Detailed implementation information should be introduced only when it improves:

- architectural understanding
- traceability
- decision-making
- impact analysis
- portfolio evidence

---

# 2. Repository Structure

The repository is organized into the following top-level areas:

`00 Architecture Governance`

Defines architecture scope, modeling conventions, repository rules, and baseline status.

`01 Business Architecture`

Contains:

- capabilities
- value streams
- outcomes
- business processes
- BPMN models
- BIAN reference material
- cross-domain business views

`02 Application Architecture`

Contains:

- Application Components
- Application Services
- Application Architecture Views

`03 Data & Information Architecture`

Contains:

- Information Objects
- Information Structures
- Data & Information Views

`04 Integration Architecture`

Contains:

- Integration Interactions
- Information Flow placeholders
- Integration Interface placeholders
- Integration Pattern placeholders
- Integration Service placeholders
- Integration Views

`05 Technology Architecture`

Contains:

- Technology Infrastructure
- System Software
- Technology Services
- Technology Interfaces
- Technology Views

`06 Traceability & Matrices`

Contains selected traceability artifacts required for validation, analysis, and architectural communication.

`07 Architecture Views`

Reserved for selected cross-layer, stakeholder-oriented, executive, portfolio, and implementation-realization views.

Empty packages are acceptable when no current architectural need justifies additional modeling.

---

# 3. Modeling Conventions

## General Principle

Architecture elements should be modeled once and reused across multiple diagrams.

A diagram is a view of the repository model.

It should not create duplicate architecture elements merely for presentation purposes.

The same repository element may therefore appear in multiple views.

---

## Business Capability

A Business Capability describes:

> What the enterprise must be able to do.

Capabilities should remain relatively independent of:

- organizational structure
- current applications
- specific technologies
- detailed workflow

---

## Business Process

A Business Process describes business behavior through which work is performed.

Business Processes may realize capabilities and value-stream stages where semantically appropriate.

Detailed operational execution should be modeled using BPMN rather than overloading ArchiMate process views.

---

## Application Service to Business Process

Application Services serve Business Processes.

The approved NHB v1.0 direction is:

Application Service
    → ArchiMate_Serving →
Business Process

The reverse pattern:

Business Process
    → ArchiMate_Serving →
Application Service

is considered semantically incorrect and should not be used.

---

## Application Component to Application Service

The NHB v1.0 baseline uses the simplified convention:

Application Component
    → ArchiMate_Serving →
Application Service

This convention provides direct component-to-service traceability.

A stricter ArchiMate model could introduce:

Application Component
    → Assignment →
Application Function / Application Process
    → Realization →
Application Service

The additional behavior layer is intentionally deferred for the v1.0 baseline because it would materially increase repository complexity without sufficient current architectural value.

---

## Application and Information

Application elements may use ArchiMate Access relationships to represent dependency on Information Objects.

Read/write distinctions should be introduced only where they provide meaningful architectural value.

---

## System Software and Technology Service

The approved Technology Architecture pattern is:

System Software
    → ArchiMate_Realization →
Technology Service

---

## System Software and Hosting Environment

The current approved NHB pattern is:

System Software
    → ArchiMate_Assignment →
Node / Hosting Environment

This convention should be applied consistently across the logical Technology Architecture.

---

## Integration Interactions

Application Interactions represent coordinated application behavior across domain boundaries.

They should not automatically be interpreted as:

- APIs
- endpoints
- technical interfaces
- message schemas

Technical integration detail should be added only when required by the architecture.

---

## Logical Versus Physical Architecture

Logical architecture should remain separate from vendor-specific implementation.

Examples:

Logical:
`NHB Application Runtime Platform`

Implementation:
SAP BTP Cloud Foundry / SAP CAP / Node.js

Logical:
`NHB Database Management Platform`

Implementation:
SAP HANA Cloud / HDI

Logical architecture should not be replaced by implementation technology names.

Implementation technologies should be connected through traceability where useful.

---

# 4. Naming and Versioning Rules

## Naming Principle

Element names should clearly communicate architectural responsibility.

Naming should be:

- concise
- meaningful
- consistent
- layer-appropriate

---

## Capability Naming

Capabilities should normally use noun-oriented organizational ability names.

Examples:

- Customer Management
- Credit Assessment and Decision Management
- Financing Servicing
- Treasury & Liquidity Management

---

## Business Process Naming

Business Processes should normally use action-oriented names.

Examples:

- Assess & Decide Credit
- Originate Financing
- Establish & Administer Financing Agreement
- Service Financing

---

## Application Component Naming

Application Components should describe logical application responsibility.

Examples:

- Customer Relationship Management
- Financing Agreement Management
- Financing Servicing
- Collateral Valuation & Maintenance Management

---

## Application Service Naming

Application Services should normally be verb-oriented.

Examples:

- Retrieve Customer Relationship
- Assess Creditworthiness
- Establish Financing Agreement
- Determine Financing Status
- Register Financing Collateral

---

## Domain Naming

The approved NHB v1.0 capability-domain baseline is:

- CD-01 Customer Management
- CD-02 Product Management
- CD-03 Deposit Management
- CD-04 Financing & Credit Management
- CD-05 Treasury & Liquidity Management

The same domain terminology should be used consistently across:

- Business Architecture
- Application Architecture
- Data & Information Architecture
- Integration Architecture

where applicable.

---

## Versioning

Major architecture checkpoints should be explicitly baselined.

The initial reviewed baseline is:

`NHB Enterprise Architecture Baseline v1.0`

Future changes that materially alter:

- architecture scope
- domain structure
- modeling conventions
- major relationships
- logical architecture

should be documented as later baselines or revisions.

Minor visual cleanup does not necessarily require a new architecture version.

---

# 5. Review and Baseline Status

## Repository Review Principle

A review finding does not automatically mean the architecture is incorrect.

A finding may identify:

- a semantic question
- a consistency issue
- a presentation improvement
- a future extension
- an intentionally simplified modeling convention

Findings should be classified as:

- Must Fix
- Deferred
- Resolved
- Intentionally Left As-Is

---

## Current Baseline Decisions

The following decisions have been confirmed during the v1.0 review:

### CD-03 Domain

The previous `Payment Management` domain naming was replaced with:

`Deposit Management`

across the relevant architecture layers.

---

### Collateral Application Components

The following Application Components remain separate:

- Collateral Valuation & Maintenance Management
- Financing Collateral Management

Their responsibilities are distinct.

---

### Application Service to Business Process Direction

The approved relationship is:

Application Service
    → Serving →
Business Process

Reversed relationships were identified and corrected across the repository.

---

### Application Component to Application Service

The simplified v1.0 pattern remains:

Application Component
    → Serving →
Application Service

The more formal intermediate application-behavior layer is intentionally deferred.

---

### Financing Lifecycle

The approved high-level sequence is:

Assess & Decide Credit
        ↓
Originate Financing
        ↓
Establish & Administer Financing Agreement

Within NHB, `Originate Financing` represents a narrower post-credit stage rather than the complete industry-wide origination lifecycle.

---

## Architecture Completeness Principle

A package does not need to be populated merely because it exists.

Examples currently permitted to remain empty include selected:

- Integration Information Flow
- Integration Interface
- Integration Pattern
- Integration Service
- Architecture View

packages.

Artifacts should be added only when they explain a real architectural concern.

---

## Baseline Freeze Criteria

The NHB Enterprise Architecture repository can be considered ready for Baseline v1.0 when:

- major semantic issues are resolved
- domain naming is consistent
- known relationship-direction errors are corrected
- important modeling conventions are documented
- the repository is saved and backed up
- related architecture documentation is committed
- remaining findings are explicitly resolved or intentionally deferred

---

# Key Governance Principle

> NHB architecture governance exists to preserve architectural meaning, consistency, traceability, and maintainability without introducing unnecessary modeling bureaucracy.