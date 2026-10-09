namespace NHBCAP01;

using { cuid, managed } from '@sap/cds/common';

entity Customer {
    key ID             : UUID;
    CustomerNumber     : String(100);
    Name               : String(100);
    CustomerType       : String(50);
    accounts           : Association to many Account
                             on accounts.customer = $self;
    murabahaContracts  : Association to many MurabahaFinancing
                             on murabahaContracts.customer = $self;
}

entity Account {
    key ID   : UUID;
    customer : Association to one Customer;
}

entity MurabahaFinancing : cuid, managed {
    customer                   : Association to one Customer;
    finxactAccountId           : String(100);
    contractReference          : String(100) not null;
    assetDescription           : String(500) not null;
    supplierName               : String(100);
    assetCost                  : Decimal(15,2) not null;
    profitAmount               : Decimal(15,2) not null;
    salePrice                  : Decimal(15,2) not null;
    currency                   : String(3) default 'USD';
    contractDate               : Date;
    maturityDate               : Date;

    creditDecisionStatus       : String(30) default 'PENDING';
    creditDecisionDate         : Date;
    creditDecisionReference    : String(100);
    shariaApprovalStatus       : String(30) default 'PENDING';
    shariaApprovalDate         : Date;
    shariaApprovalReference    : String(100);

    bankOwnershipRecorded      : Boolean default false;
    assetAcquisitionDate       : Date;
    ownershipEvidenceReference : String(100);
    saleContractExecutedOn     : Date;
    saleContractReference      : String(100);
    assetDeliveredOn           : Date;
    deliveryEvidenceReference  : String(100);
    cancellationDate           : Date;
    cancellationReason         : String(500);
    cancellationReference      : String(100);

    defaultDate                : Date;
    defaultReason              : String(500);
    defaultReference           : String(100);
    status                     : String(30) default 'DRAFT';
    installments               : Association to many MurabahaInstallment
                                     on installments.financing = $self;
    payments                   : Association to many MurabahaPayment
                                     on payments.financing = $self;
}

entity MurabahaInstallment : cuid, managed {
    financing         : Association to one MurabahaFinancing;
    sequenceNumber    : Integer not null;
    dueDate           : Date not null;
    principalAmount   : Decimal(15,2) not null;
    profitAmount      : Decimal(15,2) not null;
    installmentAmount : Decimal(15,2) not null;
    paidAmount        : Decimal(15,2) default 0;
    status            : String(30) default 'PENDING';
    payments          : Association to many MurabahaPayment
                            on payments.installment = $self;
}

entity MurabahaPayment : cuid, managed {
    financing         : Association to one MurabahaFinancing;
    installment       : Association to one MurabahaInstallment;
    externalPaymentId : String(100);
    paymentDate       : Date not null;
    amount            : Decimal(15,2) not null;
    currency          : String(3) default 'USD';
    status            : String(30) default 'RECEIVED';
    sourceProvider        : String(30);
    sourceEnvironment     : String(500);
    sourceOrgId           : String(100);
    sourceAccountId       : String(100);
    sourceTransactionId   : String(100);
    sourcePostedDateTime  : String(40);
    allocationReason      : String(500);
}


entity MurabahaPaymentReversal : cuid, managed {
    payment     : Association to one MurabahaPayment not null;
    financing   : Association to one MurabahaFinancing not null;
    installment : Association to one MurabahaInstallment not null;
    externalReversalId : String(100) not null;
    reversalDate       : Date not null;
    reason             : String(500) not null;
    amount             : Decimal(15,2) not null;
    currency           : String(3) not null;
}

annotate MurabahaPaymentReversal with @assert.unique.reversalReference: [ externalReversalId ];
annotate MurabahaPaymentReversal with @assert.unique.originalPayment: [ payment ];

entity MurabahaAccountingEvent : cuid, managed {
    eventType                    : String(50) not null;
    payment                      : Association to one MurabahaPayment;
    financing                    : Association to one MurabahaFinancing;
    installment                  : Association to one MurabahaInstallment;
    eventDate                    : Date not null;
    amount                       : Decimal(15,2) not null;
    currency                     : String(3) not null;
    correlationId                : String(100) not null;
    postingStatus                : String(30) default 'PENDING';

    externalAccountingDocument   : String(10);
    externalCompanyCode          : String(4);
    externalFiscalYear           : String(4);
    externalAccountingDocumentId : String(100);
    errorMessage                 : String(500);
}

annotate MurabahaAccountingEvent
with @assert.unique.paymentEventType: [ payment, eventType ];

annotate MurabahaPayment with @assert.unique.externalPaymentReference: [ externalPaymentId ];
