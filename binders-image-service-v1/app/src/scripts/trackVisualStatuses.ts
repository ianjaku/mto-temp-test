/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    createGauge,
    createRegistry,
    getMetricName,
    sendMetricsToPushgateway,
} from "@binders/binders-service-common/lib/monitoring/prometheus";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import { VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import mongoose from "mongoose";
import { subMinutes } from "date-fns";

const createVisualStatusGauge = () => {
    return createGauge(
        getMetricName("visuals_status_total"),
        "Number of visuals in mongo, grouped by their status. (>10 minute delay after creation)",
        ["status"]
    );
}

/**
* Counts how many visuals are in each status, and sends them to prometheus
*/
const trackVisualStatuses = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const loginOption = getMongoLogin("image_service");
    const imageCollectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const repoFactory = new MongoBinderVisualRepositoryFactory(imageCollectionConfig, logger);
    const repo = repoFactory.build(logger);
    const visualStatuses = Object.values(VisualStatus);

    const visualStatusTotal = createVisualStatusGauge();
    const register = createRegistry()
    register.registerMetric(visualStatusTotal)
    for (const status of visualStatuses) {
        const tenMinutesAgo = subMinutes(new Date(), 10);
        const count = await repo.countVisuals({ status, created: mongoose.trusted({ $lte: tenMinutesAgo }) });
        console.log("Count of", status, "visuals:", count);
        visualStatusTotal.set({ status }, count);
    }
    await sendMetricsToPushgateway(config, "track-visual-statuses", register)
}
trackVisualStatuses()
    .then(() => {
        console.log("Finished!");
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    });
