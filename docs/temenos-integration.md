# NHBCAP01 — Temenos Integration

## 1. Purpose

This document describes the integration between the NHBCAP01 SAP CAP application and the Temenos service used in the project.

The integration demonstrates how SAP CAP can consume an external OData service, apply application-level logic, transform data and queries, and expose an NHB-oriented service contract to consumers.

A controlled mock Temenos service is used for development and learning because a production Temenos environment is not available for this project.

---

## 2. Integration Objective

The objective is to establish the following integration pattern:

```text
NHB Consumer
     |
     | OData
     v
SAP CAP / NHBCAP01
     |
     | OData
     v
Temenos Service
```

The CAP application acts as an application and orchestration layer.

The consumer does not communicate directly with the Temenos service.

Similarly, CAP does not connect directly to a Temenos database.

---

## 3. External Service Configuration

The Temenos service is configured in the project's `package.json` under the CAP `requires` configuration.

The current development configuration is conceptually:

```json
"cds": {
  "requires": {
    "TemenosCustomerService": {
      "credentials": {
        "url": "http://localhost:5001/temenos"
      },
      "kind": "odata",
      "model": "srv/external/temenos.cds"
    }
  }
}
```

The important elements are:

| Property                 | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `TemenosCustomerService` | CAP service requirement name                     |
| `credentials.url`        | Endpoint of the external service                 |
| `kind`                   | Identifies the external service type             |
| `model`                  | Local CDS representation of the external service |

The localhost endpoint is used only for the learning environment.

In a BTP deployment, the endpoint will be replaced by an appropriate destination or cloud connectivity configuration.

---

## 4. External Service Model

The external Temenos service model is maintained in:

```text
srv/external/temenos.cds
```

This file represents the external service contract required by the CAP application.

The external model is deliberately kept separate from the NHB domain model.

Conceptually:

```text
NHB Domain Model
       |
       | db/schema.cds
       v
   NHB entities


Temenos External Model
       |
       | srv/external/temenos.cds
       v
 External entities
```

This separation prevents the external system's service contract from becoming the application's internal domain model.

---

## 5. Connecting to the External Service

The CAP service implementation is located in:

```text
srv/service.js
```

The application obtains the remote service connection using:

```js
const temenos = await cds.connect.to('TemenosCustomerService');
```

This is an important CAP integration pattern.

The application does not manually construct HTTP requests for the normal service interaction.

Instead, CAP provides a service abstraction through which the application can execute queries against the configured external service.

Conceptually:

```text
service.js
    |
    | cds.connect.to()
    v
TemenosCustomerService
    |
    v
External OData service
```

---

## 6. Remote Query Using CQN

Once the remote service connection is established, CAP queries the external service using CQN.

For example:

```js
await temenos.run(
    SELECT.from('Customers')
);
```

The application therefore uses the same CAP query abstraction when interacting with the remote service.

The conceptual flow is:

```text
CQN
 |
 v
CAP Remote Service
 |
 v
OData Request
 |
 v
Temenos
```

This abstraction is one of the useful features of CAP because application code does not have to manually construct the complete HTTP/OData request for each operation.

---

## 7. NHB Customer Service

The main NHB-facing customer integration is exposed through the custom service entity:

```text
NHBCustomer
```

The entity provides an NHB-oriented representation:

```text
CustomerNumber
Name
CustomerType
```

The Temenos service provides its own representation:

```text
customerId
name
customerType
```

The CAP service maps between the two.

---

## 8. Field Mapping

The current mapping is:

| Temenos        | NHB CAP          |
| -------------- | ---------------- |
| `customerId`   | `CustomerNumber` |
| `name`         | `Name`           |
| `customerType` | `CustomerType`   |

Conceptually:

```text
Temenos Customer
----------------
customerId
name
customerType
       |
       | CAP mapping
       v
NHB Customer
-----------
CustomerNumber
Name
CustomerType
```

The mapping is implemented inside the CAP service handler.

This allows the NHB-facing service contract to remain independent of the exact field naming used by Temenos.

---

## 9. Customer Read Flow

A customer read request follows this pattern:

```text
NHB Consumer
     |
     | GET /service/NHBCAP01Service/NHBCustomer
     v
CAP Service
     |
     v
READ handler
     |
     v
TemenosCustomerService
     |
     | SELECT.from('Customers')
     v
Temenos OData Service
     |
     v
Customer data
     |
     | mapping
     v
NHB Customer response
```

