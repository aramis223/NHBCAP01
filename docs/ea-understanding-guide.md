# NHB Enterprise Architecture Understanding Guide

## Purpose

This document explains the conceptual structure of the NHB Enterprise Architecture repository in practical terms.

It is intended to support:

- architecture understanding
- repository review
- interview preparation
- traceability explanation
- portfolio presentation

The goal is not to memorize framework terminology.

The goal is to understand:

- what each architecture concept means
- why it exists
- how it relates to other architecture concepts
- how the repository represents those relationships
- how the architecture connects to implementation

## Current Project Baseline

`AV-03 — NHBCAP01 Architecture-to-Implementation Realization` is completed as v1.0.

The SAP Integration Suite mediation baseline is implemented and verified, and the first deep-understanding pass through CAP internals is completed.

Portfolio packaging is now the current phase.

This guide remains a learning and reference document. Earlier review observations are retained where useful, with resolved findings distinguished from remaining modeling refinements.

---

# 1. Business Capability Model

The NHB Business Capability Model provides a stable, high-level representation of what the bank must be able to do.

The current Level-1 capability domains are:

- Customer Management
- Product Management
- Deposit Management
- Financing & Credit Management
- Treasury & Liquidity Management

Capabilities describe organizational ability rather than workflow.

For example:

- Customer Management describes the bank's ability to manage customer-related activities and information.
- A process such as Establish Customer describes one way that capability is performed.

This distinction is important because processes, applications, technologies, and organizational structures can change while the underlying capability remains relatively stable.

The Level-1 capability model therefore acts as a structural backbone for the more detailed architecture contained in the CD-01 to CD-05 domain packages.

## Key Principle

A capability answers:

> What must the enterprise be able to do?

A process answers:

> How is business work performed?

---

# 2. Capability, Value Stream, Process, and Outcome

Capabilities, value streams, processes, and outcomes serve different architectural purposes.

They are related, but they should not be treated as interchangeable concepts.

## Capability

A capability describes what the enterprise must be able to do.

Examples in the NHB architecture include:

- Financing Origination Management
- Credit Assessment and Decision Management
- Financing Servicing
- Sharia Governance and Compliance

A capability focuses on organizational ability rather than workflow.

Capabilities are generally more stable than:

- processes
- applications
- technologies
- organizational structures

For example, NHB may change the way financing applications are assessed, replace the supporting systems, or reorganize the responsible department while still requiring the capability:

`Credit Assessment and Decision Management`

A capability therefore answers:

> What must the enterprise be able to do?

---

## Value Stream

A value stream describes how value progresses through a sequence of stages toward a stakeholder result.

The NHB value stream:

`Obtain Sharia-Compliant Financing`

contains stages including:

- Financing Need Qualified
- Eligibility and Creditworthiness Established
- Murabaha Offer Structured and Approved
- Asset Acquired and Sale Contract Executed
- Financed Asset Delivered
- Financing Obligations Serviced
- Financing Obligation Resolved

Each stage represents a meaningful progression in value or business state.

For example:

`Financing Need Qualified`

means that an initial financing need has progressed to a state where it is sufficiently understood and qualified for further evaluation.

A value-stream stage is not intended to describe detailed operational activities.

The detailed activities required to reach that stage belong primarily in business-process and BPMN models.

A value stream therefore answers:

> How does value progress toward the stakeholder result?

---

## Process

A business process describes business behavior through which work is performed.

Examples in the Financing & Credit Management domain include:

- Assess & Decide Credit
- Originate Financing
- Establish & Administer Financing Agreement
- Service Financing
- Manage Repayment & Settlement
- Restructure Financing
- Manage Collections & Recovery
- Manage Financing Collateral

Processes are closer to operational execution than capabilities or value streams.

They describe coordinated business behavior required to perform work and produce results.

Detailed BPMN models can then describe the execution of these processes at a more operational level.

A process therefore answers:

> How is business work performed?

---

## Outcome

An outcome represents a result or end state that the enterprise seeks to achieve.

Examples in the NHB architecture include:

- Sharia Compliance Assured
- Credit Risk Accepted Within Appetite
- Customer Financing Need Satisfied
- Contract Administered Accurately
- Financial Obligation Resolved

An outcome describes the result achieved rather than the activities used to achieve it.

For example:

`Credit Risk Accepted Within Appetite`

describes a desired business condition.

It does not describe the activities used to assess, approve, reject, or monitor credit risk.

An outcome therefore answers:

> What result or business state should be achieved?

---

## Relationship Between the Concepts

The four concepts can be understood together as follows:

Capability
    = What must NHB be able to do?

Value Stream
    = How does value progress toward a stakeholder result?

Process
    = How is business work performed?

Outcome
    = What result or business state is achieved?

They can also be viewed conceptually as:

Stakeholder Need
      │
      ▼
Value Stream
      │
      │ progresses through stages
      ▼
Desired Outcomes

Capabilities provide the abilities
required to enable those stages.

Processes provide the business behavior
through which the work is performed.

The relationship is therefore not a simple linear hierarchy.

A value-stream stage may require several capabilities.

A capability may support several value-stream stages.

Several processes may realize or contribute to one capability.

One process may contribute to multiple outcomes.

## Key Principle

> Capability describes ability, value stream describes value progression, process describes business behavior, and outcome describes the result achieved.

# 3. Many-to-Many Enablement

Capabilities and value-stream stages do not normally have simple one-to-one relationships.

A single capability may enable multiple stages of a value stream.

For example:

`Sharia Governance and Compliance`

may contribute to several stages or activities associated with:

- financing structuring
- contract execution
- servicing
- settlement
- exception handling

Likewise, one value-stream stage may depend on several capabilities.

For example:

`Asset Acquired and Sale Contract Executed`

may depend on capabilities such as:

- Asset Acquisition and Supplier Coordination
- Sharia-Compliant Financing Structuring
- Financing Agreement Management
- Sharia Governance and Compliance

This creates a many-to-many relationship between capabilities and value-stream stages.

The important point is that a capability should not be interpreted as belonging exclusively to one value-stream stage.

Similarly, a value-stream stage should not be interpreted as being enabled by only one capability.

## Why This Matters

This many-to-many structure reflects how enterprises actually operate.

Business abilities are reused across different stages of value creation, while important stages usually depend on several organizational abilities working together.

This is also one reason enterprise architecture diagrams can become relationship-dense.

The density may reflect genuine cross-domain dependencies rather than unnecessary diagram complexity.

However, the architecture should still use appropriate views so that the underlying relationships remain understandable to different audiences.

## Key Principle

> One capability may enable several value-stream stages, and one value-stream stage may depend on several capabilities.

# 4. From Capability to Process

Capabilities describe what NHB must be able to do.

Business processes describe the major business behaviors through which those capabilities are realized or supported.

Detailed BPMN models then describe the operational execution of those processes.

Example:

Capability:
`Credit Assessment and Decision Management`

Business Process:
`Assess & Decide Credit`

Detailed Process Model:
A BPMN workflow containing activities, decisions, approvals, rejections, participants, events, sequence flows, and exception paths.

The architecture therefore separates three different questions.

## Capability

What organizational ability is required?

## Business Process

What business behavior realizes or contributes to that capability?

## BPMN Process Model

How is that business behavior operationally executed?

This separation allows each modeling notation to be used at the appropriate level of abstraction.

It also prevents the architecture from becoming overloaded.

A capability model should not try to describe detailed workflow.

An ArchiMate business-process model should not try to reproduce every BPMN activity, gateway, and event.

A BPMN model should not be expected to provide the full enterprise-level traceability of capabilities, applications, information, integration, and technology.

## Key Principle

> Capability describes organizational ability, ArchiMate business process describes enterprise-level business behavior, and BPMN describes detailed operational execution.

# 5. ArchiMate Business Processes and BPMN

NHB uses ArchiMate and BPMN at different levels of abstraction.

They are complementary rather than interchangeable.

## ArchiMate Business Process

An ArchiMate Business Process represents a major business behavior and places that behavior within the wider enterprise architecture.

An ArchiMate Business Process can be related to:

- capabilities
- value streams
- outcomes
- application services
- information objects
- other business processes
- integration elements
- technology and implementation elements through traceability chains

ArchiMate therefore helps answer questions such as:

- What business behavior exists?
- Which capability does this process realize or support?
- Which value-stream stages or outcomes does it contribute to?
- Which application services support it?
- Which information does it use or produce?
- How does it relate to other architecture elements?

ArchiMate focuses on architectural context and relationships rather than detailed operational workflow.

## BPMN

BPMN describes the detailed operational execution of a business process.

Detailed BPMN models can include:

- start events
- end events
- activities
- gateways
- approval paths
- rejection paths
- exception paths
- participants
- sequence flows
- messages
- operational decisions

BPMN therefore helps answer:

> How is this business process actually executed?

BPMN is particularly useful when the sequence of activities, decision logic, participants, and operational exceptions need to be understood.

## Relationship Between ArchiMate and BPMN

The same business process can therefore be represented at two different levels.

ArchiMate provides the enterprise-architecture perspective.

BPMN provides the detailed execution perspective.

For example:

ArchiMate:
`Assess & Decide Credit`

BPMN:
The detailed workflow showing how credit information is collected, evaluated, approved, rejected, escalated, and completed.

## Key Principle

ArchiMate:
What business behavior exists, and how does it fit into the enterprise architecture?

BPMN:
How is that business behavior operationally executed?

The two notations should not be forced to perform each other's role.

# 6. Business Process Lifecycle — Financing & Credit Management

The CD-04 Financing & Credit Management business-process model contains the following major business processes:

- Assess & Decide Credit
- Originate Financing
- Establish & Administer Financing Agreement
- Manage Financing Collateral
- Service Financing
- Manage Repayment & Settlement
- Restructure Financing
- Manage Collections & Recovery

At the enterprise-architecture level, these processes form a financing lifecycle and interaction view.

The model shows how the major business processes relate to one another across the financing lifecycle.

It should not automatically be interpreted as meaning that every financing case follows one identical linear path.

For example:

- some processes may occur only under specific conditions
- restructuring may occur only when the financing arrangement needs modification
- collections and recovery may occur only when repayment problems arise
- collateral-related activities may apply differently depending on the financing product or agreement

The detailed BPMN models provide the operational execution logic for the individual processes.

This creates two complementary levels of representation:

Enterprise-Level Process View
        ↓
ArchiMate Business Processes
        ↓
Detailed Operational View
        ↓
BPMN Process Models

The ArchiMate view should remain understandable without reproducing all of the detailed operational logic contained in BPMN.

The BPMN models can then describe:

- detailed activity sequences
- decisions and gateways
- participants
- approvals and rejections
- exception paths
- operational controls
- process-specific conditions

## Important Review Point

The current high-level model shows:

`Assess & Decide Credit`

