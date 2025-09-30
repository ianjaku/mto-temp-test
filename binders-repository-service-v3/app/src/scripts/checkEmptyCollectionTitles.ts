import { BackendAccountServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { log, main } from "@binders/binders-service-common/lib/util/process";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";


function getOptions() {
    const options = {
        fix: process.argv.includes("--fix"),
    };
    return options;
}

const SCRIPT = "check-empty-collection-titles";

main(async () => {
    const { fix } = getOptions();
    const config = BindersConfig.get();
    const backendRepoClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT);
    const backendAccountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT);
    const allAcounts = await backendAccountClient.listAccounts();
    const collectionsInNeedOfTitle = [];
    const collectionFindOptions = {
        maxResults: 5000,
    };
    for (const account of allAcounts) {
        const { id: accountId, name: accountName } = account;
        const filter = {
            accountId,
        };
        const collections = await backendRepoClient.findCollections(filter, collectionFindOptions);
        for (const collection of collections) {
            const { id: collectionId, titles } = collection;
            const faultyCodes = [];
            let validTitle;
            for (const titleWithCode of titles) {
                const { title, languageCode } = titleWithCode;
                if (!title || title === "") {
                    faultyCodes.push(languageCode);
                    log(`Empty title for ${collection.id} (${languageCode} - "${accountName}")`);
                } else {
                    if(!validTitle) {
                        validTitle = title
                    }
                }
            }
            if (faultyCodes.length > 0) {
                if (!validTitle) {
                    validTitle = `Collection ${collectionId} (${accountName})`;
                }
                collectionsInNeedOfTitle.push({
                    accountId,
                    accountName,
                    collectionId,
                    faultyCodes,
                    validTitle,
                })
            }
        }
    }
    const faultyCollectionCount = collectionsInNeedOfTitle.length;
    if (faultyCollectionCount > 0) {
        log(`Found ${faultyCollectionCount} collections with at least 1 empty titles`);
        if (fix) {
            for (const collectionInfo of collectionsInNeedOfTitle) {
                const { validTitle, collectionId, faultyCodes } = collectionInfo;
                for (const faultyCode of faultyCodes) {
                    log(`Setting collection ${collectionId} title to "${validTitle}" for language ${faultyCode}`);
                    await backendRepoClient.saveCollectionTitle(collectionId, validTitle, faultyCode);
                }
            }
        }
    } else {
        log("No empty collection titles found");
    }
})