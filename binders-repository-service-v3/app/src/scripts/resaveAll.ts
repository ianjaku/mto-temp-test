/* eslint-disable no-console */
import { BindersRepository, ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticPublicationsRepository, PublicationRepository } from "../repositoryservice/repositories/publicationrepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getOptions = () => {
    if (process.argv.length < 3) {
        console.error(`Usage: node ${__filename} <"binders" | "publications"> <ACCOUNT_ID?>`);
        process.exit(1);
    }
    const itemType = process.argv[2];
    const accountId = process.argv.length > 3 && process.argv[3];
    if (!["binders", "binder", "publications", "publication"].includes(itemType)) {
        console.error(`Unknown item type provided: ${itemType}`);
        process.exit(1);
    }
    if (!accountId) {
        console.log(`Info: to restrict to 1 account, use node ${__filename} <"binders" | "publications"> <ACCOUNT_ID>`);
    }
    return {
        isPublications: process.argv[2].startsWith("publication"),
        accountId,
    };
};

const getBinderRepository = () => {
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
};

const getPublicationRepository = () => {
    return new ElasticPublicationsRepository(config, logger, queryBuilderHelper);
};

const getQuery = (indexName, accountId?) => {
    const body = accountId ?
        ({ query: { term: { accountId } } }) :
        ({ query: { match_all: {} } });
    return {
        index: indexName,
        body
    };
};
const itemFromESHit = (esHit) => {
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

const resavePublications = (repo: PublicationRepository) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await Promise.all(batch.map(publication => repo.save(publication)));
        process.stdout.write(batch.map(i => i.id).join());
    };
};

const resaveBinders = (repo: BindersRepository) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await Promise.all(batch.map(binder => repo.updateBinder(binder)));
        process.stdout.write(batch.map(i => i.id).join());
    };
};

const doIt = async () => {
    const { isPublications, accountId } = getOptions();
    if (isPublications) {
        const repo = await getPublicationRepository();
        const query = getQuery(repo.getIndexName(), accountId);
        await repo.runScroll(query, 100, 150, resavePublications(await getPublicationRepository()));
        return;
    }
    const repo = await getBinderRepository();
    const query = getQuery(repo.getIndexName(), accountId);
    await repo.runScroll(query, 100, 150, resaveBinders(repo));
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });