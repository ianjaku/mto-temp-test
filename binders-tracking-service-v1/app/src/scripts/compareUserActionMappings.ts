/* eslint-disable no-console */
import { MappingFileName, getMapping } from "../essetup/mappings/ensureMapping";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const CATEGORY = "property-in-all-indices"
const logger = LoggerBuilder.fromConfig(config, CATEGORY);

async function compareMappings(client, codebaseMappings) {
    const alias = "useractions";

    const compareMappings = (currentProps, codebaseProps, indexPath, omitData = false) => {
        // Compare properties in codebaseMappings with currentMappings
        for (const field in codebaseProps) {
            if (omitData && field == "data") {
                continue
            }
            if (!currentProps[field] || JSON.stringify(currentProps[field]) !== JSON.stringify(codebaseProps[field])) {
                console.log(`Index: ${indexPath}, Field: ${field}, Current: ${JSON.stringify(currentProps[field])}, Expected: ${JSON.stringify(codebaseProps[field])}`);
            }
        }

        // Check for extra fields in currentMappings
        for (const field in currentProps) {
            if (omitData && field == "data") {
                continue
            }
            if (!codebaseProps[field]) {
                console.log(`Index: ${indexPath}, Extra Field in Current Mapping: ${field}, type ${currentProps[field].type}`);
            }
        }
    };

    try {
        const { body: currentMappings } = await client.indices.getMapping({ index: alias });
        for (const index in currentMappings) {
            console.log(`Processing mapping for index ${index}`)
            const currentProperties = getProperties(currentMappings[index])
            const codebaseProperties = codebaseMappings.properties;

            compareMappings(currentProperties, codebaseProperties, index, true);

            if (currentProperties.data && codebaseProperties.data) {
                const currentDataProps = currentProperties.data.properties;
                const codebaseDataProps = codebaseProperties.data.properties;

                compareMappings(currentDataProps, codebaseDataProps, `${index}.data`);
            }
        }
    } catch (error) {
        logger.error(`Error occurred: ${error}`, CATEGORY);
    }
}

function getProperties(mapping) {
    return mapping.mappings?.properties
}

async function main() {
    const repository = new ElasticUserActionsRepository(config, logger);
    const codebaseMapping = getMapping(MappingFileName.USERACTION)
    await repository.withClient(async client => {
        await compareMappings(client, codebaseMapping)
    })
}


main()
    .then(() => {
        logger.info("All done!", CATEGORY);
        process.exit(0);
    })
    .catch((error) => {
        logger.error(error, CATEGORY);
        process.exit(1);
    })
