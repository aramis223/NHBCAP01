using { NHBCAP01 as my } from '../db/schema.cds';

@path : '/service/NHBCAP01Service'
service NHBCAP01Service {
    @cds.redirection.target
    entity Customer as projection on my.Customer;

    @cds.redirection.target
    entity Account as projection on my.Account;

    @cds.redirection.target
    entity MurabahaFinancing as projection on my.MurabahaFinancing actions {
        action recordCreditDecision(
            decisionStatus    : String(30),
            decisionDate      : Date,
            decisionReference : String(100)
        ) returns MurabahaFinancing;

        action recordShariaDecision(
            approvalStatus    : String(30),
            approvalDate      : Date,
            approvalReference : String(100)
        ) returns MurabahaFinancing;

        action recordAssetAcquisition(
            acquisitionDate   : Date,
            evidenceReference : String(100)
        ) returns MurabahaFinancing;

        action executeSaleContract(
            executionDate     : Date,
            contractReference : String(100)
        ) returns MurabahaFinancing;

        action confirmAssetDelivery(
            deliveryDate      : Date,
            evidenceReference : String(100)
        ) returns MurabahaFinancing;

        action activateFinancing()
            returns MurabahaFinancing;
        action cancelFinancing(
            cancellationDate      : Date,
            cancellationReason    : String(500),
            cancellationReference : String(100)
        ) returns MurabahaFinancing;

        action markFinancingDefaulted(
            defaultDate      : Date,
            defaultReason    : String(500),
            defaultReference : String(100)
        ) returns MurabahaFinancing;
    };

    entity MurabahaInstallment as projection on my.MurabahaInstallment actions {
        action postPayment(
            externalPaymentId : String(100),
            paymentDate       : Date,
            amount            : Decimal(15,2),
            currency          : String(3)
        ) returns MurabahaPayment;
    };
    @readonly
    entity MurabahaPayment as projection on my.MurabahaPayment;

    @readonly
    entity MurabahaPaymentReversal as projection on my.MurabahaPaymentReversal;

    @cds.persistence.skip
    entity NHBCustomer {
        key CustomerNumber : String;
        Name               : String;
        CustomerType       : String;
    }
       
    type FiservBalance {
        balanceType : String;
        amount      : Decimal(15,2);
        currency    : String;
    }

    type FiservAccount {
        accountId    : String;
        accountType  : String;
        description  : String;
        currency     : String;
        accountTitle : String;
        openDate     : Date;
        status       : String;
        balances     : many FiservBalance;
    }

    function getFiservAccountDetails(
        accountId : String
    ) returns FiservAccount;

    action postMurabahaPayment(
        financingId      : UUID,
        installmentId    : UUID,
        externalPaymentId: String(100),
        paymentDate      : Date,
        amount           : Decimal(15,2),
        currency         : String(3)
    ) returns MurabahaPayment;

    action reverseMurabahaPayment(
        paymentId          : UUID,
        externalReversalId : String(100),
        reversalDate       : Date,
        reason             : String(500)
    ) returns MurabahaPaymentReversal;
}

annotate NHBCAP01Service.MurabahaFinancing with @(
    UI.HeaderInfo : {
        TypeName       : 'Murabaha Contract',
        TypeNamePlural : 'Murabaha Contracts',
        Title          : { Value : contractReference },
        Description    : { Value : assetDescription }
    },
    UI.SelectionFields : [ status, currency, contractDate, maturityDate ],
    UI.LineItem : [
        { Value : contractReference, Label : 'Contract Reference' },
        { Value : assetDescription, Label : 'Asset' },
        { Value : supplierName, Label : 'Supplier' },
        { Value : assetCost, Label : 'Asset Cost' },
        { Value : profitAmount, Label : 'Profit' },
        { Value : salePrice, Label : 'Sale Price' },
        { Value : currency, Label : 'Currency' },
        { Value : contractDate, Label : 'Start Date' },
        { Value : maturityDate, Label : 'Maturity Date' },
        { Value : status, Label : 'Status' }
    ]
);

annotate NHBCAP01Service.MurabahaInstallment with @(
    UI.HeaderInfo : {
        TypeName       : 'Murabaha Installment',
        TypeNamePlural : 'Murabaha Installments',
        Title          : { Value : sequenceNumber },
        Description    : { Value : status }
    },
    UI.SelectionFields : [ status, dueDate ],
    UI.LineItem : [
        { $Type : 'UI.DataFieldForAction', Action : 'NHBCAP01Service.postPayment', Label : 'Post Payment' },
        { Value : sequenceNumber, Label : 'Installment' },
        { Value : dueDate, Label : 'Due Date' },
        { Value : principalAmount, Label : 'Principal' },
        { Value : profitAmount, Label : 'Profit' },
        { Value : installmentAmount, Label : 'Amount Due' },
        { Value : paidAmount, Label : 'Paid Amount' },
        { Value : status, Label : 'Status' }
    ]
);

annotate NHBCAP01Service.MurabahaPayment with @(
    UI.HeaderInfo : {
        TypeName       : 'Murabaha Payment',
        TypeNamePlural : 'Murabaha Payments',
        Title          : { Value : externalPaymentId },
        Description    : { Value : status }
    },
    UI.SelectionFields : [ status, currency, paymentDate ],
    UI.LineItem : [
        { Value : externalPaymentId, Label : 'External Payment ID' },
        { Value : paymentDate, Label : 'Payment Date' },
        { Value : amount, Label : 'Amount' },
        { Value : currency, Label : 'Currency' },
        { Value : status, Label : 'Status' }
    ]
);
