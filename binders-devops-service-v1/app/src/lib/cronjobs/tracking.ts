import {
    ICronjobDefinition,
    buildCronJob,
    dailyCronSchedule,
    everyNMinutesSchedule
} from  "../../actions/k8s/cronjob";
import { createJob, getRecentImageTag } from ".";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getTrackingServiceImageTag } from "../../actions/docker/build";



const createUserActionAggreationJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobInterval = 15;
    // get latest image
    const jobDefinition: ICronjobDefinition = {
        branch,
        name: "user-action-aggregation",
        namespace: PRODUCTION_NAMESPACE,
        activeDeadlineSeconds: jobInterval * 60,
        concurrencyPolicy: "Replace",
        schedule: everyNMinutesSchedule(jobInterval, 2),
        containers: [{
            name: "aggregor",
            image: getTrackingServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/tracking-v1",
                "node",
                "dist/src/scripts/aggregateUserEvents.js"
            ],
            mountProductionConfig: true
        }]
    };
    await createJob(jobDefinition, "aggregate-events");
}

const createEventsRotationJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "events-collection-rotation",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "rotate",
            image: getTrackingServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/tracking-v1",
                "node",
                "dist/src/scripts/maybeRotateTrackingCollection.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(2, 43),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "events-collection-rotation", false);
}

const createRecalculateLastUsageInformation = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "recalculate-last-usage-information",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "rotate",
            image: getTrackingServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/tracking-v1",
                "node",
                "dist/src/scripts/recalculateLastUsageInformation.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(2, 50),
        concurrencyPolicy: "Replace",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "recalculate-last-usage-information", false);
}

export async function createTrackingCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("tracking", PRODUCTION_NAMESPACE)
    const tags = {
        "tracking-v1-service": tag
    }
    await createEventsRotationJob(tags, branch);
    await createUserActionAggreationJob(tags, branch);
    await createRecalculateLastUsageInformation(tags, branch);
}