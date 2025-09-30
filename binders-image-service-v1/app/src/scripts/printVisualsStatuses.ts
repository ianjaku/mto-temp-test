/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import { VisualStatus } from "@binders/client/src/clients/imageservice/v1/contract";
import { isVideo } from "../api/model";

const visualStatuses = Object.values(VisualStatus);

function isValidVisualStatus(status: string): status is VisualStatus {
    return visualStatuses.includes(status as VisualStatus);
}

function getStatus(): VisualStatus {
    const inputStatus = process.argv[2];
    if (inputStatus && isValidVisualStatus(inputStatus)) {
        return inputStatus;
    }
    return VisualStatus.ERROR;
}

/**
* List how many visuals are in each status
*/
const listVisualsInStatus = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const loginOption = getMongoLogin("image_service");
    const imageCollectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const repoFactory = new MongoBinderVisualRepositoryFactory(imageCollectionConfig, logger);
    const repo = repoFactory.build(logger);
    const status = getStatus()
    console.log(`Start looking for visuals in status: ${status}`)
    const visuals = await repo.findVisuals({ status })
    for (const visual of visuals) {
        if (isVideo(visual)) {
            console.log(`Id: ${visual.id.value()}, binder: ${visual.binderId}`)
        }
    }
}

listVisualsInStatus()
    .then(() => {
        console.log("Finished!");
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    });