The CAP handler receives the request, determines the required query, calls the remote service, and maps the returned data.

---

## 10. OData Filter Transformation

One of the learning exercises was handling an OData filter received by the NHB-facing CAP service.

The consumer can request:

```text
$filter=CustomerType eq 'Corporate'
```

The NHB-facing service uses:

```text
CustomerType
```

while the Temenos service uses:

```text
customerType
```

The CAP integration logic therefore transforms the query conceptually as follows:

```text
NHB Request

CustomerType eq 'Corporate'

          |
          | transformation
          v

Temenos Request

customerType eq 'Corporate'
```

This was tested against the mock Temenos service.

The result was that only customers matching the `Corporate` customer type were returned.

---

## 11. Why Query Transformation Exists

The transformation demonstrates an important integration principle.

An integration layer does not necessarily expose the backend system's contract directly.

Instead:

```text
NHB Contract
     |
     | transformation
     v
Backend Contract
```

This provides a degree of abstraction between the consuming application and the backend system.

If the backend service changes its field naming, the transformation can potentially be adjusted inside the integration layer without changing the NHB-facing contract.

---

## 12. Current Filter Implementation

The current implementation extracts information from the CAP query representation.

The implementation currently assumes a simple filter structure and extracts:

* Filter field
* Comparison value

The simplified logic is conceptually:

```text
Request
  |
  v
CAP query
  |
  v
WHERE expression
  |
  +---- field
  |
  +---- value
  |
  v
Remote CQN
```

This was sufficient for the learning scenario and the tested filter:

```text
CustomerType eq 'Corporate'
```

---

## 13. Current Limitation

The current implementation is intentionally simple.

It should **not** be considered a complete OData filter parser.

For example, more complex expressions could include:

```text
CustomerType eq 'Corporate'
and Name eq 'ABC'
```

or:

```text
CustomerType eq 'Corporate'
or CustomerType eq 'Retail'
```

or expressions involving:

* Parentheses
* Multiple operators
* Functions
* Nested expressions
* Additional comparison operators

The current handler is not designed to interpret all of these cases.

This is an intentional learning-stage limitation.

A production implementation should rely on a more robust query-processing approach rather than assuming a fixed query structure.

---

## 14. Error Handling

Remote service calls are protected using `try/catch`.

The current implementation follows the general pattern:

```js
try {

    // Remote Temenos request

} catch (error) {

    console.error(
        'Temenos request failed:',
        error
    );

    return req.reject(
        502,
        'Temenos service is currently unavailable.'
    );
}
```

The purpose is to prevent a remote Temenos failure from being exposed directly as an uncontrolled application error.

A `502 Bad Gateway` response is used to represent the failure of the downstream service from the perspective of the CAP intermediary.

---

## 15. Temenos Account Integration

The project also demonstrates access to Temenos account data.

The CAP service exposes:

```text
TemenosAccount
```

The remote Temenos service provides account information such as:

```text
accountId
accountNumber
accountType
currency
balance
customer_customerId
```

The service can retrieve:

* All accounts
* Accounts associated with a particular Temenos customer

The customer-specific query is conceptually:

```text
Customer
   |
   | customerId
   v
Temenos Accounts
   |
   | customer_customerId
   v
Matching accounts
```

---

## 16. Local vs External Data

The project intentionally contains both local NHB data and external Temenos data.

### Local NHB domain

```text
db/schema.cds
      |
      v
Customer
Account
```

### External Temenos service

```text
srv/external/temenos.cds
      |
      v
Customers
Accounts
```

These are not treated as the same persistence model.

This distinction is important because an integration architecture should not automatically equate the data model of one system with the data model of another.

---

## 17. Mock Temenos Service

The project contains:

```text
mock-temenos/server.js
```

The mock service provides a controlled OData endpoint for development and testing.

Its purpose is to reproduce enough of the external service behavior to allow the CAP application to exercise:

* Remote reads
* OData queries
* Filtering
* Customer mapping
* Account retrieval
* Remote-service error handling

The mock is not intended to reproduce the complete Temenos platform.

It is a controlled learning and integration-testing environment.

---

## 18. Current Integration Architecture

The complete current flow is:

