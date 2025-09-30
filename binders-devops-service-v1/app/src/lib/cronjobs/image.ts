import {
    ICronjobDefinition,
    buildCronJob,
    dailyCronSchedule,
    everyNMinutesSchedule,
    monthlyCronSchedule,
    weeklySchedule,
} from "../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getImageServiceImageTag } from "../../actions/docker/build";
import { getRecentImageTag } from ".";


const createSetVideoIndexerTimeoutStatusJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "reprocess-video-indexer-results",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "fixer",
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/reprocessVideoIndexerResults.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(5, 43),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "reprocess-video-indexer-results", false);
}

const createCalculateVisualStorageSize = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "calculate-visual-storage-size",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "calculate-visual-storage-size",
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/calculateStorageSize.js"
            ],
            mountProductionConfig: true
        }],
        schedule: monthlyCronSchedule(10),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "calculate-visual-storage-size", false);
}

const createSendBitmovinDigestJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "send-bitmovin-digest";
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name,
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/sendBitmovinDigest.js",
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(8, 10),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}

const createSendBitmovinTransodingTimesJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "send-bitmovin-transcoding-times";
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name,
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/bitmovinTranscodingTimes.js",
            ],
            mountProductionConfig: true
        }],
        schedule: weeklySchedule(1, 6, 10),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}

const createTrackVisualStatuses = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "track-visual-statuses";
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name,
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/trackVisualStatuses.js",
            ],
            mountProductionConfig: true
        }],
        schedule: everyNMinutesSchedule(10),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}

const createRestartStuckVideoProcessingJobs = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "restart-stuck-video-processing-jobs";
    const jobDef: ICronjobDefinition = {
        branch,
        name: name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: name,
            image: getImageServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/image-v1",
                "node",
                "dist/src/scripts/restartStuckVideoProcessingJobs.js",
            ],
            mountProductionConfig: true
        }],
        schedule: everyNMinutesSchedule(2, 1),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}

export async function createImageCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("image", PRODUCTION_NAMESPACE)
    const tags = {
        "image-v1-service": tag
    }
    await createCalculateVisualStorageSize(tags, branch);
    await createSetVideoIndexerTimeoutStatusJob(tags, branch)
    await createSendBitmovinDigestJob(tags, branch);
    await createSendBitmovinTransodingTimesJob(tags, branch);
    await createTrackVisualStatuses(tags, branch);
    await createRestartStuckVideoProcessingJobs(tags, branch);
}