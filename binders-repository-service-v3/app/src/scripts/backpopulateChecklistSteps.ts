/* eslint-disable no-console */
/**
* When a checklist is performed (clicked) an item gets added to its performedHistory. (also called an action)
*
* These items have a "step" attribute that identifies the checklist when the user performed the action.
* For example:
*  1. There are 3 checklists in a document
*  2. The user clicks the third checklist
*  3. A performedHistory gets added with "step": 2 (first is 0)
*
* This script backpopulates older checklists by guessing their steps,
* because we don't have enough data to get the exact values
*
* Add "--overwrite" after the command to overwrite existing step & publicationId values
*/
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { isAfter, isBefore } from "date-fns";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ChecklistConfigRepositoryFactory
} from  "../repositoryservice/repositories/checklistconfigrepository";
import {
    ChecklistsRepositoryFactory
} from  "../repositoryservice/repositories/checklistsrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";

const scriptName = "backpopulateChecklistSteps.ts";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    // Overwrite existing "step" & "publicationId"
    const shouldOverwrite = process.argv[2] === "--overwrite";

    return {
        shouldOverwrite,
    };
};

const getChecklistsRepo = async () => {
    const mongoLogin = getMongoLogin("repository_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "checklists", mongoLogin);
    const factory = new ChecklistsRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

const getChecklistConfigRepo = async () => {
    const mongoLogin = getMongoLogin("repository_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "checklistconfigs", mongoLogin);
    const factory = new ChecklistConfigRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

const getAccountLanguage = async (accountId: string) => {
    const accountClient = await BackendAccountServiceClient.fromConfig(config, scriptName);
    const settings = await accountClient.getAccountSettings(accountId);
    if (settings.languages?.defaultCode) {
        return settings.languages.defaultCode;
    }
    if (settings.languages?.interfaceLanguage) {
        return settings.languages.interfaceLanguage;
    }
    return "xx";
}

/**
 * Problem, can't know which language :/
 */
const createGetPublication = async (binderId: string) => {
    const repoClient = await BackendRepoServiceClient.fromConfig(config, scriptName);
    const publications = await repoClient.findPublications(
        binderId,
        {},
        {
            binderSearchResultOptions: {
                maxResults: 10000,
            },
            skipPopulateVisuals: true
        }
    );
    if (publications.length === 0) {
        return null;
    }

    const accountId = publications[0].accountId;
    const preferredLanguage = await getAccountLanguage(accountId);

    return (
        date: Date,
        requiredChunkId: string
    ): Publication => {
        // Find all publications that are before Date, and contain the required chunk id
        let matchingPublications = publications.filter(
            (pub: Publication) => (
                isBefore(new Date(pub.publicationDate), date) &&
                pub.binderLog?.current?.some(log => log.uuid === requiredChunkId)
            )
        );
        if (matchingPublications.length === 0) return null;
        // See if there are any publications in the preferred language
        const matchingWithLanguage = matchingPublications.filter(
            (pub) => pub.language.iso639_1 === preferredLanguage
        );
        if (matchingWithLanguage.length > 0) {
            matchingPublications = matchingWithLanguage;
        }

        // Return the most recent publication
        return matchingPublications.reduce((pub1, pub2) => {
            if (isAfter(new Date(pub1.publicationDate), new Date(pub2.publicationDate))) {
                return pub1;
            } else {
                return pub2;
            }
        }) as Publication;
    }
}


const run = async () => {
    const checklistConfigRepo = await getChecklistConfigRepo();
    const checklistsRepo = await getChecklistsRepo();
    const options = getOptions()
    const binderIdsWithChecklists = await checklistConfigRepo.getBindersWithChecklists();

    if (options.shouldOverwrite) {
        console.log("Forcing overwrites");
    }
    console.log(`${binderIdsWithChecklists.length} binders with checklists`);

    for (let i = 0; i < binderIdsWithChecklists.length; i++) {
        const binderId = binderIdsWithChecklists[i];
        console.log(`[${i+1}/${binderIdsWithChecklists.length}] ${binderId}`);

        const getPublication = await createGetPublication(binderId);
        if (getPublication == null) continue;

        const checklists = await checklistsRepo.getChecklists(binderId, null, false);
        const configs = await checklistConfigRepo.getChecklistsConfigs([binderId], false);
        const chunkIdsInConfigsSet = new Set(configs.map(config => config.chunkId));

        for (const checklist of checklists) {
            for (const historyItem of checklist.performedHistory) {
                if (
                    historyItem.step != null &&
                    historyItem.publicationId != null &&
                    !options.shouldOverwrite
                ) continue;
                // Guess the publication that was active during the history item
                const publication = getPublication(
                    new Date(historyItem.lastPerformedDate),
                    checklist.chunkId
                );
                if (publication?.binderLog?.current == null) {
                    console.log(`!! No publication for checklist ${checklist.id} action on ${historyItem.lastPerformedDate}`);
                    continue;
                }

                // Assign the publication id to the history item
                if (historyItem.publicationId == null || options.shouldOverwrite) {
                    historyItem.publicationId = publication.id;
                    if (historyItem.step && !options.shouldOverwrite != null) continue;
                }
                // Sort the binder logs that have a checklist by position
                const binderLogs = publication.binderLog.current;
                const binderLogsWithChecklist = binderLogs.filter(
                    log => chunkIdsInConfigsSet.has(log.uuid)
                );
                const sortedBinderLogs = [...binderLogsWithChecklist].sort(
                    (a, b) => a.position - b.position
                );

                // Find the index of the checklist
                const stepIndex = sortedBinderLogs.findIndex(log => log.uuid === checklist.chunkId);
                if (stepIndex === -1) {
                    console.error(`!! chunkIndex not found for checklist ${checklist.id}, action at ${historyItem.lastPerformedDate}`);
                } else {
                    historyItem.step = stepIndex;
                }
            }
        }
        await checklistsRepo.bulkUpdateById(checklists);
    }
}

run()
    .then(() => console.log("\nGreat success! :D"))
    .catch(e => console.log("\nAnother failure :'(", e));