followed by:

`Originate Financing`

The intended meaning and ordering were reviewed and resolved as recorded under Resolved — Financing Lifecycle Semantics. Detailed BPMN models should remain consistent with that definition.

This is important because the term `Originate Financing` can be interpreted differently depending on the banking context.

The NHB repository uses the narrower post-credit definition of origination recorded in that resolution.

## Key Principle

> ArchiMate provides the enterprise-level financing lifecycle and process relationships, while BPMN provides the detailed execution logic for each process.

# 7. Realization: Capability to Business Process

The NHB repository explicitly relates business processes to capabilities using ArchiMate relationships.

A verified example is:

Credit Assessment and Decision Management
              Capability
                  ▲
                  │
             Realization
                  │
                  │
        Assess & Decide Credit
          Business Process

## Verified Relationship

The business process:

`Assess & Decide Credit`

realizes the capability:

`Credit Assessment and Decision Management`

This relationship was verified directly in the Sparx EA repository.

## Meaning of Realization

The capability describes what the bank must be able to do.

The business process describes business behavior through which that capability is made concrete and operational.

The Realization relationship makes this semantic meaning explicit in the repository.

Without the relationship, the two elements could simply appear near one another on a diagram.

With the Realization relationship, the repository contains an explicit architectural statement:

`Assess & Decide Credit` realizes `Credit Assessment and Decision Management`.

This makes the architecture traceable and queryable rather than purely visual.

For example, the repository can support questions such as:

- Which processes realize this capability?
- Which capabilities are realized by this process?
- Which application services support the realizing process?
- Which information objects are involved?
- Which integration and technology elements ultimately support the capability?

## Why This Matters

Enterprise architecture is not only about identifying elements.

The relationships between those elements give the model its meaning.

A capability without relationships may tell us that an organizational ability exists.

A process without relationships may tell us that a business behavior exists.

The Realization relationship explains how those two architectural concepts are connected.

## Key Principle

> Boxes tell us what exists. Relationships tell us what the architecture means.

This is one of the most important principles in the NHB repository.

# 8. Why Explicit Relationships Matter

Enterprise architecture is not simply a collection of diagrams.

A repository becomes useful when architecture elements are connected through explicit and meaningful relationships.

Those relationships create traceability across architecture layers.

For example, a traceability chain can connect:

Capability
    ↑
Business Process
    ↑
Application Service
    ↕
Information
    ↓
Integration / Application
    ↓
Technology
    ↓
Implementation Evidence

Each relationship in the chain should express a defined architectural meaning.

The value does not come from placing elements on the same diagram.

The value comes from explicitly modeling how those elements relate to one another.

This allows architectural questions such as:

- Which processes realize a capability?
- Which capabilities depend on a given business process?
- Which application services support those processes?
- Which information objects are used or produced?
- Which applications provide the required services?
- Which external APIs or integrations are involved?
- Which technology platforms support the solution?
- Which implementation evidence proves that the architecture has been realized?

Explicit relationships also improve impact analysis.

For example, if an application service is replaced, the repository can help identify:

- which business processes depend on it
- which capabilities may be affected
- which information objects are involved
- which integrations must be reviewed
- which technology components may change

This makes the repository useful for architecture analysis, change assessment, design decisions, and implementation traceability.

## Semantic Traceability

Traceability should not depend only on visual layout.

Two elements appearing next to each other on a diagram do not automatically have an architectural relationship.

The relationship must be explicitly modeled.

This is what transforms the repository from a set of pictures into a structured enterprise model.

## Key Principle

> Architecture elements provide the structure, but explicit relationships provide the meaning and traceability.

# 9. Repository Structure Versus Architecture Content

A package is a repository container.

It helps organize architecture material, but it is not itself the architecture.

Architecture content consists of:

- elements
- relationships
- diagrams
- views
- metadata
- traceability

For example, the Business Architecture area contains:

- capability-domain packages
- reference architecture
- value streams
- outcomes
- capabilities
- traceability views
- business-process models

The package hierarchy provides structure and navigation.

The architecture itself is created by the modeled elements and the relationships between them.

## Packages

Packages organize repository content.

They help separate domains, architecture layers, viewpoints, reference material, and detailed models.

A package can therefore be understood as a logical container for architecture content.

## Elements and Relationships

Elements represent architectural concepts such as:

- capabilities
- business processes
- outcomes
- application services
- information objects
- technology components

Relationships explain how those concepts are connected.

Together, elements and relationships form the underlying architecture model.

## Diagrams and Views

A diagram presents selected architecture elements and relationships for a particular purpose.

A view is therefore not the complete architecture.

It is a representation of part of the underlying model for a particular audience or question.

The same architecture element may appear in several diagrams without being duplicated as a separate architectural concept.

## Key Principle

> Packages organize the repository, elements and relationships form the architecture model, and diagrams provide selected views of that model.

# 10. Current Business Architecture Structure

The current NHB Business Architecture is organized around five primary domain packages:

- CD-01 Customer Management
- CD-02 Product Management
- CD-03 Deposit Management
- CD-04 Financing & Credit Management
- CD-05 Treasury & Liquidity Management

These domain packages contain the detailed business architecture for their respective areas.

The Business Architecture area also contains cross-domain and enterprise-level content, including:

- BIAN Reference Architecture
- End-to-End Traceability Views
- Business Capability Model
- VS-04.01 — Obtain Sharia-Compliant Financing
- cross-domain outcomes
- cross-domain capabilities

This structure separates detailed domain architecture from enterprise-level architecture views and concepts.

## Domain Packages

The CD-01 to CD-05 packages organize detailed architecture content by business domain.

They provide a place for domain-specific:

- capabilities
- business processes
- detailed process models
- information objects
- relationships
- traceability

## Cross-Domain Content

Cross-domain content represents architectural concepts that span more than one business domain or provide an enterprise-wide perspective.

Examples include:

- enterprise capability views
- value streams
- outcomes
- reference architecture
- end-to-end traceability views

This allows the repository to support both detailed domain analysis and broader enterprise-level understanding.

## Key Principle

> Domain packages organize detailed business architecture, while cross-domain views show how those domains contribute to wider enterprise capabilities, value streams, outcomes, and traceability.

# 11. Cross-Cutting Capabilities

The NHB value-stream model includes:

`Sharia Governance and Compliance`

as a capability.

This capability is not currently represented as one of the five primary Level-1 operating capability domains:

- Customer Management
- Product Management
- Deposit Management
- Financing & Credit Management
- Treasury & Liquidity Management

This may be intentional.

Some capabilities do not belong exclusively to one operating domain.

Instead, they may support multiple domains and multiple stages of value creation.

`Sharia Governance and Compliance` is a good example because it may influence:

- product design
- financing structuring
- contract execution
- servicing
- settlement
- exception handling
- governance and approval activities

For this reason, it may be more appropriate to treat it as a cross-cutting, enabling, or governance capability rather than as a separate operating domain.

## Why Cross-Cutting Capabilities Matter

Cross-cutting capabilities represent organizational abilities that are reused across multiple parts of the enterprise.

They help avoid forcing an enterprise-wide concern into a single business domain where its scope would appear narrower than it actually is.

Examples of capabilities that are often cross-cutting in enterprise architecture include:

- governance
- risk management
- compliance
- security
- data management
- audit
- architecture management

The exact classification depends on the enterprise architecture method and repository design.

## Repository Implication

The NHB repository should explicitly document how it distinguishes between:

- operating capability domains
- enabling capabilities
- cross-cutting capabilities
- governance capabilities

This will help future reviewers understand why some capabilities appear in enterprise-level views but not in the primary Level-1 domain model.

## Key Principle

> Not every important capability needs to be a primary operating domain; some capabilities are enterprise-wide and intentionally cross-cutting.

# 12. Repository Review Findings

This section records observations discovered during the architecture understanding review.

These are review items rather than immediate change instructions.

The purpose is to identify areas that should be verified, clarified, or documented before the repository is considered final.

## G-01 — Architecture Governance Package

### Observation

The package:

`00 Architecture Governance`

previously contained no substantive architecture-governance artifacts. This observation is resolved by the Architecture Governance Baseline recorded below.

### Interpretation

At the time of the initial review, the package acted as a placeholder rather than an active governance layer.

### Governance Reference Content

Governance artifacts may include:

- architecture scope
- repository structure guidance
- modeling conventions
- naming conventions
- versioning rules
- architecture principles
- standards references
- relationship conventions
- review and approval guidance

The governance layer should remain lightweight, practical, and useful rather than becoming unnecessary bureaucracy.

### Action

Maintain the established lightweight governance baseline and introduce further artifacts only where required to keep the repository understandable, consistent, and maintainable.

---

## R-02 — Sharia Governance Capability Placement

### Observation

`Sharia Governance and Compliance`

appears in the Sharia-compliant financing value-stream view but is not represented as one of the five primary Level-1 capability domains.

### Review Question

Confirm whether it should be explicitly classified as:

- a cross-cutting capability
- an enabling capability
- a governance capability
- or another defined architecture category

### Action

Document the intended classification during repository finalization.

Also verify that its representation is consistent across:

- the Business Capability Model
- value-stream views
- domain models
- traceability views

---

## R-03 — Detailed Relationship Semantics

### Observation

The relationship list for:

`Assess & Decide Credit`

includes several detailed activity connections displayed as:

- Connection: Association
- Stereotype: ArchiMate_Serving

### Review Question

Verify whether this representation reflects:

- intentional ArchiMate relationship semantics
- Sparx EA rendering or property-display behavior
- imported relationship stereotypes
- legacy modeling conventions
- or inconsistent connector configuration

### Action

Do not change these relationships until the detailed traceability structure has been reviewed.

The review should confirm both:

- the semantic relationship intended by the architecture
- the actual connector type stored in Sparx EA

---

## Review Principle

Repository findings should be treated as controlled review items.

A finding does not automatically mean that the model is wrong.

It means that the architecture contains an area where semantics, consistency, governance, or presentation should be verified before finalization.

## Key Principle

> Review findings help us distinguish between verified architecture, open semantic questions, and repository improvements that should be addressed before the final baseline is frozen.

## Resolved Findings

### Resolved — CD-03 Domain Baseline Consistency

The repository previously used `Payment Management` as the CD-03 / AC-03 / AS-03 domain name while the underlying business processes, application components, information structures, and integration scenarios were primarily deposit-oriented.

The baseline has now been corrected to:

- CD-03 Deposit Management
- AC-03 Deposit Management
- AS-03 Deposit Management
- Level-1 Business Capability: Deposit Management

This resolves the earlier cross-layer naming inconsistency.

Genuine payment concepts such as `Payment Instruction` remain unchanged because they represent separate business information rather than the Level-1 domain name.

---

### Resolved — Collateral Application Component Overlap

Two Application Components exist in AC-04:

