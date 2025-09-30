/* eslint-disable no-console */
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const includeAccountsFromOptions = () => {
    if (process.argv.includes("-a")) {
        return true;
    }
    console.log("to include accounts, run with -a flag");
    return false;
};

const SCRIPTNAME = "listCrmConnectedCustomers";


const doIt = async () => {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const customers = await accountServiceClient.listCustomers();
    const accounts = await accountServiceClient.listAccounts();
    const includeAccounts = includeAccountsFromOptions();

    function formatAccount(account) {
        return `${account.name} (${account.id})`;
    }

    function formatCustomer(customer) {
        const accountsStr = includeAccounts ?
            `\n\t${customer.accountIds.map(aid => formatAccount(accounts.find(a => a.id === aid))).join("\n\t")}` :
            "";
        return `${customer.name}${accountsStr}`;
    }


    console.log(
        customers
            .filter((customer) => customer.crmCustomerId !== undefined)
            .map(customer => formatCustomer(customer))
            .join("\n")
    );
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    (err) => {
        console.error("Something went wrong!");
        console.error(err);
        process.exit(1);
    }
)