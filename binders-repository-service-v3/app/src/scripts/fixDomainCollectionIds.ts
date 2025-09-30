/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { ElasticMigrator } from "../migrations/migration";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <DOMAIN_COLLECTION_TO_UPDATE> <NEW_DOMAIN_COLLECTION>`);
        process.exit(1);
    }
    return {
        domainCollectionIdToChange: process.argv[2],
        newDomainCollectionId: process.argv[3]
    };
};

const { domainCollectionIdToChange, newDomainCollectionId } = getOptions();

const publicationRepository = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const publicationIndexName = publicationRepository.getIndexName()
const publicationMigration = new ElasticMigrator(publicationRepository, publicationRepository);
const publicationsQuery = {
    index: publicationIndexName,
    body: {
        query: {
            term: {
                domainCollectionId: domainCollectionIdToChange
            }
        }
    }
};

const collectionRepository = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const collectionIndexName = collectionRepository.getIndexName();
const collectionMigration = new ElasticMigrator(collectionRepository, collectionRepository);
const collectionsQuery = {
    index: collectionIndexName,
    body: {
        query: {
            term: {
                domainCollectionId: domainCollectionIdToChange
            }
        }
    }
};

async function migratePublications() {
    await publicationMigration.migrate(publicationsQuery, async (esDoc) => {
        const document = esDoc["_source"];
        document.domainCollectionId = newDomainCollectionId;
        return {
            data: document,
            id: esDoc["_id"]
        };
    }, publicationIndexName, true);
}

async function migrateCollections() {
    await collectionMigration.migrate(collectionsQuery, async (esDoc) => {
        const document = esDoc["_source"];
        document.domainCollectionId = newDomainCollectionId;
        return {
            data: document,
            id: esDoc["_id"]
        };
    }, collectionIndexName, true);
}

console.log(`Changing domainCollection from ${domainCollectionIdToChange} to ${newDomainCollectionId}`);
migratePublications().then(() => {
    console.log("done with publications, migrating collections");
    migrateCollections()
        .then(() => {
            console.log("all done");
        });
});