- Collateral Valuation & Maintenance Management
- Financing Collateral Management

Their service responsibilities were reviewed and found to be distinct.

`Collateral Valuation & Maintenance Management` supports:

- Determine Collateral Value
- Maintain Collateral
- Retrieve Collateral Information

`Financing Collateral Management` supports:

- Register Financing Collateral
- Allocate Collateral to Financing
- Release Financing Collateral

The elements therefore remain separate.

The former `Collateral Management` Application Component was renamed to:

`Collateral Valuation & Maintenance Management`

to clarify its responsibility and distinguish it from the separate Capability and BIAN Service Domain named `Collateral Management`.

The renamed repository element is reused across the Application Component Model, TR-04, and AR-04, and the name change propagated consistently across those views.

---

### Resolved — Business Process to Application Service Serving Direction

A repository-wide semantic issue was identified in which multiple relationships used:

Business Process
    → Serving →
Application Service

The approved NHB v1.0 modeling convention is:

Application Service
    → Serving →
Business Process

The relationship direction has now been corrected consistently across all affected Business Process-to-Application Service mappings.

The `ArchiMate_Serving` stereotype was retained.

The Application Component-to-Application Service simplified convention remains unchanged for the v1.0 baseline.

---

### Resolved — Financing Lifecycle Semantics

The CD-04 financing lifecycle was reviewed.

The intended high-level sequence is:

Assess & Decide Credit
        ↓
Originate Financing
        ↓
Establish & Administer Financing Agreement

The sequence is intentional.

Within the NHB architecture, `Originate Financing` is used in a narrower sense than the broader industry term "financing origination."

It represents the post-credit stage in which an approved financing case is progressed toward formal financing establishment.

Credit assessment and decision therefore occur before this NHB-defined origination stage.

The repository retains this sequence, with the detailed BPMN models expected to remain consistent with this definition.

This resolves the earlier concern regarding the apparent ordering of credit assessment and financing origination.

---

### Resolved — Architecture Governance Baseline

The package:

`00 Architecture Governance`

previously existed only as a placeholder without substantive governance content.

A lightweight governance baseline has now been established.

The supporting document is:

`docs/ea-governance-baseline.md`

The governance baseline defines:

- architecture scope and purpose
- repository structure
- modeling conventions
- naming and versioning rules
- review and baseline status

The Sparx EA governance package has also been populated with corresponding governance artifacts and an:

`NHB Enterprise Architecture Baseline v1.0 Review`

element.

The governance approach is intentionally lightweight and focused on preserving:

- architectural meaning
- consistency
- traceability
- maintainability
- reviewability

This resolves G-01.

---

### Resolved — Business Process to Application Service Traceability Review

The Business Process-to-Application Service relationships were reviewed across the repository.

The approved NHB v1.0 convention is:

Application Service
    → ArchiMate_Serving →
Business Process

Reversed Serving relationships were corrected.

The review also identified domains where Business Process-to-Application Service traceability was incomplete.

The missing mappings were reviewed and completed for the affected domains.

This establishes a consistent Business-to-Application traceability baseline for the v1.0 repository.

---

### Resolved — Architecture View Baseline

The architecture view baseline was reviewed and strengthened to provide concise cross-layer views suitable for architecture communication and portfolio presentation.

Two high-value architecture views were established:

- AV-01 — NHB Enterprise Architecture Overview
- AV-02 — Sharia-Compliant Financing End-to-End View

AV-01 provides a representative cross-layer view spanning:

- Business
- Application
- Information
- Integration
- Technology

AV-02 provides a readable end-to-end financing journey across:

- Value / Business
- Business Process
- Application
- Information

Both views deliberately show representative relationships rather than reproducing the full underlying repository traceability.

Detailed mappings remain available in the domain and traceability views.

This establishes a concise architecture-view baseline for v1.0.

---

### Resolved — Architecture-to-Implementation Realization View

`AV-03 — NHBCAP01 Architecture-to-Implementation Realization`

is completed as v1.0.

The earlier deferral has been superseded by the completed realization view, which connects enterprise and application architecture to verified NHBCAP01 implementation evidence.

The SAP Integration Suite mediation baseline is implemented and verified. The first deep-understanding pass through CAP internals is also completed.

The current phase is portfolio packaging: presenting the completed baseline and its evidence clearly while preserving the separation between logical architecture and implementation.

---

## Deferred Findings

The following items were reviewed and intentionally deferred from the NHB Enterprise Architecture Baseline v1.0.

They do not prevent the repository from being baselined because they represent further architecture maturity or optional presentation improvements rather than unresolved baseline defects.

---

### Deferred — Application Service Granularity Review

The current Application Service catalogue is sufficient for the v1.0 architecture baseline.

Further consolidation or refinement of service granularity may be considered as implementation experience increases.

No restructuring is required for the current baseline.

---

### Deferred — Information Ownership and System-of-Record Modeling

The repository currently models the principal Information Objects and their architectural relationships.

Explicit ownership, authoritative source, and system-of-record responsibilities are not yet modeled consistently across all domains.

These concerns are intentionally deferred until the implementation and data architecture are sufficiently mature to support evidence-based ownership decisions.

---

### Deferred — Information Flow Expansion

The current repository captures information relationships and selected integration interactions.

A comprehensive Information Flow model has not yet been introduced.

This is deferred until concrete integration scenarios justify explicit flow modeling.

---

### Deferred — Integration Interfaces, Patterns, and Services

The Integration Architecture contains the current interaction baseline, while several packages remain intentionally unpopulated.

Detailed modeling of:

- Integration Interfaces
- Integration Patterns
- Integration Services
- explicit Integration Information Flows

will be introduced only when supported by concrete implementation requirements.

NHBCAP01 now provides SAP and external-provider integration evidence, including the implemented and verified SAP Integration Suite mediation baseline. Further EA modeling should use that evidence selectively where it improves architectural understanding.

---

### Deferred — Technology Security Service Realization

`NHB Technology Security Service` remains a cross-cutting Technology Service without a single dedicated realizing System Software element.

This is intentional for the v1.0 logical architecture.

NHBCAP01 already provides security implementation evidence, including XSUAA, OAuth 2.0, and JWT-based access control. Further modeling of the cross-cutting service should use that evidence without implying that AV-03 remains deferred.

---

### Deferred — Further Logical-to-Physical Technology Mapping

The Technology Architecture continues to represent the logical target architecture.

AV-03 v1.0 now provides the NHBCAP01 architecture-to-implementation realization view.

Further mapping beyond that completed baseline remains selective and should be supported by verified deployment and integration evidence.

Candidate extensions should not be treated as implemented merely because a technology is listed or considered.

The logical architecture should remain distinct from concrete products and deployed services.

---

### Deferred — Traceability View Presentation Improvements

Some traceability diagrams may benefit from further presentation refinement or expanded visual coverage.

The underlying repository relationships are considered sufficient for the v1.0 baseline.

Additional diagrams should be created only where they provide meaningful architecture communication value rather than for structural symmetry.

---

# 13. Core Concepts to Remember

The following concepts should be explainable in practical terms without referring to formal framework definitions.

## Capability

What the enterprise must be able to do.

Example:

`Credit Assessment and Decision Management`

---

## Value Stream

How value progresses through a sequence of stages toward a stakeholder result.

Example:

`Obtain Sharia-Compliant Financing`

---

## Outcome

The result or business state that is achieved.

Example:

`Credit Risk Accepted Within Appetite`

---

## Business Process

Business behavior through which work is performed.

Example:

`Assess & Decide Credit`

---

## BPMN Process

The detailed operational execution of business behavior.

It can describe:

- activities
- events
- participants
- decisions
- approvals
- exceptions
- sequence flows

---

## Realization

A relationship showing that one element makes another more concrete or operational.

In the NHB business architecture:

Business Process
        │
        └── realizes ──> Capability

Example:

`Assess & Decide Credit`

realizes:

`Credit Assessment and Decision Management`

---

## Application Service

A defined application behavior or function provided to support business or other application needs.

An application service helps connect business architecture to application architecture.

It answers:

> What application behavior is provided to support the business?

---

## Traceability

The ability to follow architectural meaning across layers rather than treating each model independently.

For example:

Capability
    ↓
Business Process
    ↓
Application Service
    ↓
Information
    ↓
Integration
    ↓
Technology
    ↓
Implementation Evidence

Traceability allows the architecture to explain how business needs are connected to implementation.

---

## View

A representation of selected architecture content for a particular purpose or audience.

A view does not represent the whole architecture.

It presents the relevant elements and relationships needed to answer a particular architectural question.

---

## Key Principle

> These concepts should be understood by meaning and purpose, not memorized only as framework terminology.

# 14. Architecture Understanding Principle

The NHB Enterprise Architecture repository should be understood as a connected model rather than as a collection of independent diagrams.

A useful mental model is:

Why does the enterprise need this?
            ↓
Stakeholder Need / Outcome / Value
            ↓
What must the enterprise be able to do?
            ↓
Capability
            ↓
What business behavior performs or realizes it?
            ↓
Business Process
            ↓
How is the work operationally executed?
            ↓
BPMN
            ↓
What application behavior supports the business?
            ↓
Application Architecture
            ↓
What information is required, used, or produced?
            ↓
Data & Information Architecture
            ↓
How do applications and external systems communicate?
            ↓
Integration Architecture
            ↓
What platform and technology support the solution?
            ↓
Technology Architecture
            ↓
How do we verify that the architecture is implemented?
            ↓
Implementation and Traceability Evidence

This chain should not be interpreted as a rigid one-way hierarchy.

Enterprise architecture contains many cross-layer and many-to-many relationships.

For example:

- one capability may be realized by several processes
- one process may use several application services
- one application service may support several processes
- one information object may be used across multiple domains
- one integration service may connect several applications
- one technology platform may host multiple application components

The purpose of the architecture repository is therefore to preserve these relationships and make them understandable, traceable, and reviewable.

## Living Learning Document

This document should remain a living learning and architecture-understanding guide.

The guide already covers the principal architecture layers. As understanding evolves, the existing sections should be maintained and selectively extended for:

- Application Architecture
- Data & Information Architecture
- Integration Architecture
- Technology Architecture
- End-to-End Traceability
- Architecture Governance
- Architecture Decisions
- Implementation Evidence

The document should evolve together with the repository review rather than being treated as a one-time study note.

## Key Principle

> The value of the NHB repository comes from understanding how business need, capability, process, application, information, integration, technology, and implementation evidence connect as one architecture.

## R-08 — Application Component-Service Relationship Semantics

### Observation

In AR-04 — Financing Component-Service Realization, the application service:

`Establish Financing Agreement`

is related to the application component:

`Financing Agreement Management`

with a connector displayed by Sparx as:

- Connection: Association
- Stereotype: ArchiMate_Serving

The same application service is related to the business process:

