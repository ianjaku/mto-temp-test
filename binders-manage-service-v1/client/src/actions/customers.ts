import { browserHistory } from "react-router";

export class CustomersActions {

    static switchToOverview(): void {
        browserHistory.push("/customers");
    }

    static switchToCustomerEditDetails(customerId: string): void {
        browserHistory.push("/customers/" + customerId);
    }

    static switchToCustomerAccounts(customerId: string): void {
        browserHistory.push("/customers/" + customerId + "/accounts");
    }

}
