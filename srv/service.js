require('dotenv').config();

const cds = require('@sap/cds');
const { getAccountDetails } = require('./fiserv/accounts');

module.exports = cds.service.impl(async function () {

    const temenos = await cds.connect.to('TemenosCustomerService');

    console.log('Fiserv environment check:', {
        baseUrl: !!process.env.FISERV_API_BASE_URL,
        tokenUrl: !!process.env.FISERV_TOKEN_URL,
        apiKey: !!process.env.FISERV_API_KEY,
        apiSecret: !!process.env.FISERV_API_SECRET,
        accountId: !!process.env.FISERV_TEST_ACCOUNT_ID,
        orgId: !!process.env.FISERV_ORG_ID
    });

    this.on('getFiservAccountDetails', async (req) => {

        const { accountId } = req.data;

        if (!accountId) {
            return req.reject(
                400,
                'Fiserv accountId is required.'
            );
        }

        try {

            const data = await getAccountDetails(
                accountId,
                process.env.FISERV_ORG_ID
            );

            const account = data.AcctRec;
            const depositInfo = account.DepositAcctInfo;

        return {
            accountId: account.AcctKeys.AcctId,
            accountType: account.AcctKeys.AcctType,
            description: depositInfo.Desc,
            currency: depositInfo.CurCode?.CurCodeValue,
            accountTitle: depositInfo.AcctTitle,
            openDate: depositInfo.OpenDt,
            status: account.AcctStatus?.AcctStatusCode,
            balances: (depositInfo.AcctBal || []).map(balance => ({
            balanceType: balance.BalType,
            amount: balance.CurAmt?.Amt,
            currency: balance.CurAmt?.CurCode?.CurCodeValue
    }))
};

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
        'Fiserv account request failed:',
        error
    );

    return req.reject(
        502,
        'Fiserv service is currently unavailable.'
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
                    'NHBCustomer request failed:',
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

