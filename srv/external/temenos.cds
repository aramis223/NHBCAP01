@cds.external
service TemenosCustomerService {
    entity Customers {
        key customerId : String;
        name           : String;
        customerType   : String;
    }

    entity Accounts {
        key accountId     : String;
        accountNumber     : String;
        accountType       : String;
        currency          : String;
        balance           : Decimal(15,2);
        customer_customerId : String;
    }
}
