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

const scriptName = "fixNullAuthorIds";

type BatchEntry<I> = { _id: string, _source: I };

const bindersToFix = [];
const publicationsToFix = [];

async function processBinderBatch(
    esBatch: BatchEntry<Binder>[],
) {
    const binders: Binder[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    const withNullArr = binders.filter(b => b.authorIds.some(a => a == null));
    bindersToFix.push(...withNullArr.map(b => ({ ...b, authorIds: b.authorIds.filter(a => a != null) })));
}

async function processPublicationBatch(
    esBatch: BatchEntry<Publication>[],
) {
    const publications: Publication[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    const withNullArr = publications.filter(p => p.authorIds.some(a => a == null));
    publicationsToFix.push(...withNullArr.map(p => ({ ...p, authorIds: p.authorIds.filter(a => a != null) })));
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
    return new Promise(resolve => setTimeout(resolve, sleepInMs));
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
    const { accountService } = await getServices();

    const { accountId } = getOptions();
    const accountIds = accountId ? [accountId] : (await accountService.listAccounts()).map(a => a.id);

    let accountsProcessed = 0;
    const totalAccounts = accountIds.length;
    for await (const accountId of accountIds) {
        accountsProcessed++;
        console.log(`\n\n\n----> Processing acount ${accountId} (${accountsProcessed} / ${totalAccounts}})`);
        console.log(`====================== Processing ${accountId} ===================`);
        const { bindersQuery, publicationsQuery } = buildQueries(accountId, binderRepo, publicationRepo)

        console.log("**************");
        console.log("Act 1. Binders");
        console.log("**************");
        await runScrollWithRetry(
            binderRepo,
            bindersQuery,
            (batch) => processBinderBatch(batch),
            100
        );

        console.log("*******************");
        console.log("Act 2. Publications");
        console.log("*******************");
        await runScrollWithRetry(
            publicationRepo,
            publicationsQuery,
            (batch) => processPublicationBatch(batch),
            100
        );

        if (bindersToFix.length) {
            await binderRepo.bulk(bindersToFix, [], true);
        }
        if (publicationsToFix.length) {
            await publicationRepo.bulk(publicationsToFix, [], false);
        }
    }
};

doIt()
    .then(() => {
        console.log(`Fixed ${bindersToFix.length} binders with null authors: IDS: ${bindersToFix.map(b => b.id)}`);
        console.log(`Fixed ${publicationsToFix.length} publications with null authors: IDS: ${publicationsToFix.map(b => b.id)}`);
        console.log("All done!");
        process.exit(0);
    }, error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });