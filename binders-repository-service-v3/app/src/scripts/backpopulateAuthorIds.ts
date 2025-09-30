/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Binder, Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import {
    ElasticPublicationsRepository
} from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import moment = require("moment");

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getOptions = () => {
    if (process.argv.length < 3) {
        console.log(`Running for all accounts, single account usage: node ${__filename} <ACCOUNT_ID>`);
        return { accountId: undefined };
    }
    const accountId = process.argv[2];
    console.log(`Running for single accountId with id ${accountId}`);
    return {
        accountId,
    };
};

const scriptName = "backpopulateAuthorIds";


type BatchEntry<I> = { _id: string, _source: I };
type AuthorMap = { [itemId: string]: string[] };

async function getBinderAuthorMap(
    trackingService: TrackingServiceClient,
    accountId: string,
    binderIds: string[],
): Promise<AuthorMap> {
    // look for all user action editeds for this binderId
    const findResult = await trackingService.findUserActions({
        accountId,
        userActionTypes: [UserActionType.ITEM_EDITED],
        itemIds: binderIds
    });
    return binderIds.reduce((reduced, binderId) => {
        const binderEditUserActions = findResult.userActions.filter(a => a.data.itemId === binderId);
        const authorIds = binderEditUserActions.reduce((red, action) => red.includes(action.userId) ? red : [...red, action.userId], []);
        return {
            ...reduced,
            [binderId]: authorIds
        };
    }, {});
}

async function getPublicationAuthorMap(
    trackingService: TrackingServiceClient,
    accountId: string,
    publications: Publication[],
): Promise<AuthorMap> {

    // look for all binder edits for the binderId of this publication
    // that occurred BEFORE the publication date

    const findResult = await trackingService.findUserActions({
        accountId,
        userActionTypes: [UserActionType.ITEM_EDITED],
        itemIds: publications.map(p => p.binderId),
    });

    return publications.reduce((reduced, publication) => {
        const publicationId = publication.id;
        const editActionsForPub = findResult.userActions.filter(a => {
            return (a.data.itemId === publication.binderId) &&
                (a.start && moment(a.start).isBefore(moment(publication.publicationDate)));
        });
        return {
            ...reduced,
            [publicationId]: editActionsForPub.reduce((red, action) => red.includes(action.userId) ? red : [...red, action.userId], []),
        };
    }, {});
}

async function saveAuthorIdsToBinders(
    authorMap: AuthorMap,
    binders: Binder[],
    binderRepo: ElasticBindersRepository,
): Promise<void> {
    Object.keys(authorMap).map(binderId => {
        const authorIds = authorMap[binderId];
        const binder = binders.find(b => b.id === binderId);
        // if (binder.authorIds) {
        //     console.log(`binder ${binder.id} already has ${binder.authorIds.length} authors defined, skipping`);
        //     return Promise.resolve();
        // }
        console.log(`binder ${binder.id}: adding ${authorIds.length} authors`);
        binder.authorIds = authorIds;
    });
    await binderRepo.bulk(binders, [], true);
}

async function saveAuthorIdsToPublications(
    authorMap: AuthorMap,
    publications: Publication[],
    publicationRepo: ElasticPublicationsRepository,
): Promise<void> {
    Object.keys(authorMap).map(publicationId => {
        const authorIds = authorMap[publicationId];
        const publication = publications.find(b => b.id === publicationId);
        // if (publication.authorIds) {
        //     console.log(`publication ${publication.id} already has ${publication.authorIds.length} authors defined, skipping`);
        //     return Promise.resolve();
        // }
        console.log(`publication ${publication.id}: adding ${authorIds.length} authors`);
        publication.authorIds = authorIds;
    });
    await publicationRepo.bulk(publications, [], false);
}

async function processBinderBatch(
    esBatch: BatchEntry<Binder>[],
    trackingService: TrackingServiceClient,
    accountId: string,
    binderRepo: ElasticBindersRepository,
) {
    const binders: Binder[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    const binderIds = binders.map(binder => binder.id);
    const authorMap = await getBinderAuthorMap(trackingService, accountId, binderIds);
    await saveAuthorIdsToBinders(authorMap, binders, binderRepo);
}

async function processPublicationBatch(
    esBatch: BatchEntry<Publication>[],
    trackingService: TrackingServiceClient,
    accountId: string,
    publicationRepo: ElasticPublicationsRepository,
) {
    const publications: Publication[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    const authorMap = await getPublicationAuthorMap(trackingService, accountId, publications);
    await saveAuthorIdsToPublications(authorMap, publications, publicationRepo);
}

function getRepos() {
    return {
        binderRepo: new ElasticBindersRepository(config, logger, queryBuilderHelper),
        publicationRepo: new ElasticPublicationsRepository(config, logger, queryBuilderHelper),
    }
}

async function getServices() {
    return {
        trackingService: await BackendTrackingServiceClient.fromConfig(config, scriptName),
        accountService: await BackendAccountServiceClient.fromConfig(config, scriptName),
    };
}

function buildQueries(accountId: string, bindersRepository: ElasticBindersRepository, publicationRepository: ElasticPublicationsRepository) {
    return {
        bindersQuery: {
            index: bindersRepository.getIndexName(),
            body: { query: { term: { accountId } } },
        },
        publicationsQuery: {
            index: publicationRepository.getIndexName(),
            body: { query: { term: { accountId } } },
        }
    }
}

function sleep(sleepInMs) {
    return new Promise( resolve => setTimeout(resolve, sleepInMs));
}

async function runScrollWithRetry(repo, query, batchProcess, batchSize, attempt = 1) {
    try {
        await repo.runScroll(
            query,
            600,
            batchSize,
            batchProcess
        );
    } catch (err) {
        console.error(err);
        if (attempt <= 5) {
            await sleep(10000);
            console.log(`!!!!!!! Retrying batch ${attempt} / 5`);
            await runScrollWithRetry(repo, query, batchProcess, batchSize, attempt + 1);
        } else {
            throw err;
        }
    }
}

const doIt = async () => {
    const { binderRepo, publicationRepo } = getRepos();
    const { trackingService, accountService } = await getServices();

    const { accountId } = getOptions();
    const accountIds = accountId ? [accountId] : (await accountService.listAccounts()).map(a => a.id);

    let accountsProcessed = 0;
    const totalAccounts = accountIds.length;
    for await (const accountId of accountIds) {
        accountsProcessed++;
        console.log(`\n\n\n----> Processing acount ${accountId} (${accountsProcessed} / ${totalAccounts}})`);
        console.log(`====================== Processing ${accountId} ===================`);
        const { bindersQuery, publicationsQuery } = buildQueries(accountId, binderRepo, publicationRepo);

        console.log("**************");
        console.log("Act 1. Binders");
        console.log("**************");
        await runScrollWithRetry(
            binderRepo,
            bindersQuery,
            (batch) => processBinderBatch(batch, trackingService, accountId, binderRepo),
            100
        );

        console.log("*******************");
        console.log("Act 2. Publications");
        console.log("*******************");
        await runScrollWithRetry(
            publicationRepo,
            publicationsQuery,
            (batch) => processPublicationBatch(batch, trackingService, accountId, publicationRepo),
            100
        );
    }
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    }, error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });