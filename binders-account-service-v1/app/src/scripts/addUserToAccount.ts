/* eslint-disable no-console */
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <USERID> <ACCOUNTID>`);
        process.exit(1);
    }
    return {
        userId: process.argv[2],
        accountId: process.argv[3]
    };
};

const {accountId, userId} = getOptions();

const config = BindersConfig.get();

BackendAccountServiceClient.fromConfig(config, "add-to-account-script")
    .then(client => client.addMember(accountId, userId, ManageMemberTrigger.SCRIPT))
    .then(() => {
        console.log("Success!");
        process.exit(0);
    })
    .catch(error => {
        console.error("ERROR!", error);
        process.exit(1);
    });