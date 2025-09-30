/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoVideoIndexerRepositoryFactory } from "../api/videoIndexerRepository";
import { VideoIndexerStatus } from "@binders/client/lib/clients/imageservice/v1/contract";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

async function getVideoIndexerRepo() {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "videoIndexer", loginOption);
    const factory = new MongoVideoIndexerRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

function getYesterdayDate() {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    date.setHours(23)
    date.setMinutes(59)
    return date
}

function getVideoIndexerFilter() {
    return {
        createdBefore: getYesterdayDate(),
        status: VideoIndexerStatus.processing
    }
}


const doIt = async () => {
    const videoIndexerRepository = await getVideoIndexerRepo()
    const filter = getVideoIndexerFilter()
    const videoInProcessingState = await videoIndexerRepository.findVideoIndexerResults(filter)

    let counter = 0
    for (let i = 0; i < videoInProcessingState.length; i++) {
        const record = videoInProcessingState[i]
        const { msVideoId, visualId, percentageCompleted } = record
        await videoIndexerRepository.saveVideoIndexerResult({
            msVideoId,
            visualId,
            percentageCompleted,
            status: VideoIndexerStatus.timeout
        })
        counter++
    }
    console.log(`Changed ${counter} records statuses from processing to timeout`)
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)