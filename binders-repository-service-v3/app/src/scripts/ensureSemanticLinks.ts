/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BindersRepositoryService,
    BindersRepositoryServiceFactory
} from  "../repositoryservice/service";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { DocumentType } from "@binders/client/lib/clients/model";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from  "../repositoryservice/repositories/collectionrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
const scriptname = "ensureSemanticLinks";

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

function buildQueries(accountId: string, bindresRepository: ElasticBindersRepository, collectionRepository: ElasticCollectionsRepository) {
    return {
        bindersQuery: {
            index: bindresRepository.getIndexName(),
            body: { query: { term: { accountId } } },
        },
        collectionsQuery: {
            index: collectionRepository.getIndexName,
            body: { query: { term: { accountId } } },
        }
    }
}

const getDeps = async () => {
    const repoFactory = await BindersRepositoryServiceFactory.fromConfig(config);
    const logger = LoggerBuilder.fromConfig(config, scriptname);
    const fakeRequest = {
        logger,
    }
    const repoService = repoFactory.forRequest(fakeRequest);
    const accountService = await BackendAccountServiceClient.fromConfig(config, scriptname);
    const routingService = await BackendRoutingServiceClient.fromConfig(config, scriptname);
    return {
        repoService,
        accountService,
        routingService,
        binderRepo: new ElasticBindersRepository(config, logger, queryBuilderHelper),
        collectionRepo: new ElasticCollectionsRepository(config, logger, queryBuilderHelper),
    };
}

type BatchEntry<I> = { _id: string, _source: I };

async function processBinderBatch(
    esBatch: BatchEntry<Binder>[],
    repoService: BindersRepositoryService,
    domain: string,
) {
    const binders: Binder[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    await Promise.all(binders.map(binder => {
        const languageCodes = binder.languages.map(l => l.iso639_1);
        return repoService.ensureSemanticLinksForItem(binder, DocumentType.DOCUMENT, languageCodes, domain);
    }));
}

async function processCollectionBatch(
    esBatch: BatchEntry<DocumentCollection>[],
    repoService: BindersRepositoryService,
    domain: string,
) {
    const collections: DocumentCollection[] = esBatch.map(({ _id, _source }) => ({ ..._source, id: _id }));
    await Promise.all(collections.map(collection => {
        const languageCodes = collection.titles.map(title => title.languageCode);
        return repoService.ensureSemanticLinksForItem(collection, DocumentType.COLLECTION, languageCodes, domain);
    }));
}

const doIt = async () => {
    const { accountId } = getOptions();
    const { repoService, accountService, routingService, binderRepo, collectionRepo } = await getDeps();
    const accountIds = accountId ? [accountId] : (await accountService.listAccounts()).map(a => a.id);


    for await (const accountId of accountIds) {


        const [domainFilter] = await routingService.getDomainFiltersForAccounts([accountId]);

        const domain = domainFilter?.domain;
        if (!domain) {
            console.log(`No domain filter found for ${accountId} -- skipping`);
            continue;
        }

        console.log(`====================== Processing ${accountId} ===================`);
        const { bindersQuery, collectionsQuery } = buildQueries(accountId, binderRepo, collectionRepo);


        console.log("**************");
        console.log("Act 1. Binders");
        console.log("**************");


        await binderRepo.runScroll<BatchEntry<Binder>>(
            bindersQuery,
            600,
            100,
            (batch) => processBinderBatch(batch, repoService, domain),
        );


        console.log("******************");
        console.log("Act 2. Collections");
        console.log("******************");


        await collectionRepo.runScroll<BatchEntry<DocumentCollection>>(
            collectionsQuery,
            600,
            100,
            (batch) => processCollectionBatch(batch, repoService, domain),
        );
    }

}

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )