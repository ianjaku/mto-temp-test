import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);


const processBatch = (repo) => {
    return async (batch) => {
        let builder = new BulkBuilder([]);
        batch.map(hit => {
            const userAction = hit._source;
            if (!userAction.userId && userAction.data.userId) {
                logger.info("Found missing user Id", "fix-missing-userid-in-user-actions", hit);
                builder = builder.addUpdate(hit._index, hit._id, { userId: userAction.data.userId });
            }
        });
        if (builder.build().actions.length > 0) {
            await repo.runBulk(builder, { ignoreDuplicates: true });
        }
    }
}

const doIt = async () => {
    const repo = new ElasticUserActionsRepository(config, logger);
    const query = {
        body: { query: { match_all: {} } },
        index: "useractions"
    };
    const scrollAge = 3600;
    const batchSize = 1000;
    await repo.runScroll(query, scrollAge, batchSize, processBatch(repo))
};

doIt()
    .then(
        () => {
            logger.info("All done!", "fix-missing-userid-in-user-actions");
            process.exit(0);
        },
        err => {
            logger.error(err, "fix-missing-userid-in-user-actions");
            process.exit(1);
        }
    )