`Establish & Administer Financing Agreement`

using an ArchiMate Serving relationship.

### Interpretation

The service-to-business-process relationship is consistent with the idea that an application service supports business behavior.

The component-to-service relationship requires further semantic verification.

The diagram title uses the term `Component-Service Realization`, but the inspected connector is currently represented as `ArchiMate_Serving`.

### Action

Verify the intended ArchiMate pattern for:

Application Component → Application Service

before changing the repository.

Also confirm whether Sparx EA's underlying UML connector type and ArchiMate stereotype are being interpreted consistently throughout the repository.


# 15. Application Architecture

The NHB Application Architecture describes the logical application building blocks, services, interfaces, and relationships that support the business architecture.

It provides the bridge between:

- business processes
- application behavior
- logical application components
- information objects
- integration
- technology

The current Application Architecture is organized into three main areas:

- Application Components
- Application Services
- Application Architecture Views

---

## Application Components

An Application Component represents a logical part of the application architecture that provides application functionality.

Examples in the NHB repository include:

- Customer Relationship Management
- Product Pricing Management
- Credit Assessment & Decision Management
- Financing Agreement Management
- Financing Servicing
- Liquidity Management

Application Components should not automatically be interpreted as separate commercial software products or deployed systems.

They represent logical application responsibilities.

For example:

`Credit Assessment & Decision Management`

as an Application Component means that the application architecture contains a logical application responsibility for supporting credit-assessment and decision functionality.

It does not necessarily mean that NHB has a standalone software product with exactly that name.

An Application Component therefore answers:

> What logical application building block provides application functionality?

---

## Business Capability Versus Application Component

A Business Capability and an Application Component may have similar names while representing completely different architectural concepts.

For example:

Business Capability:

`Credit Assessment and Decision Management`

means:

The bank has the organizational ability to assess creditworthiness and make credit decisions.

Application Component:

`Credit Assessment & Decision Management`

means:

The application architecture contains a logical component that supports credit-assessment and decision functionality.

The similarity in naming does not make them the same element.

They belong to different architecture layers.

Business Capability
    = organizational ability

Application Component
    = logical application building block

This distinction is important because business capabilities should remain relatively independent of the specific applications used to support them.

---

## Application Services

An Application Service represents application behavior exposed to support business or application needs.

Examples in the Financing & Credit Management domain include:

- Initiate Credit Assessment
- Assess Creditworthiness
- Evaluate Credit Exposure
- Determine Credit Decision
- Establish Financing Agreement
- Retrieve Financing Agreement
- Maintain Financing Agreement
- Record Repayment
- Determine Financing Status
- Register Financing Collateral
- Initiate Recovery Action
- Close Collection & Recovery Case

Application Service names are generally behavior-oriented.

Many of the NHB services use verbs such as:

- Assess
- Determine
- Retrieve
- Maintain
- Initiate
- Record
- Register
- Allocate
- Release
- Close

This helps distinguish application behavior from application structure.

An Application Service therefore answers:

> What application behavior is provided to support the business?

---

## Application Component Versus Application Service

Application Components and Application Services serve different purposes.

Application Component:

`Financing Agreement Management`

Application Services:

- Establish Financing Agreement
- Retrieve Financing Agreement
- Maintain Financing Agreement
- Amend Financing Agreement
- Terminate Financing Agreement

The component represents the logical application building block.

The services represent the application behavior exposed by or associated with that component.

A useful mental model is:

Application Component
        ↓
Application Services

or:

WHAT provides application functionality?
        ↓
Application Component

WHAT application behavior is provided?
        ↓
Application Service

---

## Verified Financing Agreement Example

The following relationship pattern was verified directly in the Sparx EA repository.

Application Component:

`Financing Agreement Management`

is directly related to the following Application Services:

- Establish Financing Agreement
- Retrieve Financing Agreement
- Maintain Financing Agreement
- Amend Financing Agreement
- Terminate Financing Agreement

Sparx EA displays these connectors as:

- Connection: Association
- Stereotype: ArchiMate_Serving

The component also has ArchiMate Access relationships to information objects including:

- Customer
- Customer Profile
- Credit Assessment
- Credit Decision
- Financing
- Financing Agreement
- Financing Application
- Financing Collateral
- Financing Origination Case
- Financing Schedule
- Funding Arrangement
- Product
- Product Offering

This demonstrates that an Application Component can act as a traceability point between:

- application behavior
- business information
- business processes

---

## Application Service to Business Process

The repository also connects Application Services to Business Processes.

For example:

Application Service:

`Establish Financing Agreement`

is related to the Business Process:

`Establish & Administer Financing Agreement`

using an ArchiMate Serving relationship.

Conceptually:

Application Service
        │
        │ serves
        ▼
Business Process

This means that the application behavior supports the execution of the business process.

The Business Process does not need to know the internal implementation details of the Application Component.

It consumes or depends on application behavior through the service layer.

---

## Business-to-Application Traceability

The relationship between Business Architecture and Application Architecture can therefore be understood as:

Business Capability
        ↓
Business Process
        ↓
Application Service
        ↓
Application Component

For example:

Credit Assessment and Decision Management
        Capability
            ↓
Assess & Decide Credit
        Business Process
            ↓
Assess Creditworthiness
Evaluate Credit Exposure
Determine Credit Decision
        Application Services
            ↓
Credit Assessment & Decision Management
        Application Component

This creates a clear separation between:

- organizational ability
- business behavior
- application behavior
- application structure

---

## Application Services and Information

Application Services are also related to business and information objects.

For example:

`Establish Financing Agreement`

is connected to information objects such as:

- Customer
- Financing
- Financing Agreement
- Financing Application
- Financing Schedule
- Product
- Product Offering

This means that Application Architecture is not isolated from Data & Information Architecture.

Application behavior can be traced to the information it uses, accesses, creates, or modifies.

A conceptual traceability chain is:

Business Process
        ↓
Application Service
        ↓
Application Component
        ↓
Information Objects

This relationship will be developed further in the Data & Information Architecture review.

---

## Application Component Model

The NHB Application Component Model provides a catalog or landscape view of the logical application components.

It primarily answers:

> What logical application components exist in the NHB architecture?

The model does not attempt to show all component interactions or integrations.

This keeps the catalog view readable.

Detailed relationships are presented through dedicated architecture views.

---

## Application Service Model

The NHB Application Service Model provides a catalog or landscape view of the application services.

It primarily answers:

> What application services exist in the NHB architecture?

The model acts as a service catalog rather than a detailed interaction model.

Provider, consumer, information, and traceability relationships are shown through other repository relationships and dedicated architecture views.

---

## Application Architecture Views

Dedicated Application Architecture Views provide more detailed relationship models.

The repository currently contains:

- AR-04 — Financing Component-Service Realization
- AR-05 — Treasury Component-Service Realization

These views show how Application Components are related to Application Services.

The financing realization view demonstrates that one Application Component may provide or support several Application Services.

It also shows that the relationship between components and services may be many-to-many rather than strictly one-to-one.

---

## Application Interface

The Application Component Model also contains an Application Interface:

`Customer Relationship Management Interface`

An Application Interface represents a point of access through which application behavior or services can be exposed or consumed.

An Application Interface therefore answers:

> Through what application access point can functionality or services be accessed?

Interfaces should be distinguished from:

- Application Components
- Application Services
- APIs
- integration flows

The exact role of the CRM interface should be reviewed later when the Integration Architecture is examined.

---

## Simplified NHB Application Architecture Pattern

The current repository can be understood through the following simplified pattern:

Business Capability
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

This pattern provides traceability from business need to application support and implementation, with AV-03 v1.0 presenting the NHBCAP01 realization baseline.

---

## Important Semantic Note

The current NHB repository uses a simplified application-modeling pattern.

For example, Application Components are directly connected to Application Services using connectors with:

- UML base connection: Association
- ArchiMate stereotype: Serving

A more formal ArchiMate pattern may introduce internal application behavior such as Application Functions or Application Processes between the component and service.

For example:

Application Component
        ↓ Assignment
Application Function / Process
        ↓ Realization
Application Service
        ↓ Serving
Business Process

The NHB repository currently simplifies this pattern.

This is not automatically incorrect, but the intended modeling convention should be explicitly reviewed and documented before the final repository baseline is frozen.

## Application Modeling Convention — v1.0

For the NHB EA v1.0 baseline, the following application-layer conventions apply.

### Application Service to Business Process

Application Services serve Business Processes.

Correct direction:

Application Service
    → Serving →
Business Process

Any reversed Business Process → Serving → Application Service relationships are considered semantic errors and should be corrected.

### Application Component to Application Service

The NHB v1.0 repository uses the simplified convention:

Application Component
    → Serving →
Application Service

This provides direct component-to-service traceability without introducing an intermediate Application Function or Application Process layer.

A stricter ArchiMate pattern could use:

Application Component
    → Assignment →
Application Function / Application Process
    → Realization →
Application Service

The more detailed pattern is intentionally deferred for the v1.0 baseline because introducing a complete application-behavior layer would add substantial model complexity without sufficient additional value for the current architecture scope.

### Business Process to Capability / Value Stream

Business Processes may use Realization relationships to capabilities and value-stream stages where the relationship is architecturally intentional.

### Application to Information

Application elements use ArchiMate Access relationships to express dependencies on Information Objects.

Read/write distinctions should only be introduced where they provide meaningful architectural value.

## Key Principle

> NHB v1.0 favors semantically clear traceability with controlled simplification rather than adding modeling layers solely for formal completeness.

---

## Current Review Findings

### R-04 — AC-03 Domain Naming Consistency

The package:

`AC-03 Deposit Management`

currently contains application components such as:

- Deposit Account Management
- Deposit Balance & Position Management
- Deposit Maturity Management
- Deposit Profit / Return Management
- Deposit Transaction & Activity Management

These elements appear semantically closer to Deposit Management than Payment Management.

The cross-layer baseline has been confirmed as Deposit Management, as recorded under Resolved — CD-03 Domain Baseline Consistency. This finding is resolved.

---

### R-05 — Application Service Granularity

The Application Service catalog contains services at a relatively detailed level.

Examples include:

- Retrieve Financing
- Retrieve Financing Agreement
- Retrieve Financing Application
- Determine Financing Status
- Maintain Financing Agreement
- Manage Financing Schedule

The granularity may be appropriate, but consistency should be verified across AS-01 to AS-05.

The service catalog should follow a clear and repeatable modeling rule.

---

### R-06 — Layer Naming Alignment

Some Business Capabilities, Application Components, and Application Services use similar terminology.

This may improve traceability but can also create ambiguity.

The repository should ensure that reviewers can clearly distinguish:

- business capability
- business process
- application component
- application service

even when their names are similar.

---

### R-07 — Application Realization View Coverage

Application Architecture currently contains explicit component-service realization views for:

