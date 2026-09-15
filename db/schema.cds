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
