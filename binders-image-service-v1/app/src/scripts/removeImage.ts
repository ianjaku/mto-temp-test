/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import { VisualIdentifier } from "../api/model";
import { flatten } from "ramda";

const SCRIPT_NAME = "remove-image"
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

async function getBinderVisualRepository() {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    return new MongoBinderVisualRepositoryFactory(collectionConfig, logger).build(logger);
}

async function removeImageFromMongo(binderId: string, imageId: string): Promise<void> {
    const binderVisualRepository = await getBinderVisualRepository()
    return binderVisualRepository.deleteVisual(binderId, VisualIdentifier.parse(imageId))
}

async function checkIfBinderContainsImage(repository: BinderRepositoryServiceClient, binderId: string, imageId: string): Promise<boolean> {
    const binder = await repository.getBinder(binderId)
    const visuals = flatten(binder.modules.images.chunked[0].chunks)
    return !!visuals.find(({ id }) => imageId === id)
}

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <BINDERID> <IMAGEID>`);
        process.exit(1);
    }
    return {
        binderId: process.argv[2],
        imageId: process.argv[3]
    }
}

const doIt = async () => {
    const { binderId, imageId } = getOptions()
    const bindersRepository = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    if (await checkIfBinderContainsImage(bindersRepository, binderId, imageId)) {
        throw new Error(`Image ${imageId} is still in use in binder ${binderId}`)
    }
    await removeImageFromMongo(binderId, imageId)
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