import { browserHistory } from "react-router";

export class AccountsActions {

    static switchToOverview(): void {
        browserHistory.push("/accounts");
    }

    static switchToAccountAdmins(accountId: string): void {
        browserHistory.push(`/accounts/${accountId}/admins`);
    }

    static switchToAccountEditDetails(accountId: string): void {
        browserHistory.push("/accounts/" + accountId);
    }

    static switchToAccountMembers(accountId: string): void {
        browserHistory.push("/accounts/" + accountId + "/members");
    }

    static switchToFeatures(accountId: string): void {
        browserHistory.push("/accounts/" + accountId + "/features");
    }

}

