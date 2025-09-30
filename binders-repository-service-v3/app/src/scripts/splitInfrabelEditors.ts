/* eslint-disable no-console */
import { any, splitEvery } from "ramda";
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DocumentCollection as Collection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { BinderRepositoryServiceClient as RepoServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";

const getOptions = () => {
    if (process.argv.length < 3) {
        console.error(`Usage: node ${__filename} <COLLECTION_ID>`);
        process.exit(1);
    }
    return {
        collectionId: process.argv[2],
    };
};

const thumbnail = { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" };

const setupAlphabet = async (accountId: string, currentCollection: Collection,
    currentElements: Collection[], domainCollectionId: string, client: RepoServiceClient) => {
    for (let a = "A".charCodeAt(0); a <= "Z".charCodeAt(0); a++) {
        const letter = String.fromCharCode(a);
        console.log(`Processing ${letter}`);
        if (currentElements.find(c => any(t => t.title === letter, c.titles))) {
            console.log(`Collection ${letter} exists`);
        } else {
            const newCollection = await client.createCollectionBackend(accountId, letter, "en",
                thumbnail as Thumbnail, domainCollectionId);
            await client.addElementToCollection(currentCollection.id, "collection", newCollection.id, accountId);
            currentElements.push(newCollection);
            console.log(`Collection ${letter} added`);
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cleanAlphabet = async (currentElements: Collection[], client: RepoServiceClient, accountId: string) => {
    for (let a = "A".charCodeAt(0); a <= "Z".charCodeAt(0); a++) {
        const letter = String.fromCharCode(a);
        console.log(`Processing ${letter}`);
        const matchingCollectionIndex = currentElements.findIndex(c => any(t => t.title === letter, c.titles))
        if (matchingCollectionIndex > -1) {
            const matchingCollection = currentElements[matchingCollectionIndex];
            currentElements.splice(matchingCollectionIndex, 1);
            console.log(`Removing ${letter}`);
            await client.deleteCollection(matchingCollection.id, accountId)
        }
    }
}

const distributeCollections = async (currentCollection: Collection, allElements: Collection[], repoClient: RepoServiceClient, accountId: string) => {
    for (const toMove of allElements) {
        const firstTitle = toMove.titles[0].title;
        const targetTitle = firstTitle.toUpperCase()[0];
        if (targetTitle === firstTitle) {
            console.log(`Skipping collection ${firstTitle}`);
            continue;
        }
        const targetCollection = allElements.find(c => c.titles[0].title === targetTitle);
        if (!targetCollection) {
            console.log(`Skipping ${firstTitle}, could not find target ${targetTitle}`);
            continue;
        }
        await repoClient.addElementToCollection(targetCollection.id, "collection", toMove.id, accountId);
        await repoClient.removeElementFromCollection(currentCollection.id, "collection", toMove.id, accountId);
        console.log(`Moved ${firstTitle} to ${targetTitle}`);
    }
}

const doIt = async () => {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "split-infrabel-editors");
    const { collectionId } = getOptions();
    const collection = await repoClient.getCollection(collectionId);
    const items = splitEvery(100, collection.elements);
    const allElements = [];
    for (const batch of items) {
        const batchItems = await repoClient.findCollections({ids: batch.map(b => b.key)}, { maxResults: 9999});
        allElements.push(...batchItems);
    }
    const { accountId } = collection;
    const [rootCollection] = await repoClient.getRootCollections([accountId]);
    // await cleanAlphabet(allElements, repoClient);
    await setupAlphabet(accountId, collection, allElements, rootCollection.id, repoClient);
    await distributeCollections(collection, allElements, repoClient, accountId);
}

doIt().then( () => {
    console.log("All done!");
    process.exit(0);
}, error => {
    console.log(error);
    process.exit(1);
});

