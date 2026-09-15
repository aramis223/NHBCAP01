
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

    entity NHBCustomer
    {
        key CustomerNumber : String;
        Name               : String;
        CustomerType       : String;
    }

    entity TemenosCustomer
    {
        key customerId : String;
        name           : String;
        customerType   : String;

        accounts : Association to many TemenosAccount
            on accounts.customer_customerId = customerId;
    }

    entity TemenosAccount
    {
        key accountId             : String;
        accountNumber             : String;
        accountType               : String;
        currency                  : String;
        balance                   : Decimal(15,2);
        customer_customerId       : String;
    }
}