```text
                         NHB Customer UI
                                |
                                | OData
                                v
                     +----------------------+
                     |      NHBCAP01        |
                     |                      |
                     |   CAP Service        |
                     |   Node.js Handler    |
                     +----------+-----------+
                                |
                                | CQN
                                v
                     +----------------------+
                     | TemenosCustomerService|
                     | External OData Model |
                     +----------+-----------+
                                |
                                | OData
                                v
                     +----------------------+
                     |   Mock Temenos API   |
                     +----------+-----------+
                                |
                                v
                       Customer / Account
                             Data
```

---

## 19. Target BTP Integration

The current localhost configuration is not the target production architecture.

In a BTP environment, the intended model is:

```text
NHB Application
      |
      v
SAP BTP
      |
      v
CAP Application
      |
      v
BTP Destination
      |
      v
Temenos API
```

The destination should provide the appropriate endpoint and authentication configuration rather than embedding production credentials or service URLs directly in application code.

The exact authentication and connectivity pattern will depend on the target Temenos API and the available BTP environment.

---

## 20. Future SAP S/4HANA Integration

The same architectural principle will be used for future SAP S/4HANA integration.

Conceptually:

```text
                    CAP
                     |
          +----------+----------+
          |                     |
          v                     v
    Temenos API          SAP S/4HANA API
          |                     |
          v                     v
    Core Banking        Enterprise Processes
```

CAP should communicate with SAP S/4HANA through supported application APIs and services.

It should not directly access the S/4HANA database.

A real S/4HANA system is not currently connected to NHBCAP01; controlled APIs or mock services may therefore be used during development.

---

## 21. Security Considerations

The current localhost implementation is a development configuration.

The target cloud implementation must address:

* Authentication
* Authorization
* Secure destination configuration
* Credential management
* TLS/HTTPS
* Service-to-service identity
* Least-privilege access
* Error handling without exposing sensitive backend details

Production credentials must not be committed to Git.

The `.gitignore` configuration therefore excludes environment-specific and private configuration files where appropriate.

---

## 22. Lessons Learned

The Temenos integration exercise demonstrated several important CAP concepts:

### External services are configured dependencies

The external service is declared through CAP configuration rather than being hard-coded throughout the application.

### `cds.connect.to()` provides a service abstraction

Application code can obtain a configured remote service and execute queries through CAP.

### CQN can be used for remote services

The same CAP query abstraction can be used to interact with an external OData service.

### Service contracts can differ

The NHB service representation does not have to be identical to the Temenos representation.

### Integration logic belongs at the service boundary

Mapping and adaptation can be performed in the CAP service layer.

### OData queries require careful handling

Simple filters can be transformed, but production-grade query handling requires support for more complex expressions.

### Mock services are useful for integration learning

A controlled mock makes it possible to practice realistic service-to-service integration without requiring access to a production banking platform.

---

## 23. Current Status

### Implemented

* CAP external service configuration
* External Temenos CDS model
* Remote service connection using `cds.connect.to()`
* CQN-based remote queries
* Customer data mapping
* Account data retrieval
* NHB-facing customer service
* OData filter transformation
* Remote-service error handling
* Mock Temenos OData service

### Not Yet Implemented

* BTP deployment
* BTP destination configuration
* Production authentication
* Production Temenos connectivity
* Complete OData filter transformation
* SAP S/4HANA integration
* Production-grade monitoring and resilience

---

## 24. Next Improvements

The next technical improvements should be performed incrementally:

1. Deploy NHBCAP01 to SAP BTP.
2. Configure a BTP destination for the external service.
3. Replace the localhost Temenos endpoint with the appropriate cloud configuration.
4. Test authentication and service-to-service connectivity.
5. Improve OData filter handling.
6. Add more robust error and logging patterns.
7. Introduce a controlled SAP S/4HANA API/mock service.
8. Expand integration testing.
9. Document the final target integration architecture.

---

## Summary

The NHBCAP01 Temenos integration demonstrates a basic but meaningful enterprise integration pattern:

```text
Consumer
   |
   v
CAP Service
   |
   | CQN / OData
   v
External Service
   |
   v
Temenos
```

CAP provides the intermediary application and integration boundary.

The implementation demonstrates that CAP can:

* consume external OData services,
* execute remote queries,
* transform data,
* adapt queries,
* handle downstream failures,
* and expose an NHB-oriented service contract.

The current implementation is a learning and prototype baseline. The next stage is to move the integration from localhost development toward SAP BTP using destinations, secure authentication, and cloud-based service connectivity.
