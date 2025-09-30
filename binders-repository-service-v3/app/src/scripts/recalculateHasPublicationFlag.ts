/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { LoggerBuilder, debugLog } from "@binders/binders-service-common/lib/util/logging";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ES_MAX_RESULTS } from "../repositoryservice/const";
import {
    ElasticCollectionsRepository
} from "../repositoryservice/repositories/collectionrepository";
import {
    ElasticPublicationsRepository
} from "../repositoryservice/repositories/publicationrepository";
import HasPublicationsResolver from "../repositoryservice/publicationflags";


const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);


const getOptions = () => {
    const accountId = process.argv.length > 2 && process.argv[2];
    if (!accountId) {
        console.log("Running for all accounts. To run for a single account, run `node recalculateHasPublicationFlag.js <accountId>`");
    }
    return {
        accountId,
    };
};

(async function () {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "add-accountmemberships-retroact-script");
    const publicationRepository = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const collectionRepository = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "binders");

    async function getAccounts(): Promise<Account[]> {
        const { accountId } = getOptions();
        if (accountId) {
            return [await accountServiceClient.getAccount(accountId)];
        }
        return await accountServiceClient.listAccounts();
    }

    const accounts = await getAccounts();

    const resolvedIds = new Set<string>();

    const hasPublicationsResolver = new HasPublicationsResolver(publicationRepository, collectionRepository, logger);
    for (const account of accounts) {
        const collections = await collectionRepository.findCollections({ accountId: account.id }, { maxResults: ES_MAX_RESULTS });
        for (const collection of collections) {
            if (resolvedIds.has(collection.id)) {
                continue;
            }
            const [, ancestors] = await Promise.all([
                hasPublicationsResolver.resolveCollection(collection),
                repoServiceClient.getAncestors(collection.id),
            ]);
            const ancestorIds = Object.keys(ancestors);
            debugLog(`resolved ${collection.id}, its ancestors are ${ancestorIds}, from obj ${JSON.stringify(ancestors)}`);
            ancestorIds.forEach((ancestorId) => resolvedIds.add(ancestorId));
        }
    }

    console.log("Done!");
    process.exit(0);
})();