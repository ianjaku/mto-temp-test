/* eslint-disable no-console */
import * as elastic from "@elastic/elasticsearch";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <BINDER_ID>`);
        process.exit(1);
    }
    return {
        binderId: process.argv[2]
    };
};
const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const bindersRepository = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
const client = new elastic.Client(Object.assign({}, elasticConfig.get()));

const options = getOptions();

client.delete({
    index: bindersRepository.getIndexName(),
    id: options.binderId
})
    .then(() => {
        console.log("Successfully deleted document.");
        process.exit(0);
    }, error => {
        console.log("!!! Failed to delete document");
        console.log(error);
        process.exit(1);
    });