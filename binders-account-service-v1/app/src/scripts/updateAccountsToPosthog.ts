/* eslint-disable no-console */
import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    updatePosthogAccountProperties
} from "@binders/binders-service-common/lib/tracking/capture";

const config = BindersConfig.get();

const doIt = async () => {
    const accountService = await BackendAccountServiceClient.fromConfig(config, "updateAccountsToPosthog");
    const accounts = await accountService.listAccounts();
    for (const account of accounts) {
        const features = await accountService.getAccountFeatures(account.id);
        console.log("Updating account", account.name);
        await updatePosthogAccountProperties(account.id, {
            name: account.name,
            createdAt: account.created,
            domain: account.domains[0],
            expirationDate: account.expirationDate,
            readerExpirationDate: account.readerExpirationDate,
            maxNumberOfLicenses: account.maxNumberOfLicenses,
            maxPublicCount: account.maxPublicCount,
            membersCount: account.members.length,
            rootCollectionId: account.rootCollectionId,
            enabledFeatures: features
        });
    }
}

doIt()
    .then(() => {
        console.log("Finished");
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });