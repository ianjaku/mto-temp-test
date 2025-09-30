/* eslint-disable no-console */
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <BINDER_ID>`);
        process.exit(1);
    }
    return {
        binderId: process.argv[2],
    };
};

const { binderId } = getOptions();


BackendRepoServiceClient.fromConfig(config, "binders").then(async (repoServiceClient) => {
    const binder = await repoServiceClient.getBinder(binderId);
    if (!binder) {
        console.error("no binder found");
    }
    const { accountId } = binder;
    if (!accountId) {
        console.error("binder has no account id");
        process.exit(1);
    }

    console.log("binder has account id", accountId);

    const collections = await repoServiceClient.findCollections(
        { itemIds: [binderId] },
        { maxResults: 2000 }
    );

    const disallowedCollectionIds = collections.reduce((reduced, col) => {
        if (col.accountId !== accountId) {
            reduced.push(col.id);
        }
        return reduced;
    }, []);

    console.log("in collections:", collections.map(col => disallowedCollectionIds.indexOf(col.id) > -1 ? `${col.id} (doesn't belong here)` : col.id ).join("\n"));
    if (disallowedCollectionIds && disallowedCollectionIds.length > 0) {
        console.log("cleaning up...");
        await Promise.all(disallowedCollectionIds.map(colId => (
            repoServiceClient.removeElementFromCollection(colId, "document", binderId, accountId)
        )));
    } else {
        console.log("no issues found");
    }
    console.log("done");

});