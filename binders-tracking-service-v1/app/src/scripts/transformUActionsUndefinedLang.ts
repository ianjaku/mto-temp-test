/* eslint-disable no-console */
import { UNDEFINED_LANG, UNDEFINED_LANG_UI } from "@binders/client/lib/util/languages";
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from  "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

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

const scriptName = "backpopulateUserIsAuthor";
const BATCH_SIZE = 1000;
let userActionsToUpdate = [];

async function updateAll(repo: ElasticUserActionsRepository) {
    if (!userActionsToUpdate.length) {
        console.log("No DOCUMENT_READ user actions found.")
        return;
    }
    console.log(`updating ${userActionsToUpdate.length} DOCUMENT_READ user actions, eg ${JSON.stringify(userActionsToUpdate[0], null, 2)}`);
    if (userActionsToUpdate.length > 0) {
        await repo.multiUpdateUserAction(userActionsToUpdate);
    }
    userActionsToUpdate = [];
}

async function processBatch(hits) {
    const readActions = hits.map(hit => ({ ...hit._source, id: hit._id, index: hit._index }));
    for (const readAction of readActions) {
        if (readAction.data.itemLanguage === UNDEFINED_LANG_UI) {
            readAction.data.itemLanguage = UNDEFINED_LANG;
            userActionsToUpdate.push(readAction);
        }
    }
}

async function getServices() {
    return {
        accountService: await BackendAccountServiceClient.fromConfig(config, scriptName),
    };
}

function buildQueries(accountId: string) {
    return {
        userActionsQuery: {
            index: "useractions",
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { userActionType: UserActionType.DOCUMENT_READ } },
                            { term: { accountId: accountId } },
                        ]
                    }
                }
            }
        }
    }
}

const doIt = async () => {
    const { accountId } = getOptions();
    const repo = new ElasticUserActionsRepository(config, logger);
    const { accountService } = await getServices();
    const accountIds = accountId ? [accountId] : (await accountService.listAccounts()).map(a => a.id);

    const scrollAge = 3600;

    for await (const accountId of accountIds) {
        console.log(`====================== Processing ${accountId} ===================`);
        const { userActionsQuery } = buildQueries(accountId);
        await repo.runScroll(userActionsQuery, scrollAge, BATCH_SIZE, hits => processBatch(hits));
        await updateAll(repo);
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