namespace NHBCAP01;

entity Customer
{
    key ID : UUID;
    CustomerNumber : String(100);
    Name : String(100);
    CustomerType : String(50);
    accounts : Association to many Account on accounts.customer = $self;
}

entity Account
{
    key ID : UUID;
    customer : Association to one Customer;
}

using { cuid, managed } from '@sap/cds/common';

entity MurabahaFinancing : cuid, managed {
    customer          : Association to one Customer;
    finxactAccountId  : String(100);
    contractReference : String(100) not null;
    assetDescription  : String(500) not null;
    supplierName      : String(100);
    assetCost          : Decimal(15,2) not null;
    profitAmount       : Decimal(15,2) not null;
    salePrice          : Decimal(15,2) not null;
    currency           : String(3) default 'USD';
    contractDate       : Date;
    maturityDate       : Date;
    status             : String(30) default 'DRAFT';
}
