@cds.external
service TemenosCustomerService {
    @cds.persistence.skip
    entity Customers {
        key customerId : String;
        name           : String;
        customerType   : String;
    }

    @cds.persistence.skip
    entity Accounts {
        key accountId             : String;
        accountNumber             : String;
        accountType               : String;
        currency                  : String;
        balance                   : Decimal(15,2);
        customer_customerId      : String;
    }
}