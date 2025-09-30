import { log, main } from "@binders/binders-service-common/lib/util/process";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { IUserAction } from "@binders/client/src/clients/trackingservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const SCRIPT_NAME = "remove-user-action-duplicates";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
const repository = new ElasticUserActionsRepository(config, logger);

async function findDuplicates(): Promise<string> {
    return repository.withClient(async client => {

        const response = await client.search({
            index: "useractions",
            size: 0,
            body: {
                aggs: {
                    duplicateIds: {
                        terms: {
                            field: "id.keyword",
                            size: 10000,
                            min_doc_count: 2
                        }
                    }
                }
            }
        });

        const duplicateIds = response.body.aggregations?.duplicateIds.buckets.map(
            (bucket: { key: string }) => bucket.key
        );

        return duplicateIds;
    })
}

async function getUserActionsById(id: string) {
    return repository.withClient(async client => {

        const response = await client.search({
            index: "useractions",
            body: {
                query: {
                    term: {
                        "_id": id
                    }
                }
            }
        });
        return response.body.hits.hits
    })

}
interface ItemToDelete {
    id: string
    index: string
}

async function processDuplicate(duplicatectedId: string): Promise<ItemToDelete[]> {
    const hits = await getUserActionsById(duplicatectedId)
    const uniqueActions = new Map<string, IUserAction>();
    const itemsToDelete = []
    for (const hit of hits) {
        const userAction = hit["_source"] as unknown as IUserAction
        const key = `${userAction.id}-${userAction.userActionType}-${userAction.accountId}-${userAction.start}`
        if (uniqueActions.has(key)) {
            // cantidate for deletion
            itemsToDelete.push({ id: userAction.id, index: hit["_index"] })
        } else {
            uniqueActions.set(key, userAction)
        }
    }
    return itemsToDelete
}

async function deleteItems(items: ItemToDelete[]) {
    if (items.length === 0) {
        log("Nothing to delete!")
        process.exit(0)
    }
    const body = items.map(item => ({ delete: { _index: item.index, _id: item.id } }))
    return repository.withClient(async client => {
        const { body: bulkResponse } = await client.bulk({ refresh: true, body })
        if (bulkResponse.errors) {
            const erroredDocuments = [];
            bulkResponse.items.forEach((action: unknown) => {
                const operation = Object.keys(action)[0];
                if (action[operation].error) {
                    erroredDocuments.push({
                        status: action[operation].status,
                        error: action[operation].error,
                    });
                }
            });
            log("Error during bulk delete")
            erroredDocuments.forEach(doc => log(`Error ${doc.error}, status: ${doc.status}`))
        } else {
            log("Bulk delete successful!")
            process.exit(0)
        }
    })
}

type ScriptOptions = {
    dryRun: boolean
}

function getOptions(): ScriptOptions {
    const program = new Command()
    program
        .name(SCRIPT_NAME)
        .description("The goal of this script is to merge user action indices")
        .version("0.1.1")
        .option("-d, --dryRun", "Just discovers if there are duplicates in user actions")
    program.parse(process.argv)
    return program.opts() as ScriptOptions
}

main(async () => {
    const { dryRun } = getOptions()
    const duplicateIds = await findDuplicates()
    const itemsToDelete = []
    for (const duplicateId of duplicateIds) {
        const toDelete = await processDuplicate(duplicateId)
        itemsToDelete.push(...toDelete)
    }

    if (!dryRun) {
        log(`There are ${itemsToDelete.length} items to delete`)
        await deleteItems(itemsToDelete)
    }

    if (itemsToDelete.length > 0) {
        log("There are some items to delete!")
        itemsToDelete.forEach(item => {
            log(`Document with id: ${item.id} from index ${item.index} should be deleted`)
        })
        process.exit(1)
    } else {
        log("No duplicates found.")
        log("All done!")
        process.exit(0)
    }
})