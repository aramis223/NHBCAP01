sap.ui.define([
"sap/ui/core/mvc/Controller",
"sap/m/MessageBox"
], (Controller, MessageBox) => {
"use strict";

return Controller.extend(
    "nhb.cap.customer.customerui.controller.Customer",
    {

        onInit() {
        },

        onSearch() {
            const customerId = this.byId("customerIdInput").getValue();
            const page = this.byId("page");

            page.setBusy(true);

            page.bindElement({
                path: `/TemenosCustomer('${customerId}')`,
                events: {
                    dataRequested: () => {
                    },

                    dataReceived: (oEvent) => {
                        page.setBusy(false);

                        if (!oEvent.getParameter("data")) {
                            MessageBox.error(
                                `Customer ${customerId} not found.`
                            );
                        }
                    }
                }
            });
        },

        onCustomerPress(oEvent) {
            const item = oEvent.getSource();
            const context = item.getBindingContext();
            const customer = context.getObject();
            const page = this.byId("page");
            const input = this.byId("customerIdInput");

            input.setValue(customer.customerId);
            page.setBindingContext(context);
        },

async onCreateCustomer() {

    try {

        const number = this.byId(
            "createCustomerNumberInput"
        ).getValue().trim();

        const name = this.byId(
            "createCustomerNameInput"
        ).getValue().trim();

        const type = this.byId(
            "createCustomerTypeInput"
        ).getValue().trim();

        if (!number || !name || !type) {

            MessageBox.warning(
                "Please enter Customer Number, Name, and Customer Type."
            );

            return;
        }

        const model = this.getView().getModel();

        const listBinding = model.bindList("/Customer");

        listBinding.create({
            CustomerNumber: number,
            Name: name,
            CustomerType: type
        });

        await model.submitBatch("$auto");

        MessageBox.success(
            `Customer ${number} was created successfully.`
        );

    } catch (error) {

        console.error("Customer creation failed:", error);

        MessageBox.error(
            "Customer could not be created. Please check the entered data and try again."
        );
    }
},

async onUpdateCustomer() {

    try {

        const number = this.byId(
            "updateCustomerNumberInput"
        ).getValue().trim();

        const newName = this.byId(
            "updateCustomerNameInput"
        ).getValue().trim();

        if (!number || !newName) {

            MessageBox.warning(
                "Please enter Customer Number and New Name."
            );

            return;
        }

        const model = this.getView().getModel();

        const customers = await model.bindList("/Customer").requestContexts();

        const context = customers.find(ctx =>
            ctx.getObject().CustomerNumber === number
        );

        if (!context) {

            MessageBox.error(
                `Customer ${number} was not found.`
            );

            return;
        }

        context.setProperty("Name", newName);

        await model.submitBatch("$auto");

        MessageBox.success(
            `Customer ${number} was updated successfully.`
        );

    } catch (error) {

        console.error("Customer update failed:", error);

        MessageBox.error(
            "Customer could not be updated."
        );
    }
},

async onDeleteCustomer() {

    try {

        const number = this.byId(
            "deleteCustomerNumberInput"
        ).getValue().trim();

        if (!number) {

            MessageBox.warning(
                "Please enter Customer Number."
            );

            return;
        }

        const model = this.getView().getModel();

        const customers = await model
            .bindList("/Customer")
            .requestContexts();

        const context = customers.find(ctx =>
            ctx.getObject().CustomerNumber === number
        );

        if (!context) {

            MessageBox.error(
                `Customer ${number} was not found.`
            );

            return;
        }

        context.delete("$auto");

        await model.submitBatch("$auto");

        MessageBox.success(
            `Customer ${number} was deleted successfully.`
        );

    } catch (error) {

        console.error("Customer deletion failed:", error);

        MessageBox.error(
            "Customer could not be deleted."
        );
    }
}

}    
);

});