- Financing
- Treasury

Equivalent realization views are not currently visible for:

- Customer
- Product
- Payment

Confirm whether the current coverage is intentional or whether equivalent views should be created for the other domains.

---

### R-08 — Application Component-Service Relationship Semantics

The relationship between:

`Financing Agreement Management`

and its Application Services is verified in the repository.

Sparx EA represents these connectors as:

- Connection: Association
- Stereotype: ArchiMate_Serving

The mapping itself is therefore confirmed.

The remaining review question is whether Serving is the intended ArchiMate semantic for direct Application Component-to-Application Service relationships.

The repository should confirm and document the chosen modeling convention before finalization.

---

## Key Principles

Application Component
    = logical application building block

Application Service
    = application behavior provided to consumers

Application Interface
    = access point through which application behavior can be accessed

Business Process
    = business behavior supported by application services

Information Object
    = business information accessed or manipulated by application behavior

The central traceability concept is:

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

## Key Principle

> Application Architecture explains how logical application components and services support business behavior while remaining traceable to information, integration, and technology.

# 16. Data & Information Architecture

The NHB Data & Information Architecture describes the business information concepts used across the enterprise and the relationships between them.

It provides the information layer that connects:

- business processes
- application services
- application components
- integration
- technology
- implementation

The current Data & Information Architecture is organized into:

- Information Objects
- Information Structures
- Data & Information Views

---

## Information Objects

An Information Object represents a meaningful business information concept.

In the NHB repository, these are modeled using ArchiMate Business Objects.

Examples include:

- Customer
- Customer Profile
- Product
- Product Offering
- Credit Assessment
- Credit Decision
- Financing
- Financing Agreement
- Financing Application
- Financing Schedule
- Financing Position
- Financing Collateral
- Repayment
- Repayment Obligation
- Collection Case
- Recovery Arrangement
- Recovery Action
- Liquidity Forecast
- Treasury Position
- Payment Instruction

An Information Object represents business meaning rather than physical storage.

For example:

`Financing Agreement`

represents the business concept of a financing agreement.

It does not specify:

- database tables
- database columns
- storage technology
- API payload format
- physical schema

An Information Object therefore answers:

> What meaningful business information concept exists?

---

## Conceptual Information Versus Physical Data

The Data & Information Architecture should remain separate from physical implementation details.

A useful distinction is:

Information Object
    = business meaning

Information Structure
    = organization and relationships between information concepts

Physical Data Model
    = implementation structure such as tables, fields, keys, schemas, and storage

For example:

`Customer`

may appear as one Information Object in the enterprise architecture.

In implementation, customer information may be distributed across:

- database entities
- API payloads
- external provider systems
- SAP entities
- CAP CDS entities
- integration messages

The architecture therefore preserves business meaning independently of the technical implementation.

---

## Information Object Model

The NHB Information Object Model shows semantic relationships between important business information concepts.

Examples include:

Product
    ↓
Product Offering
    ↓
Product Distribution
    ├── Product Availability Rule
    └── Distribution Version

Customer
    ├── Customer Profile
    └── Financing Application

Financing Application
    ├── Credit Assessment
    ├── Credit Decision
    └── Financing Origination Case

Financing Origination Case
    ↓
Financing Agreement
    ↓
Financing

Financing
    ├── Financing Schedule
    ├── Financing Position
    ├── Repayment Obligation
    ├── Financing Collateral
    └── Collection Case

Repayment Obligation
    ↓
Repayment
    ↓
Financing Modification

Financing Collateral
    ↓
Collateral Valuation

Collection Case
    ├── Recovery Arrangement
    └── Recovery Action

The Information Object Model therefore answers:

> How are the major business information concepts related to one another?

---

## Information Structure Model

The NHB Information Structure Model organizes information objects into broader domain-oriented structures.

The current model includes:

- Customer Information Structure
- Product Information Structure
- Payment Information Structure
- Financing & Credit Management
- Deposit Management Information Structure
- Treasury & Liquidity Information Structure

The Information Structure Model provides a domain-oriented organization of related information concepts.

For example:

Customer Information Structure
    ├── Customer
    └── Customer Profile

Product Information Structure
    ├── Product
    ├── Product Offering
    ├── Product Distribution
    ├── Distribution Version
    └── Product Availability Rule

Financing & Credit Management
    ├── Financing Application
    ├── Credit Assessment
    ├── Credit Decision
    ├── Financing Origination Case
    ├── Financing Agreement
    ├── Financing
    ├── Financing Schedule
    ├── Financing Position
    ├── Repayment Obligation
    ├── Repayment
    ├── Financing Collateral
    ├── Collateral Valuation
    ├── Collection Case
    ├── Recovery Arrangement
    └── Recovery Action

Treasury & Liquidity Information Structure
    ├── Liquidity Position
    ├── Liquidity Forecast
    ├── Liquidity Requirement
    ├── Funding Requirement
    ├── Funding Arrangement
    ├── Treasury Transaction
    ├── Treasury Position
    ├── Treasury Holding
    ├── Treasury Exposure
    └── Treasury Reconciliation Result

The Information Structure Model therefore answers:

> How are related information concepts grouped and organized by business domain?

---

## Information Object Model Versus Information Structure Model

The two models serve different purposes.

Information Object Model
    = shows semantic relationships between information concepts

Information Structure Model
    = groups information concepts into domain-oriented structures

The same Information Object may appear in both views.

This does not create a duplicate architecture element.

It means that the same underlying repository element is being presented through different architecture views.

---

## Cross-Domain Information

Information objects are not necessarily confined to one business domain.

For example:

`Customer`

belongs naturally to Customer Management, but it is also required in:

- financing applications
- financing agreements
- servicing
- collections
- product eligibility
- relationship management

Likewise:

`Product`

may be used across:

- product management
- financing
- payments
- customer interaction
- pricing
- eligibility

This means the Data & Information Architecture acts as a cross-domain layer.

A useful principle is:

> Information belongs to the enterprise, not only to the process or application that currently uses it.

---

## Financing as an Information Hub

The NHB Information Object Model shows that:

`Financing`

acts as a central information hub within the Financing & Credit Management domain.

It is related to concepts such as:

- Financing Agreement
- Financing Schedule
- Financing Position
- Repayment Obligation
- Financing Collateral
- Collection Case

This reflects the fact that financing becomes the central business object after financing establishment.

Many later servicing, risk, repayment, collateral, and recovery activities depend on information associated with the financing record.

---

## Information and Application Architecture

Application Services and Application Components are related to Information Objects.

For example, the verified Application Service:

`Establish Financing Agreement`

is connected to Information Objects including:

- Customer
- Customer Profile
- Credit Assessment
- Credit Decision
- Financing
- Financing Agreement
- Financing Application
- Financing Origination Case
- Financing Schedule
- Funding Arrangement
- Product
- Product Offering

This demonstrates cross-layer traceability.

A simplified relationship is:

Business Process
        ↓
Application Service
        ↓
Application Component
        ↓
Information Objects

The information layer therefore explains what business information is used, accessed, created, or maintained by application behavior.

---

## ArchiMate Access Relationships

The repository uses ArchiMate Access relationships between application elements and Information Objects.

For example:

`Financing Agreement Management`

has Access relationships to information such as:

- Customer
- Financing Agreement
- Financing Application
- Financing Schedule
- Product

An Access relationship expresses that an application element reads, writes, or otherwise uses information.

The exact read/write semantics may be refined later if required.

The important point is that the information dependency is explicitly modeled.

---

## Information Architecture and Integration

Data & Information Architecture provides the semantic foundation for integration.

Before two systems exchange information, the architecture should understand:

- what the information means
- which business concept it represents
- which process uses it
- which application service handles it
- which system owns or provides it
- which external representation is exchanged

For example:

NHB Information Object:
`Customer`

may later map to:

- CAP entity
- Fiserv Party
- SAP Business Partner
- API payload
- external message format

The architecture should preserve the NHB business meaning even when provider-specific representations differ.

This becomes especially important when applying anti-corruption-layer principles in integration design.

---

## Conceptual Versus Provider-Specific Information

The NHB repository should distinguish between:

NHB Information Concept
    and
External Provider Representation

For example:

NHB:
`Customer`

Fiserv:
`Party`

SAP:
possibly `Business Partner`

These concepts may overlap but should not automatically be treated as identical.

The enterprise architecture should define the NHB business meaning first.

Provider-specific structures should then be mapped to that meaning through integration and application architecture.

This prevents the external provider data model from becoming the enterprise information model by accident.

---

## Relationship to NHBCAP01

NHBCAP01 already demonstrates this distinction in implementation.

For example:

NHB conceptual information:

`Customer`

is represented in CAP through the NHB-facing customer abstraction.

Fiserv provides:

`Party`

data.

The CAP layer maps provider-specific Party information into the NHB-facing customer model.

This is a practical example of enterprise information architecture influencing implementation.

The architecture principle is:

External Representation
        ↓
Mapping / Anti-Corruption Layer
        ↓
NHB Information Meaning

This will become more important when the repository is connected to concrete integration and implementation evidence.

---

## Current Domain Consistency Observation

The Data & Information Architecture contains a substantial Deposit Management information structure, including:

- Deposit Account
- Deposit Account Status
- Deposit Activity
- Deposit Balance
- Deposit Position
- Deposit Profit / Return
- Deposit Relationship
- Maturity Instruction
- Maturity Outcome

At the same time, the current higher-level domain naming uses:

`Deposit Management`

for CD-03 / AC-03 / AS-03.

The Payment Information Structure currently contains only:

`Payment Instruction`

The third domain is confirmed as Deposit Management across CD-03 / AC-03 / AS-03. Genuine payment concepts such as Payment Instruction remain separate, as recorded under Resolved — CD-03 Domain Baseline Consistency.

---

## Current Review Findings

### R-09 — Payment and Deposit Information-Domain Consistency

This finding is resolved by the confirmed Deposit Management baseline across CD-03 / AC-03 / AS-03.

The Deposit Management Information Structure is consistent with that domain. Genuine payment concepts such as `Payment Instruction` remain separate.

---

### R-10 — Information Object Relationship Semantics

The Information Object Model contains many relationships between Business Objects.

The visual relationships are clear, but the exact ArchiMate connector semantics should be reviewed where necessary.

The review should confirm whether relationships represent:

- association
- aggregation
- composition
- specialization
- access
- or another intended semantic relationship

The goal is to ensure that the model communicates meaning rather than only visual connectivity.

---

### R-11 — Information Ownership and System of Record

The current Data & Information Architecture describes business information concepts but does not yet explicitly show system-of-record ownership.

Future repository refinement may need to identify:

- authoritative source
- master-data owner
- system of record
- replication responsibilities
- provider ownership
- integration ownership

This becomes important when multiple systems such as SAP, Fiserv, CAP, or other platforms participate in the same information domain.

