/* eslint-disable no-console */
import {
    ApprovedStatus,
    Binder,
    BindersRepositoryServiceContract,
    IChunkApproval,
    Language,
    Publication 
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { create as createBinder, update as updateBinder } from "@binders/client/lib/binders/custom/class";
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import hasDraft from "@binders/client/lib/util/hasDraft";
import { patchBinderLogForOldBinder } from "@binders/client/lib/binders/patching";
import moment = require("moment");


const SCRIPT_NAME = "addApprovalsToPublishedBindersForAccount";

// eslint-disable-next-line @typescript-eslint/ban-types
const itemFromESHit = (esHit: Object) => {
    const item = esHit["_source"];
    item.id = esHit["_id"];
    const type = esHit["_type"];
    const kind = {
        "collection": "collection",
        "collections": "collection",
        "document": "document",
        "binder": "document",
        "binders": "document",
        "publication": "publication",
    }[type];
    item.kind = kind || "";
    return item;
};

async function createRepositoriesAndServices() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

    return {
        bindersElasticRepo: new ElasticBindersRepository(
            config,
            logger,
            queryBuilderHelper
        ),
        bindersService: await BackendRepoServiceClient.fromConfig(
            config,
            SCRIPT_NAME
        ),
        publicationsElasticRepo: new ElasticPublicationsRepository(
            config,
            logger,
            queryBuilderHelper
        )
    }
}

async function withEveryBinderInAccount(
    accountId: string,
    bindersRepository: ElasticBindersRepository,
    callback: (binder: Binder) => Promise<void>
) {
    const query = {
        index: bindersRepository.getIndexName(),
        body: { query: { term: { "accountId": accountId }}},
    };
    // eslint-disable-next-line @typescript-eslint/ban-types
    await bindersRepository.runScroll(query, 3600, 50, async (esBatch: Object[]) => {
        const binders = esBatch.map(itemFromESHit) as Binder[];
        for (const binder of binders) {
            await callback(binder);
        }
    });
}

async function createBinderLogsIfMissing(
    binder: Binder,
    bindersRepository: ElasticBindersRepository
) {
    if (binder.binderLog !== undefined) return;
    try {
        console.log(`Adding binder log to binder with id '${binder.id}'`);
        const binderObj = createBinder(binder);
        const logPatch = patchBinderLogForOldBinder(binderObj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedBinder = updateBinder(binderObj, () => [logPatch], false) as any;
        await bindersRepository.updateBinder(updatedBinder.toJSON());
    } catch (e) {
        console.log("Error when upgrading binder: ", binder.id);
        console.log("Error:", e.message);
    }
}

async function fetchPublicationsForBinder(
    binderId: string,
    publicationsElasticRepo: ElasticPublicationsRepository
) {
    const query = {
        index: publicationsElasticRepo.getIndexName(),
        body: {
            query: {
                bool: {
                    must: [
                        {
                            term: {
                                binderId
                            }
                        },
                        {
                            term: {
                                isActive: true
                            }
                        }
                    ]
                }
            },
        },
    }
    return (
        await publicationsElasticRepo.runSearch<Publication[]>(query)
    ).sort((a, b) => moment(a.publicationDate).isBefore(b.publicationDate) ? 1 : -1);
}

function hasUnapprovedChunksInLanguage(
    language: Language,
    binder: Binder,
    publications: Publication[],
    approvals: IChunkApproval[]
) {
    if (hasDraft(binder.modules.meta, language.iso639_1, publications))
        return false;

    const approvalsForLanguage = approvals.filter(
        ap => ap.chunkLanguageCode === language.iso639_1
    );
    const chunkCount = binder.modules.text.chunked[0].editorStates.length;
    // + 1 because title is included in approvals but not in chunk count
    if (approvalsForLanguage.length >= chunkCount + 1) return false;

    if (binder.binderLog == null) {
        console.error(`No binderlog in binder with id '${binder.id}'`);
        process.exit(-1);
    }
    return true;
}

async function approveChunksInLanguage(
    language: Language,
    binder: Binder,
    bindersService: BindersRepositoryServiceContract
) {
    await bindersService.approveChunk(
        binder.id,
        binder.id,
        Date.now(),
        language.iso639_1,
        ApprovedStatus.APPROVED,
    );
    for(const binderLog of binder.binderLog.current) {
        await bindersService.approveChunk(
            binder.id,
            binderLog.uuid,
            binderLog.updatedAt,
            language.iso639_1,
            ApprovedStatus.APPROVED,
        );
    }
}

async function approveAllPublishedBinders(
    binder: Binder,
    publicationsElasticRepo: ElasticPublicationsRepository,
    bindersService: BindersRepositoryServiceContract,
) {
    const publications = await fetchPublicationsForBinder(binder.id, publicationsElasticRepo);
    const approvals = await bindersService.fetchApprovalsForBinder(binder.id);

    for (const language of binder.languages) {
        if (!hasUnapprovedChunksInLanguage(language, binder, publications, approvals)) {
            console.log(`No approval needed for language ${language.iso639_1} in binder ${binder.id}`);
            continue;
        }

        console.log(`Approving chunks for language ${language.iso639_1} in binder '${binder.id}`);
        await approveChunksInLanguage(
            language,
            binder,
            bindersService,
        )
    }
}

function getAccountIdParameter() {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <accountId>`);
        process.exit(-1);
    }
    return process.argv[2].trim();
}

async function addApprovalsToPublishedBindersForAccount() {
    const accountId = getAccountIdParameter();

    const {
        bindersElasticRepo,
        publicationsElasticRepo,
        bindersService
    } = await createRepositoriesAndServices();

    await withEveryBinderInAccount(
        accountId,
        bindersElasticRepo,
        async (binder) => {
            console.log(`Handling binder with id '${binder.id}'`)
            await createBinderLogsIfMissing(binder, bindersElasticRepo);
            await approveAllPublishedBinders(
                binder,
                publicationsElasticRepo,
                bindersService
            );
        }
    );
}

addApprovalsToPublishedBindersForAccount()
    .then(() => {
        console.log("All done.");
        process.exit(0);
    })
    .catch(err => {
        console.log("Script failed!");
        console.error(err);
        process.exit(1);
    });