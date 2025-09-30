import {
    ICronjobDefinition,
    buildCronJob,
    everyNMinutesSchedule
} from  "../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getNotificationServiceTag } from "../../actions/docker/build";
import { getRecentImageTag } from ".";

const createRunScheduledEventsJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "run-scheduled-events",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "run-scheduled-events",
            image: getNotificationServiceTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/notification-v1",
                "node",
                "dist/src/scripts/runScheduledEvents.js"
            ],
            mountProductionConfig: true
        }],
        schedule: everyNMinutesSchedule(5),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "run-scheduled-events", false);
}

export async function createNotificationCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("notification", PRODUCTION_NAMESPACE)
    const tags = {
        "notification-v1-service": tag
    }
    await createRunScheduledEventsJob(tags, branch);
}