---

## Key Principles

Information Object
    = meaningful business information concept

Information Structure
    = organization of related information concepts

Information Object Model
    = semantic relationships between information concepts

Physical Data Model
    = implementation structure for storing data

Access Relationship
    = explicit dependency between application behavior and information

Cross-Domain Information
    = information reused across multiple business and application domains

The main traceability concept is:

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
Information Object
    ↓
Integration Representation
    ↓
Technology / Implementation

## Key Principle

> Data & Information Architecture preserves the enterprise meaning of information independently of the applications, providers, APIs, and technologies used to store or exchange it.

# 17. Integration Architecture

The NHB Integration Architecture describes how application behaviors interact across domain boundaries.

Its purpose is to make cross-domain dependencies visible and traceable without immediately forcing the architecture into low-level technical implementation detail.

The current Integration Architecture is organized into:

- Integration Information Flows
- Integration Interactions
- Integration Interfaces
- Integration Patterns
- Integration Services
- Integration Views

At the current baseline, the most substantively populated areas are:

- Integration Interactions
- Integration Views

The remaining packages are currently placeholders for future refinement where additional architectural detail becomes necessary.

---

## Integration Interactions

An Application Interaction represents coordinated behavior between application participants.

It is used when behavior spans more than one application domain or logical application responsibility.

Examples in the NHB repository include:

- Customer Information Exchange for Credit Assessment
- Customer Information Exchange for Deposit Account Establishment
- Customer Information Exchange for Financing Origination
- Product Offering Exchange for Deposit Account Establishment
- Product Offering Exchange for Financing Origination

These interactions describe cross-domain collaboration.

They are not intended to represent individual APIs or technical endpoints.

An Application Interaction therefore answers:

> What coordinated application behavior occurs across application boundaries?

---

## Application Service Versus Application Interaction

An Application Service and an Application Interaction describe different things.

Application Service:

`Retrieve Customer Relationship`

describes behavior provided by an application domain.

Application Interaction:

`Customer Information Exchange for Deposit Account Establishment`

describes coordinated behavior that connects application responsibilities across domains.

A simplified relationship is:

Source Application Service
        ↓
Application Interaction
        ↓
Target Application Service

The Application Service represents behavior provided by one part of the application architecture.

The Application Interaction represents the cross-boundary collaboration required to support an end-to-end scenario.

---

## Verified Integration Example

A verified example in the NHB repository is:

`II-01 — Customer Information Exchange for Deposit Account Establishment`

This Application Interaction is directly related to:

- `Retrieve Customer Relationship`
- `Establish Deposit Account`
- `Customer`
- `Customer Profile`

The relationships were verified in Sparx EA.

The application-service relationships use:

`ArchiMate_Triggering`

The information-object relationships use:

`ArchiMate_Association`

The verified pattern is therefore:

Retrieve Customer Relationship
        Application Service
                │
                │ Triggering
                ▼
Customer Information Exchange
for Deposit Account Establishment
        Application Interaction
                │
                │ Triggering
                ▼
Establish Deposit Account
        Application Service

The interaction is also associated with:

- Customer
- Customer Profile

This expresses both:

- coordinated application behavior
- the business information relevant to that interaction

---

## Meaning of Triggering

An ArchiMate Triggering relationship expresses a temporal or causal dependency between behaviors.

It indicates that one behavior initiates, leads to, or causes another behavior to occur.

For example:

Behavior A
    ↓ Triggering
Behavior B

means that the occurrence or completion of Behavior A contributes to initiating Behavior B.

This is different from a Serving relationship.

Serving:

Application Service
    ↓
Business Process

means that application behavior supports another architectural element.

Triggering:

Behavior A
    ↓
Behavior B

means that one behavior leads to another behavior.

The distinction matters because not every arrow in ArchiMate has the same semantic meaning.

---

## Integration Overview

The NHB Integration Overview provides an enterprise-level view of cross-domain application interactions.

It shows how services in one domain participate in interactions that support services in another domain.

For example:

Customer Management
    ↓
Retrieve Customer Relationship
    ↓
Application Interaction
    ↓
Deposit Account Establishment

and:

Product Management
    ↓
Maintain Product Distribution
    ↓
Application Interaction
    ↓
Financing Origination

The purpose of the view is not to show detailed technical connectivity.

Its purpose is to answer:

> Which application behaviors must collaborate across domain boundaries to support an end-to-end business scenario?

---

## Integration Information and Business Meaning

Application Interactions may be associated with business information concepts.

For example:

`Customer Information Exchange for Deposit Account Establishment`

is associated with:

- Customer
- Customer Profile

This tells us which business information concepts are relevant to the interaction.

However, the current repository does not yet model explicit directional Information Flow relationships for these exchanges.

The current pattern is therefore approximately:

Application Service
    ↓ Triggering
Application Interaction
    ↓ Triggering
Application Service

Application Interaction
    ↔ Association
Information Objects

This is sufficient to express interaction intent at the current EA baseline.

More explicit information movement can be modeled later if required.

---

## Integration Information Flows

The package:

`Integration Information Flows`

is currently empty.

This is not necessarily a deficiency.

The current architecture already identifies:

- participating application behavior
- cross-domain interactions
- relevant business information concepts

Explicit Information Flow modeling should be introduced only when directional data movement becomes architecturally important.

An Information Flow would help answer:

> What information moves from one architectural element to another?

For example:

Source
    ── Customer / Customer Profile ──>
Target

This level of detail may become useful when the architecture is connected to concrete APIs and integration implementations.

---

## Integration Interfaces

The package:

`Integration Interfaces`

is currently empty.

An Integration Interface would represent an access point through which integration behavior or services are exposed or consumed.

It could eventually represent architectural access points such as:

- API boundaries
- service endpoints
- external provider interfaces
- SAP integration interfaces
- CAP service interfaces

Interfaces should only be modeled when they add architectural value.

They should not be created merely to populate an empty package.

---

## Integration Patterns

The package:

`Integration Patterns`

is currently empty.

Integration Patterns can be used to document reusable approaches to solving recurring integration concerns.

Potential future patterns may include:

- synchronous request/response
- asynchronous messaging
- API mediation
- provider abstraction
- anti-corruption mapping
- authentication
- retry handling
- timeout handling
- structured error mapping
- event-driven integration

These patterns should be introduced when they correspond to real architectural decisions or implementation evidence.

---

## Integration Services

The package:

`Integration Services`

is currently empty.

An Integration Service would represent reusable integration behavior made available to consumers.

This layer is not required simply because the package exists.

It should be modeled only when the architecture needs to distinguish reusable integration capabilities from application-domain services.

---

## Integration Interaction Catalogue

The:

`Integration Interaction Catalogue`

view is currently empty.

A dedicated catalogue may become useful later if the number of cross-domain interactions grows significantly.

For the current baseline, the populated Integration Overview and the Interaction elements themselves already provide sufficient understanding.

---

## Current Integration Baseline

The current NHB Integration Architecture should therefore be understood as an interaction-oriented baseline.

It currently describes:

- which application services participate in cross-domain scenarios
- which application interactions connect those behaviors
- which information concepts are relevant
- how interaction sequencing is represented

It does not yet describe in detail:

- concrete APIs
- endpoint URLs
- protocols
- authentication mechanisms
- message schemas
- technical middleware
- retry behavior
- timeout behavior
- error-handling mechanisms
- physical network paths

Those details belong to technical integration design and implementation documentation. NHBCAP01 already provides this evidence, including the implemented and verified SAP Integration Suite mediation baseline; the logical EA view need not reproduce it in full.

---

## Relationship to NHBCAP01

NHBCAP01 already contains concrete integration implementation evidence that goes beyond the current EA integration baseline.

Examples include:

- SAP CAP OData services
- Fiserv Banking Hub APIs
- SAP Integration Suite mediation baseline — implemented and verified
- OAuth 2.0 Client Credentials
- XSUAA
- SAP BTP Destination service
- provider-specific mappings
- anti-corruption logic
- timeout behavior
- error handling
- external service boundaries

This creates an opportunity for later architecture refinement.

The EA repository can remain conceptually stable while selected implementation evidence is used to enrich:

- Integration Interfaces
- Integration Patterns
- Integration Services
- Information Flows

The repository should not copy implementation detail indiscriminately.

Only technically significant concepts that improve architecture understanding and traceability should be promoted into the EA model.

---

## Architecture Intent Versus Technical Integration Design

It is important to distinguish two levels.

Architecture Intent:

- which domains interact
- which application services participate
- which business information is involved
- why the interaction exists

Technical Integration Design:

- which API is called
- which endpoint is used
- which authentication mechanism applies
- which payload is exchanged
- which middleware is involved
- how retries, failures, and timeouts are handled

The current NHB Integration Architecture primarily models Architecture Intent.

NHBCAP01 provides Technical Integration Design and implementation evidence.

The two should remain connected but should not be collapsed into one level of detail.

---

## Current Review Findings

### R-12 — Integration Information Flow Coverage

The `Integration Information Flows` package is currently empty.

The repository associates Information Objects with Application Interactions, but it does not yet model explicit directional information flows.

Future refinement should determine whether directional flow modeling is required for:

- key cross-domain exchanges
- external provider integrations
- implementation traceability

No Information Flow elements should be added unless they improve architectural understanding.

---

### R-13 — Integration Interface Coverage

The `Integration Interfaces` package is currently empty.

The repository currently models interaction behavior without explicitly modeling technical access points.

Future refinement may introduce interfaces when concrete architectural boundaries need to be represented.

Possible candidates include:

- CAP OData boundary
- Fiserv API boundary
- SAP API boundary
- external provider interfaces

---

### R-14 — Integration Pattern and Service Coverage

The following packages are currently empty:

- Integration Patterns
- Integration Services

This is acceptable for the current baseline.

These packages should be populated only when reusable integration behavior or reusable architectural patterns are clearly required.

NHBCAP01 implementation evidence, including verified SAP Integration Suite mediation, now provides candidates for selective modeling. This does not require every logical integration package to be populated.

---

### R-15 — Integration Interaction Catalogue Coverage

The `Integration Interaction Catalogue` is currently empty.

The repository already contains explicit Application Interaction elements and an Integration Overview.

A dedicated catalogue should only be added if it improves navigation, governance, or portfolio presentation.

---

### R-16 — CD-03 Cross-Layer Domain Baseline Consistency

This finding is resolved as recorded under Resolved — CD-03 Domain Baseline Consistency.

Deposit Management is the confirmed CD-03 / AC-03 / AS-03 and Level-1 capability-domain baseline.

Deposit-related application, information, and integration terminology remains consistent with that decision. Genuine payment concepts remain separate.

---

## Key Concepts

Application Service
    = application behavior provided by a domain

Application Interaction
    = coordinated behavior across application boundaries

