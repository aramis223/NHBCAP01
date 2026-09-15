
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    const temenos = await cds.connect.to('TemenosCustomerService');

    console.log('Connected to TemenosCustomerService');

    this.before('CREATE', 'Customer', async (req) => {

        try {

            const existingCustomer = await cds.run(
                SELECT.one
                    .from('NHBCAP01.Customer')
                    .where({
                        CustomerNumber: req.data.CustomerNumber
                    })
            );

            if (existingCustomer) {

                req.error(
                    409,
                    `Customer Number ${req.data.CustomerNumber} already exists.`
                );

            }

        } catch (error) {

            console.error('Customer validation failed:', error);

        }

    });
        this.on('READ', 'NHBCustomer', async (req) => {

        console.log('NHBCustomer READ request received');
        console.log('NHBCustomer request params:', req.params);
        console.log('NHBCustomer request where:', JSON.stringify(req.query.SELECT.where));
        
        const where = req.query.SELECT.where;

        if (where) {
        console.log('Filter field:', where[0].ref[0]);
        console.log('Filter value:', where[2].val);
}
        try {

            let customers;

                if (req.params.length) {

                    customers = await temenos.run(
                        SELECT.from('Customers')
                        .where({
                    customerId: req.params[0].CustomerNumber
            })
    );

                } else {

                    let query = SELECT.from('Customers');

                        if (where) {
                        query.where({
                        customerType: where[2].val
                        });
}

customers = await temenos.run(query);

}

            return customers.map(customer => ({
                CustomerNumber: customer.customerId,
                Name: customer.name,
                CustomerType: customer.customerType
            }));

        } catch (error) {

            console.error(
                'NHBCustomer request failed:',
                error
            );

            return req.reject(
                502,
                'Temenos service is currently unavailable.'
            );

        }

    });
    this.on('READ', 'TemenosAccount', async (req) => {

        console.log('TemenosAccount READ request received');
        console.log(req.query);
        console.log(req.params);

        if (req.params?.length && req.params[0].customerId) {

            const customerId = req.params[0].customerId;

            try {

                return await temenos.run(
                    SELECT.from('Accounts')
                        .where({
                            customer_customerId: customerId
                        })
                );

            } catch (error) {

                console.error(
                    'Temenos account request failed:',
                    error
                );

                return req.reject(
                    502,
                    'Temenos service is currently unavailable.'
                );

            }

        }

        return await temenos.run(
            SELECT.from('Accounts')
        );

    });

});

