/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { ITunnelSpec, withTunnel } from "../../actions/k8s/tunnels";
import { NUMBER_OF_PRODUCTION_NODES, getElasticUserPassword } from "../../lib/eck";
import { getElasticClientForRestoreSnapshot, getLocalClient } from "../../actions/elastic/config";
import { getDocCountByIndexName } from "@binders/binders-service-common/lib/elasticsearch/catIndices";
import { getNewClusterPodNames } from "../../lib/bindersconfig"
import { main } from "../../lib/program"
import { sleep } from "../../lib/promises"


const getIndicesDataFromOldElastic = async (namespace: string) => {
    const localPort = 9200;
    const pod = "elastic-binders-service-0"
    const spec: ITunnelSpec = {
        pod, localPort, remotePort: 9200, namespace
    };
    let result: Record<string, unknown>
    const action = async () => {
        await sleep(3000);
        const client = getLocalClient();
        result = await getDocCountByIndexName(client);
    }
    await withTunnel(spec, action);
    return result
}

const getIndicesDateFromNewElastic = async (namespace: string) => {
    const localPort = 9200;
    const pod = getNewClusterPodNames(NUMBER_OF_PRODUCTION_NODES)[0]
    const elasticPassword = await getElasticUserPassword(namespace)
    const spec: ITunnelSpec = {
        pod, localPort, remotePort: 9200, namespace
    };
    let result: Record<string, unknown>
    const action = async () => {
        await sleep(3000);
        const client = getElasticClientForRestoreSnapshot(elasticPassword, localPort)
        result = await getDocCountByIndexName(client);
    }
    await withTunnel(spec, action);
    return result

}


const validateUserActions = (oldIndices: Record<string, unknown>, newIndices: Record<string, unknown>): string[] => {
    const errors = []
    const userActionsOldIndices = getUserActionsIndices(oldIndices)
    const userActionsNewIndices = getUserActionsIndices(newIndices)

    const oldIndicesCount = Object.keys(userActionsOldIndices).length
    const newIndicesCount = Object.keys(userActionsNewIndices).length

    if (oldIndicesCount !== newIndicesCount) {
        errors.push(`[User actions] indices count is not equal: old ${oldIndicesCount} vs new ${newIndicesCount}`)
    }

    for (const indexName in userActionsOldIndices) {
        const oldDocCount = userActionsOldIndices[indexName]
        const newDocCount = userActionsNewIndices[indexName]
        if (!newDocCount) {
            errors.push(`[User actions] index ${indexName} not exits in new cluster`)
        }
        if (oldDocCount !== newDocCount) {
            errors.push(`[User actions] document count for index ${indexName} is not equal: ${oldDocCount} vs new ${newDocCount}`)
        }
    }

    return errors;
}

const validateBindersIndex = (oldIndices: Record<string, unknown>, newIndices: Record<string, unknown>): string[] => {
    const errors = []

    const BINDERS_OLD_INDEX_NAME = "binders_binders-v2"
    const BINDERS_NEW_INDEX_NAME = "binders-binders-v3"

    if (!oldIndices[BINDERS_OLD_INDEX_NAME]) {
        errors.push("[Binders] old index name don't exits in old cluster")
    }

    if (!oldIndices[BINDERS_NEW_INDEX_NAME]) {
        errors.push("[Binders] new index(reindexed) don't exits in old cluster ")
    }

    if (!newIndices[BINDERS_NEW_INDEX_NAME]) {
        errors.push("[Binders] old index name don't exits in old cluster")
    }

    const oldIndexOldCluster = oldIndices[BINDERS_OLD_INDEX_NAME]
    const newIndexOldCluster = oldIndices[BINDERS_NEW_INDEX_NAME]
    const newIndexNewCluster = newIndices[BINDERS_NEW_INDEX_NAME]

    if (oldIndexOldCluster !== newIndexNewCluster) {
        errors.push(`[Binders] Number of documents does not match: old index old cluster ${oldIndexOldCluster} vs new index oldCluster ${newIndexOldCluster} vs new cluster ${newIndexNewCluster}`)
    }

    return errors
}

