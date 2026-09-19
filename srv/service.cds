
using { NHBCAP01 as my } from '../db/schema.cds';

@path : '/service/NHBCAP01Service'
service NHBCAP01Service
{
    @cds.redirection.target
    entity Customer as
    projection on my.Customer;

    @cds.redirection.target
    entity Account as
    projection on my.Account;

    @cds.redirection.target
    entity MurabahaFinancing as
    projection on my.MurabahaFinancing;

    @cds.persistence.skip
    entity NHBCustomer
    {
        key CustomerNumber : String;
        Name               : String;
        CustomerType       : String;
    }

    @cds.persistence.skip
    entity TemenosCustomer
    {
        key customerId : String;
        name           : String;
        customerType   : String;

        accounts : Association to many TemenosAccount
            on accounts.customer_customerId = customerId;
    }

    @cds.persistence.skip
    entity TemenosAccount
    {
        key accountId             : String;
        accountNumber             : String;
        accountType               : String;
        currency                  : String;
        balance                   : Decimal(15,2);
        customer_customerId       : String;
    }

   type FiservBalance {
    balanceType : String;
    amount      : Decimal(15,2);
    currency    : String;
}

type FiservAccount {
    accountId   : String;
    accountType : String;
    description : String;
    currency    : String;
    accountTitle: String;
    openDate    : Date;
    status      : String;
    balances    : many FiservBalance;
}

function getFiservAccountDetails(
    accountId : String
) returns FiservAccount;


}
