/* eslint-disable no-console */
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const getOptions = () => {
    if (process.argv.length !== 6) {
        console.error(`Usage: node ${__filename} <COLLECTION_ID> <KIND> <ELEMENT_ID> <ACCOUNT_ID>`);
        process.exit(1);
    }
    return {
        collectionId: process.argv[2],
        kind: process.argv[3],
        elementId: process.argv[4],
        accountId: process.argv[5],
    };
};

const removeElement = async (collectionId: string, kind: string, elementId: string, accountId: string) => {
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "binders");
    repoServiceClient.removeElementFromCollection(collectionId, kind, elementId, accountId);
}

const { collectionId, kind, elementId, accountId } = getOptions();

removeElement(collectionId, kind, elementId, accountId).then(() => {
    console.log("done");
});
