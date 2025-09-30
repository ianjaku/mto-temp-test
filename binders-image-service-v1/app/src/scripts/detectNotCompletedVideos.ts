/* eslint-disable no-console */
import * as fs from "fs";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { VideoFormatType, VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Visual, isVideo } from "../api/model";
import { BackendImageServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";

const config = BindersConfig.get(60);
const loginOption = getMongoLogin("image_service");
const logger = LoggerBuilder.fromConfig(config);
const transcodedFormats = [
    VideoFormatType.VIDEO_DEFAULT_HD,
    VideoFormatType.VIDEO_DEFAULT_LD,
    VideoFormatType.VIDEO_DEFAULT_SD,
    VideoFormatType.VIDEO_IPHONE_HD,
];
const oldTranscodedVideos = [
    VideoFormatType.VIDEO_WEB_DEFAULT
];
const allFormats = [];
const defaultFormat = [];
const errors = [];

function lackingTranscodedFormats(visual) {
    let returnValue = false;
    for (let i = 0; i < transcodedFormats.length; i++) {
        if (visual.formats.find(f => f.format === transcodedFormats[i]) === undefined) {
            returnValue = true;
            break;
        }
    }
    return returnValue;
}

function lackingOldTranscodedFormats(visual) {
    let oldReturnValue = false;
    for (let i = 0; i < oldTranscodedVideos.length; i++) {
        if (visual.formats.find(f => f.format === oldTranscodedVideos[i]) === undefined) {
            oldReturnValue = true;
            break;
        }
    }

    return oldReturnValue;
}

CollectionConfig.fromConfig(config, "images", loginOption)
    .lift(imageCollectionConfig => {
        const repo = new MongoBinderVisualRepositoryFactory(imageCollectionConfig, logger).build(logger);
        const doWork: (visual: Visual) => Promise<void> = visual => {
            if (!isVideo(visual)) {
                return Promise.resolve();
            }

            if (visual.status === VisualStatus.ERROR) {
                errors.push(visual.id.value());
                console.log(visual.id);
            } else if (visual.status === VisualStatus.COMPLETED && lackingTranscodedFormats(visual)) {
                allFormats.push(visual.id.value());
                console.log(visual.id)
                // so if it doesnt have all new formats we need, let's check if it has default format
                if (visual.status === VisualStatus.COMPLETED && lackingOldTranscodedFormats(visual)) {
                    defaultFormat.push(visual.id.value());
                    console.log(visual.id)
                }
            }
            return Promise.resolve();
        };

        return BackendImageServiceClient.fromConfig(config, "detect-corrupted-videos").then(() => {
            return repo.runScroll(doWork)
                .then(() => {
                    console.log("All done!");
                    const jsonFile = JSON.stringify({
                        errorsWhileTranscoding: errors,
                        lackingAllNewFormats: allFormats,
                        lackingDefaultFormat: defaultFormat
                    });
                    fs.writeFileSync("detectedCorruptedVideos.json", jsonFile);
                    process.exit(0);
                })
                .catch(error => {
                    console.error(error);
                    process.exit(1);
                });
        });
    });