Information Flow
    = directional movement of information

Integration Interface
    = access point through which integration behavior is exposed or consumed

Integration Service
    = reusable integration behavior

Integration Pattern
    = reusable approach for solving an integration concern

Integration View
    = selected representation of cross-domain integration relationships

---

## Integration Traceability

The integration layer extends the existing architecture chain:

Business Need
    ↓
Capability
    ↓
Business Process
    ↓
Application Service
    ↓
Application Interaction
    ↓
Information
    ↓
Integration Interface / Pattern
    ↓
Technology
    ↓
Implementation Evidence

Not every scenario requires every layer to be modeled explicitly.

The repository should model enough detail to make architectural meaning clear without creating unnecessary complexity.

## Key Principle

> Integration Architecture explains how application behavior collaborates across boundaries, while technical integration detail should be introduced only when it represents a meaningful architectural decision.

# 18. Technology Architecture

The NHB Technology Architecture describes the logical technology environments, platforms, and services that support the application and integration architecture.

It provides the foundation on which application components, data management, and integration behavior can operate.

The current Technology Architecture is organized into:

- Technology Infrastructure
- System Software
- Technology Services
- Technology Interface
- Technology Architecture views
- Technology Services views

The current baseline is primarily logical rather than vendor-specific.

---

## Technology Infrastructure

The Technology Infrastructure package contains ArchiMate Nodes representing logical hosting environments.

The current Nodes are:

- NHB Application Hosting Environment
- NHB Data Hosting Environment
- NHB Integration Hosting Environment

A Node represents a logical execution or hosting environment.

It answers:

> Where does technology execute or operate?

These Nodes do not currently prescribe a specific cloud provider, physical server, operating system, or deployment product.

This keeps the logical architecture independent of implementation choices.

---

## System Software

The System Software package contains the logical technology platforms required by the architecture.

The current System Software elements are:

- NHB Application Runtime Platform
- NHB Database Management Platform
- NHB Integration Runtime Platform

System Software represents the software environment or platform that provides technical behavior.

For example:

`NHB Application Runtime Platform`

represents the logical runtime required to execute NHB application functionality.

It does not automatically mean:

- SAP BTP
- Cloud Foundry
- Node.js
- a particular operating system
- a particular cloud provider

Concrete technologies realize or implement the logical platform; AV-03 v1.0 provides the NHBCAP01 realization view while preserving this distinction.

System Software therefore answers:

> What technology platform performs or enables the technical work?

---

## Node Versus System Software

Nodes and System Software describe different technology concepts.

Node:

`NHB Application Hosting Environment`

represents the logical environment where execution occurs.

System Software:

`NHB Application Runtime Platform`

represents the software platform operating within or associated with that environment.

A simplified distinction is:

Node
    = where technology runs

System Software
    = what technology platform runs there

The verified repository relationship between:

`NHB Application Runtime Platform`

and:

`NHB Application Hosting Environment`

uses:

`ArchiMate_Assignment`

Sparx EA displays the underlying connector as an Association with the ArchiMate Assignment stereotype.

The architectural intent is to associate the runtime platform with its logical hosting environment.

---

## Technology Services

Technology Services represent technical capabilities made available to application or integration consumers.

The current Technology Services are:

- NHB Application Hosting Service
- NHB Data Management Service
- NHB Integration Service
- NHB Technology Security Service

A Technology Service answers:

> What technical capability is provided to support applications and integrations?

Technology Services provide a useful abstraction between technology implementation and the application architecture.

Applications can depend on technical capabilities without needing to know every internal platform detail.

---

## System Software Versus Technology Service

System Software and Technology Services serve different purposes.

System Software:

`NHB Application Runtime Platform`

represents the logical platform performing technical behavior.

Technology Service:

`NHB Application Hosting Service`

represents the technical capability made available by that platform.

The verified relationship in the repository is:

NHB Application Runtime Platform
        │
        │ Realization
        ▼
NHB Application Hosting Service

The connector was verified directly in Sparx EA as:

- Connection: Dependency
- Stereotype: ArchiMate_Realization

This means that the System Software realizes the Technology Service.

The same conceptual pattern applies to:

NHB Database Management Platform
        ↓
NHB Data Management Service

and:

NHB Integration Runtime Platform
        ↓
NHB Integration Service

---

## Meaning of Realization in the Technology Layer

Realization expresses that one architectural element provides a more concrete implementation of another.

In the Technology Architecture:

System Software
        ↓ Realization
Technology Service

means that the technology platform provides or implements the technical capability represented by the service.

For example:

`NHB Application Runtime Platform`

realizes:

`NHB Application Hosting Service`

The Technology Service describes what technical capability is available.

The System Software describes the platform through which that capability is provided.

---

## Technology Architecture View

The current Technology Architecture view shows three principal platform-to-environment relationships:

NHB Application Runtime Platform
        ↓
NHB Application Hosting Environment

NHB Database Management Platform
        ↓
NHB Data Hosting Environment

NHB Integration Runtime Platform
        ↓
NHB Integration Hosting Environment

This creates a simple logical separation between:

- application execution
- data management
- integration execution

The purpose of this view is not to describe physical infrastructure.

It provides the logical technology foundation for implementation mapping, including the completed AV-03 v1.0 realization view.

---

## Technology Services View

The Technology Services view connects System Software to Technology Services.

The current pattern is:

NHB Application Runtime Platform
        ↓ Realization
NHB Application Hosting Service

NHB Database Management Platform
        ↓ Realization
NHB Data Management Service

NHB Integration Runtime Platform
        ↓ Realization
NHB Integration Service

The fourth Technology Service:

`NHB Technology Security Service`

currently has no visible realizing System Software in this view.

This may be intentional because security is often a cross-cutting technology concern provided through several mechanisms rather than one dedicated platform.

---

## Logical Versus Physical Technology Architecture

The current NHB Technology Architecture is intentionally logical.

Logical Technology Architecture describes:

- required hosting environments
- required runtime platforms
- required technology services
- architectural responsibilities

Physical or implementation architecture describes:

- specific cloud platforms
- products
- deployment environments
- service instances
- runtime versions
- infrastructure locations
- network details

These two levels should not be confused.

For example:

Logical Architecture:

`NHB Application Runtime Platform`

Possible implementation mapping:

`SAP BTP Cloud Foundry + SAP CAP / Node.js`

Logical Architecture:

`NHB Database Management Platform`

Possible implementation mapping:

`SAP HANA Cloud + HDI`

Logical Architecture:

`NHB Technology Security Service`

Possible implementation mechanisms:

- XSUAA
- OAuth 2.0
- identity services
- authorization policies
- secret management

The logical architecture should remain stable even if the implementation technology changes.

---

## Relationship to NHBCAP01

NHBCAP01 provides concrete implementation evidence connected to the logical architecture through the completed AV-03 v1.0 realization view.

Examples include:

### Application Runtime

Logical:

`NHB Application Runtime Platform`

Implementation evidence:

- SAP CAP
- Node.js
- SAP BTP Cloud Foundry
- cflinuxfs4 runtime environment

### Data Platform

Logical:

`NHB Database Management Platform`

Implementation evidence:

- SAP HANA Cloud
- HDI container
- hdi-shared service

### Security

Logical:

`NHB Technology Security Service`

Implementation evidence:

- XSUAA
- OAuth 2.0 Client Credentials
- JWT-based access control
- external provider authentication

### Integration Runtime

Logical:

`NHB Integration Runtime Platform`

Implementation evidence currently includes:

- CAP integration modules
- SAP Integration Suite mediation baseline — implemented and verified
- SAP BTP Destination service
- outbound HTTPS integration
- Fiserv Banking Hub connectivity

These implementation elements should not automatically replace the logical EA elements.

Instead, they can be mapped to them as implementation evidence.

---

## Logical-to-Implementation Traceability

A useful architecture pattern is:

Application Component
        ↓
Technology Service
        ↓
System Software
        ↓
Hosting Environment
        ↓
Concrete Implementation

For example:

NHBCAP01 Application Component
        ↓
NHB Application Hosting Service
        ↓
NHB Application Runtime Platform
        ↓
NHB Application Hosting Environment
        ↓
SAP BTP Cloud Foundry / CAP / Node.js

This creates traceability while preserving separation between logical architecture and vendor-specific implementation.

---

## Technology Security as a Cross-Cutting Concern

`NHB Technology Security Service`

is different from the other Technology Services because it may support several technology areas simultaneously.

Security may apply across:

- application runtime
- database access
- integration
- APIs
- authentication
- authorization
- secrets
- external-provider connectivity

For this reason, it may not be appropriate to assign the service to only one System Software element.

Its realization may eventually involve several technology mechanisms.

---

## Technology Interface

The `Technology Interface` package is currently not populated with substantive elements.

This is acceptable for the current baseline.

Technology Interfaces should be introduced only if the architecture needs to represent technical access points such as:

- network interfaces
- runtime endpoints
- platform access boundaries
- infrastructure interfaces

They should not be created merely to populate the package.

---

## Current Review Findings

### R-17 — Technology Security Service Realization

The Technology Services view contains:

`NHB Technology Security Service`

without a visible realizing System Software element.

This may be intentional because security is cross-cutting.

Future refinement should determine whether the service should be:

- realized by several technology mechanisms
- connected to a dedicated security platform
- modeled as a cross-cutting technology service
- or left abstract at the logical EA level

No dedicated security platform should be introduced merely to complete the diagram.

---

### R-18 — Node and System Software Relationship Semantics

The verified relationship between:

`NHB Application Runtime Platform`

and:

`NHB Application Hosting Environment`

uses:

`ArchiMate_Assignment`

The relationship is currently understood as associating the runtime platform with its logical hosting environment.

During repository finalization, the modeling convention should be checked for consistency across:

- application runtime
- database management platform
- integration runtime

The objective is not necessarily to change the relationship, but to ensure that the chosen ArchiMate semantics are deliberate and consistently applied.

---

### R-19 — Logical-to-Physical Technology Mapping

The current Technology Architecture is logical and vendor-independent.

NHBCAP01 now provides concrete implementation technologies including:

- SAP BTP
- Cloud Foundry
- SAP CAP
- Node.js
- SAP HANA Cloud
- HDI
- XSUAA
- Destination service

AV-03 v1.0 establishes the NHBCAP01 architecture-to-implementation realization baseline. Further repository refinement should determine how much additional implementation detail adds architectural value.

The logical architecture should not be replaced by vendor-specific elements.

Instead, implementation evidence should be connected through controlled traceability.

---

## Key Concepts

Node
    = logical execution or hosting environment

System Software
    = technology platform that performs technical behavior

Technology Service
    = technical capability made available to consumers

Realization
    = relationship showing how a platform provides a technology service

Assignment
    = relationship currently used to associate System Software with its hosting environment

