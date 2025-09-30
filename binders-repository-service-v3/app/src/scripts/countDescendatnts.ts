/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const doIt = async () => {
    const collectionId = process.argv[2]
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    const collectionRepo = new ElasticCollectionsRepository(
        config,
        logger,
        queryBuilderHelper
    );
    const descendatsMap = await collectionRepo.buildDescendantsMap(collectionId, false)
    const descendants = Object.keys(descendatsMap).reduce((acc, lvl) => [...acc, ...descendatsMap[lvl]], [])
    console.log("\n\n\n Total number", descendants.length)
    console.log("\n\n\n Document number", descendants.filter(el => el.kind === "document").length)
}


doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.error(error);
        process.exit(1);
    });