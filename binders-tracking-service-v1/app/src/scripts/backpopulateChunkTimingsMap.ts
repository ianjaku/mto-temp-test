/* eslint-disable no-console */
import { TrackingService, TrackingServiceFactory } from "../trackingservice/service";
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

const scriptName = "backpopulateChunkTimingsMap";
const BATCH_SIZE = 1000;
let userActionsToUpdate = [];

async function updateAll(repo: ElasticUserActionsRepository) {
    if (!userActionsToUpdate.length) {
        console.log("No DOCUMENT_READ user actions to update.")
        return;
    }
    console.log(`updating ${userActionsToUpdate.length} DOCUMENT_READ user actions`); // eg ${JSON.stringify(userActionsToUpdate[5], null, 2)}`);
    if (userActionsToUpdate.length > 0) {
        await repo.multiUpdateUserAction(userActionsToUpdate);
    }
    userActionsToUpdate = [];
}

async function processBatch(hits, trackingService: TrackingService) {
    const userActions = hits.map(hit => ({ ...hit._source, id: hit._id, index: hit._index }));
    const publicationIds = await userActions.map(ua => ua.data.publicationId);

    const itemIds = userActions.map(userAction => userAction.data.itemId);
    const { accountId } = getOptions();
    const readSessionsMap = await trackingService.buildReadSessionsMapWithPublicationIds(
        accountId,
        publicationIds,
        {
            accountIds: [accountId],
            documentIds: itemIds,
            excludeEventsWithValidChunkTimingsMap: true,
            range: {
                fieldName: "timestamp",
                rangeStart: new Date(0),
            }
        }
    );

    if (!readSessionsMap) {
        console.log("no read session found in this batch");
        return;
    }

    const toUpdate = userActions.reduce((acc, readAction) => {
        if (readAction.chunkTimingsMap) {
            console.log(`skipping session ${readAction.data.readSessionId}; chunkTimingsMap already present`);
            return acc;
        }
        const publicationId = readAction.data.publicationId;
        const readSessions = readSessionsMap[publicationId];

        if (!readSessions) {
            // shouldn't happen on prod. All read useractions should be accounted for in the readSessionsMap
            // locally it happens because we don't have all the event collections restored
            console.log(`skipping session ${readAction.data.readSessionId}; publication (${publicationId}) not found in readSessionsMap`);
            return acc;
        }

        const chunkTimingsMap = readSessions.find(readSession => readSession.sessionId === readAction.data.readSessionId)?.chunkTimingsMap;

        if (!chunkTimingsMap) {
            // shouldn't happen on prod. All read useractions should be accounted for in the readSessionsMap
            // locally it happens because we don't have all the event collections restored
            console.log(`skipping session ${readAction.data.readSessionId}; sessionId not found in readSessions for publication (${publicationId} - ${readSessions.length} pcs) from readSessionsMap`);
            return acc;
        }
        return chunkTimingsMap ? [...acc, { ...readAction, chunkTimingsMap }] : acc;
    }, []);
    userActionsToUpdate.push(...toUpdate);
}

async function getServices() {
    return {
        accountServiceClient: await BackendAccountServiceClient.fromConfig(config, scriptName),
        trackingService: (await TrackingServiceFactory.fromConfig(config, logger)).forRequest({ logger }),
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
    const { accountServiceClient, trackingService } = await getServices();
    const accountIds = accountId ? [accountId] : (await accountServiceClient.listAccounts()).map(a => a.id);
    const scrollAge = 3600;
    for await (const accountId of accountIds) {
        console.log(`====================== Processing ${accountId} ===================`);
        const { userActionsQuery } = buildQueries(accountId);
        await repo.runScroll(userActionsQuery, scrollAge, BATCH_SIZE, hits => processBatch(hits, trackingService));
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