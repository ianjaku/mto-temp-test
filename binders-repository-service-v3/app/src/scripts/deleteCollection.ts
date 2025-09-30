/* eslint-disable no-console */
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <COLLECTION_ID>`);
        process.exit(1);
    }
    return {
        collectionId: process.argv[2]
    };
};

const deleteBinder = async (client: BinderRepositoryServiceClient, binderId: string, indent = 0, accountId: string) => {
    const indentStr = Array(indent).fill("  ").join("");
    console.log(`${indentStr}Attempting to delete binder with id ${binderId}`);
    const publications = await client.findPublicationsBackend(
        { binderId, isActive: 1 },
        { maxResults: 2000 }
    );
    if (publications.length > 0) {
        console.log(`${indentStr}Need to unpublish ${publications.length} items first`);
        const languageCodes = publications.map( ({ language }) => language.iso639_1);
        await client.unpublish(binderId, languageCodes)
    }
    await client.deleteBinder(binderId, accountId);
    console.log(`${indentStr}Success!`);
}

const deleteCollection = async (client: BinderRepositoryServiceClient, collectionId: string, indent = 0) => {
    const indentStr = Array(indent).fill("  ").join("");
    console.log(`${indentStr}Attempting to delete collection with id ${collectionId}`);
    const collection = await client.getCollection(collectionId);
    console.log(`${indentStr}Found ${collection.elements.length} elements to delete.`)
    for (const element of collection.elements) {
        if (element.kind === "collection") {
            await deleteCollection(client, element.key, indent + 1);
        } else {
            await deleteBinder(client, element.key, indent + 1, collection.accountId);
        }
    }
    await client.deleteCollection(collectionId, collection.accountId);
    console.log(`${indentStr}Success!`);
}

const doIt = async () => {
    const { collectionId } = getOptions();
    const config = BindersConfig.get();
    const client = await BackendRepoServiceClient.fromConfig(config, "routing-service");
    await deleteCollection(client, collectionId);
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)