Logical Technology Architecture
    = vendor-independent technology requirements and responsibilities

Physical / Implementation Architecture
    = concrete platforms, products, deployments, and infrastructure

---

## Technology Traceability

The architecture chain can now be extended to:

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
Technology Service
    ↓
System Software
    ↓
Node / Hosting Environment
    ↓
Implementation Evidence

This does not mean every element must be connected through one rigid linear chain.

The model may contain many-to-many relationships and cross-cutting services.

## Key Principle

> Technology Architecture defines the logical technology capabilities and platforms required to support the enterprise, while concrete products and cloud services provide implementation evidence for that logical design.

# 19. Traceability & Architecture Views

Traceability is the ability to follow architectural meaning across layers and relationships.

It is not a separate architecture layer.

Instead, traceability connects the architecture that already exists.

Examples include relationships between:

- capabilities
- business processes
- application services
- application components
- information objects
- integration interactions
- technology services
- system software
- hosting environments
- implementation evidence

The purpose of traceability is to make the architecture explainable, navigable, and analyzable.

---

## Traceability as a Cross-Layer Discipline

A useful traceability chain is:

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
Information Object
    ↓
Integration
    ↓
Technology Service
    ↓
System Software
    ↓
Hosting Environment
    ↓
Implementation Evidence

This should not be interpreted as a rigid hierarchy.

The actual repository contains:

- many-to-many relationships
- cross-domain dependencies
- shared information
- reusable services
- cross-cutting technology concerns

Traceability therefore helps us navigate relationships rather than forcing the architecture into one linear structure.

---

## Why Traceability Matters

Traceability allows the repository to answer questions such as:

- Which processes realize a capability?
- Which application services support a process?
- Which application components provide those services?
- Which information objects are used?
- Which integration interactions connect domains?
- Which technology platforms support the application?
- Which implementation evidence demonstrates realization?

Without traceability, the repository becomes a set of disconnected models.

With traceability, the repository becomes a connected enterprise model.

---

## Traceability Versus Diagram Placement

Two elements appearing together on a diagram do not automatically have architectural meaning.

The relationship must be explicitly modeled.

For example:

Application Component
        ↓
Application Service

has meaning only when the repository contains an explicit connector.

Visual proximity is presentation.

Explicit relationships are architecture semantics.

---

## Verified Traceability Example

The current Traceability & Matrices area contains:

`TR-01 — CD-01 Component-Service Realization`

The repository confirms that the Application Component:

`Customer Relationship Management`

is directly related to the following Application Services:

- Change Customer Relationship Status
- Close Customer Relationship
- Establish Customer Relationship
- Reactivate Customer Relationship
- Retrieve Customer Relationship
- Retrieve Customer Relationship History
- Suspend Customer Relationship
- Update Customer Relationship

The connectors are stored as:

- Connection: Association
- Stereotype: ArchiMate_Serving

This confirms that the repository contains explicit Component-to-Service traceability.

---

## Traceability View Versus Repository Relationships

The current TR-01 diagram visually displays only:

`Customer Relationship Management`

even though the element's relationship list confirms multiple Application Service connections.

This highlights an important distinction.

Repository Traceability
    = relationships actually stored in the model

Traceability View
    = selected visual representation of those relationships

A repository can therefore contain valid traceability even when a particular diagram does not show all related elements.

The diagram should be treated as a view of the model, not as the model itself.

---

## Traceability Matrices

A traceability matrix provides a structured way to examine relationships between two sets of architecture elements.

Examples could include:

Capability
    ↔
Business Process

Business Process
    ↔
Application Service

Application Component
    ↔
Application Service

Application Service
    ↔
Information Object

Application Component
    ↔
Technology Service

Matrices are useful when the architecture needs to answer coverage or dependency questions systematically.

For example:

> Which Application Services are provided by each Application Component?

or:

> Which Business Processes currently have no supporting Application Service?

---

## Do Not Create Matrices for Everything

A mature repository does not need a traceability matrix for every possible relationship.

Creating too many matrices can produce:

- unnecessary maintenance
- duplicate views
- repository clutter
- low-value documentation
- difficult governance

Traceability artifacts should be created only when they support a real architectural question.

A useful rule is:

> Create a traceability view or matrix when it helps validate, analyze, govern, or communicate an important relationship.

---

## Architecture Views

An Architecture View presents selected architecture content for a specific purpose or audience.

A view is therefore different from the underlying repository model.

The model may contain thousands of elements and relationships.

A view selects only the information required to answer a particular question.

The current architecture-view baseline includes AV-01 — NHB Enterprise Architecture Overview, AV-02 — Sharia-Compliant Financing End-to-End View, and AV-03 — NHBCAP01 Architecture-to-Implementation Realization, completed as v1.0.

Examples of additional NHB Architecture Views might include:

- customer onboarding cross-layer view
- Fiserv integration view
- SAP integration view
- security and trust-boundary view

These should be created only when they support a meaningful stakeholder need.

---

## 07 Architecture Views

The package:

`07 Architecture Views`

contains the established AV-01 and AV-02 views and the completed AV-03 v1.0 realization view.

The repository already contains many useful views inside the individual architecture layers.

The purpose of `07 Architecture Views` should therefore not be to duplicate those existing diagrams.

It provides the home for carefully selected:

- cross-layer views
- executive views
- portfolio views
- implementation-realization views
- architecture decision views

Only a small number of high-value views should be created.

---

## Traceability and Stakeholder Communication

Different stakeholders require different views of the same architecture.

For example:

Business stakeholder
    may need:
Capability → Process → Outcome

Application architect
    may need:
Process → Application Service → Application Component

Integration architect
    may need:
Application Service → Interaction → Information → Interface

Technology architect
    may need:
Application Component → Technology Service → Platform → Node

Recruiter or interviewer
    may need:
Business Need → Architecture Decision → Implementation Evidence

The underlying repository remains the same.

The view changes according to the question being asked.

---

## Traceability and Impact Analysis

Traceability supports impact analysis.

For example, if an Application Service changes, the repository can help determine:

- which business processes depend on it
- which capabilities may be affected
- which application components provide it
- which information objects are involved
- which integrations may change
- which technology components may be affected

This makes traceability useful not only for documentation but also for architecture governance and change analysis.

---

## Traceability and Implementation Evidence

The strongest form of traceability connects conceptual architecture to working implementation.

For example:

Business Capability
    ↓
Business Process
    ↓
Application Service
    ↓
Application Component
    ↓
Information Object
    ↓
Integration
    ↓
Technology
    ↓
NHBCAP01 Implementation Evidence

Implementation evidence may include:

- CAP services
- CDS entities
- OData endpoints
- Fiserv API calls
- authentication
- Cloud Foundry deployment
- HANA / HDI
- XSUAA
- tests
- deployment verification
- architecture documentation

This allows the repository to demonstrate not only intended architecture but also architectural realization.

---

## Relationship to NHBCAP01

NHBCAP01 now has a completed architecture-to-implementation realization view in AV-03 v1.0. Further end-to-end traceability views should be added only where they answer a distinct stakeholder question.

For example:

Customer Management Capability
        ↓
Customer-related Business Process
        ↓
Customer Application Service
        ↓
Customer Application Component
        ↓
Customer Information Object
        ↓
CAP NHBCustomer
        ↓
Fiserv Party Integration
        ↓
SAP BTP / Cloud Foundry
        ↓
Verified Implementation

A focused traceability chain may also be used to explain:

`Obtain Sharia-Compliant Financing`

and the Murabaha implementation.

Such focused explanations build on the completed baseline by connecting:

- enterprise architecture
- solution architecture
- integration architecture
- implementation evidence

---

## Current Traceability Baseline

The current Traceability & Matrices package is intentionally small.

It currently contains:

`01 Application Component → Application Service`

and:

`TR-01 — CD-01 Component-Service Realization`

This describes the component-service traceability baseline rather than comprehensive repository coverage. The completed AV-03 v1.0 view also connects architecture to NHBCAP01 implementation evidence.

That is acceptable.

Future traceability should be added selectively according to architectural value.

---

## Current Review Findings

### R-20 — TR-01 Traceability View Completeness

The repository confirms multiple relationships between:

`Customer Relationship Management`

and its Application Services.

However, the current TR-01 diagram visually shows only the Application Component.

The review should determine whether:

- the related Application Services should be displayed
- the artifact was intended to be a matrix rather than a diagram
- the diagram is incomplete
- or the current presentation was deliberately minimal

No change is required until the intended purpose of TR-01 is confirmed.

---

### R-21 — Traceability Coverage Strategy

The component-service traceability category described here is:

Application Component
    →
Application Service

The repository should not automatically create matrices for every layer combination.

Instead, a traceability strategy should identify which relationships are most valuable for:

- architecture validation
- impact analysis
- governance
- implementation traceability
- portfolio communication

---

### R-22 — Architecture Views Purpose

The `07 Architecture Views` package contains AV-01, AV-02, and the completed AV-03 v1.0 realization view.

Further use should focus on high-value cross-layer or stakeholder-oriented views that add to this baseline.

The package should not become a duplicate storage location for diagrams already contained in other architecture layers.

---

## Key Concepts

Traceability
    = ability to follow architectural meaning across relationships and layers

Traceability Matrix
    = structured analysis of relationships between two groups of elements

Traceability View
    = visual representation of selected repository relationships

Architecture View
    = selected representation of architecture for a specific purpose or stakeholder

Repository Model
    = underlying elements, relationships, metadata, and semantics

Implementation Evidence
    = concrete proof that part of the architecture has been realized

---

## End-to-End Architecture Understanding

The NHB repository can now be understood as:

Business Architecture
    ↓
Application Architecture
    ↓
Data & Information Architecture
    ↓
Integration Architecture
    ↓
Technology Architecture
    ↓
Traceability
    ↓
Implementation Evidence

Traceability does not sit below the other layers as a separate technical layer.

Instead, it connects them.

A more accurate mental model is:

             Business
                │
                ▼
           Application
                │
                ▼
          Information
                │
                ▼
           Integration
                │
                ▼
           Technology
                │
                ▼
         Implementation

Traceability runs through the entire chain.

## Key Principle

> Traceability turns separate architecture models into one connected enterprise architecture, while Architecture Views present selected parts of that model for specific questions and stakeholders.

### R-23 — Business Process to Application Service Serving Direction

The initial review identified multiple relationships using:

Business Process
    → Serving →
Application Service

Examples include:

- Establish & Administer Financing Agreement → Establish Financing Agreement
- Service Financing → Manage Financing Status
- Restructure Financing → Apply Financing Modification

This reverses the intended ArchiMate Serving semantics.

The corrected v1.0 pattern is:

Application Service
    → Serving →
Business Process

This issue has been corrected consistently across the affected mappings, as recorded under Resolved — Business Process to Application Service Serving Direction. The examples above describe the earlier issue.
