import { MongoRepositoryDocument, getFactories } from "../factoryRegistry";
import {
    createMongoIndexGauges,
    resetMongoGauges,
    updateMongoIndexGauges
} from "../../monitoring/prometheus/mongoIndexMetrics";
import { BindersServiceClient } from "@binders/client/lib/clients/client";
import { MongoRepositoryFactory } from "../repository";
import { getBuildInfo } from "../../sharedroutes/buildinfo";
import { isDev } from "@binders/client/lib/util/environment";
import { minutesToMilliseconds } from "date-fns";


async function checkIndices(factories: MongoRepositoryFactory<MongoRepositoryDocument>[], isLatest: boolean): Promise<void> {
    for (const factory of factories) {
        if (isLatest) {
            const diff = await factory.diffIndexes();
            updateMongoIndexGauges(factory.collection.name, diff);
        } else {
            resetMongoGauges(factory.collection.name);
        }
    }
}

const MONGO_INDEX_CHECK_INTERVAL_MS = minutesToMilliseconds(1);

export async function setupMongoIndexMonitor(client: BindersServiceClient): Promise<void> {
    const shouldCheck = async () => {
        if (isDev()) {
            return true;
        }
        const remoteBuildInfo = await client.statusBuildInfo();
        const localBuildInfo = await getBuildInfo();
        if (localBuildInfo === "corruptOrEmpty" || localBuildInfo === "noFile") {
            return false;
        }
        return remoteBuildInfo.branch === localBuildInfo.info.branch &&
            remoteBuildInfo.commit === localBuildInfo.info.commit;
    };
    const runIndicesCheck = async () => {
        try {
            const isLatest = await shouldCheck();
            await checkIndices(getFactories(), isLatest);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to run indices check with:", e);
        }
    };
    createMongoIndexGauges();
    setInterval(runIndicesCheck, MONGO_INDEX_CHECK_INTERVAL_MS);
}