const validateCollectionIndex = (oldIndices: Record<string, unknown>, newIndices: Record<string, unknown>): string[] => {
    const errors = []

    const COLLECTIONS_OLD_INDEX_NAME = "binders_collections_v2"
    const COLLECTIONS_NEW_INDEX_NAME = "binders-collections-v3"

    if (!oldIndices[COLLECTIONS_OLD_INDEX_NAME]) {
        errors.push("[Collections] old index name don't exits in old cluster")
    }

    if (!oldIndices[COLLECTIONS_NEW_INDEX_NAME]) {
        errors.push("[Collections] new index(reindexed) don't exits in old cluster ")
    }

    if (!newIndices[COLLECTIONS_NEW_INDEX_NAME]) {
        errors.push("[Collections] old index name don't exits in old cluster")
    }

    const oldIndexOldCluster = oldIndices[COLLECTIONS_OLD_INDEX_NAME]
    const newIndexOldCluster = oldIndices[COLLECTIONS_NEW_INDEX_NAME]
    const newIndexNewCluster = newIndices[COLLECTIONS_NEW_INDEX_NAME]

    if (oldIndexOldCluster !== newIndexNewCluster) {
        errors.push(`[Collections] Number of documents does not match: old index old cluster ${oldIndexOldCluster} vs new index oldCluster ${newIndexOldCluster} vs new cluster ${newIndexNewCluster}`)
    }

    return errors
}


const validatePublicationsIndex = (oldIndices: Record<string, unknown>, newIndices: Record<string, unknown>): string[] => {
    const errors = []

    const PUBLICATION_OLD_INDEX_NAME = "publications"
    const PUBLICATION_NEW_INDEX_NAME = "publications-v2"

    if (!oldIndices[PUBLICATION_OLD_INDEX_NAME]) {
        errors.push("[Publications] old index name don't exits in old cluster")
    }

    if (!oldIndices[PUBLICATION_NEW_INDEX_NAME]) {
        errors.push("[Publications] new index(reindexed) don't exits in old cluster ")
    }

    if (!newIndices[PUBLICATION_NEW_INDEX_NAME]) {
        errors.push("[Publications] old index name don't exits in old cluster")
    }

    const oldIndexOldCluster = oldIndices[PUBLICATION_OLD_INDEX_NAME]
    const newIndexOldCluster = oldIndices[PUBLICATION_NEW_INDEX_NAME]
    const newIndexNewCluster = newIndices[PUBLICATION_NEW_INDEX_NAME]

    if (oldIndexOldCluster !== newIndexNewCluster) {
        errors.push(`[Publications] Number of documents does not match: old index old cluster ${oldIndexOldCluster} vs new index oldCluster ${newIndexOldCluster} vs new cluster ${newIndexNewCluster}`)
    }

    return errors
}


interface IValidateElasticMigration {
    namespace: string,
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespace name",
            kind: OptionType.STRING
        }
    }
    const parser = new CommandLineParser("IValidateElasticMigration", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { namespace } = (<any>parser.parse()) as IValidateElasticMigration
    return {
        namespace
    }
}


const validateMigration = (oldIndices: Record<string, unknown>, newIndices: Record<string, unknown>): string[] => {
    const binderErrors = validateBindersIndex(oldIndices, newIndices)
    const collectionErrors = validateCollectionIndex(oldIndices, newIndices)
    const publicationErrors = validatePublicationsIndex(oldIndices, newIndices)
    const userActionErrors = validateUserActions(oldIndices, newIndices)
    return [...binderErrors, ...collectionErrors, ...publicationErrors, ...userActionErrors]
}



const doIt = async () => {
    const { namespace } = getOptions()
    const oldIndices = await getIndicesDataFromOldElastic(namespace)
    const newIndices = await getIndicesDateFromNewElastic(namespace)

    const validationResult = validateMigration(oldIndices, newIndices)
    if (validationResult.length > 0) {
        validationResult.forEach(err => console.error(err))
        throw new Error("Found some issues with migration")
    } else {
        console.log("No issues :)")
    }
}

main(doIt);

function getUserActionsIndices(oldIndices: Record<string, unknown>) {
    const userActionsIndices = Object.entries(oldIndices).filter(([indexName]) => indexName.startsWith("useractions"))
    return Object.fromEntries(userActionsIndices)
}
