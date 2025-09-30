import { ICronjobDefinition, everyNHoursSchedule, everyNMinutesSchedule } from "../../actions/k8s/cronjob";
import { createJob, getRecentImageTag } from ".";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { getUserServiceImageTag } from "../../actions/docker/build";

const createUserInviteBouncesJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDefinition: ICronjobDefinition = {
        branch,
        name: "user-invite-bounces",
        namespace: PRODUCTION_NAMESPACE,
        concurrencyPolicy: "Replace",
        activeDeadlineSeconds: 300,
        schedule: everyNMinutesSchedule(30, 7),
        containers: [{
            name: "mail-bounces",
            image: getUserServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/user-v1",
                "node",
                "dist/src/scripts/getBouncesMails.js"
            ],
            mountProductionConfig: true
        }]
    };
    await createJob(jobDefinition, "invite-bounces");
}

const createEntraIdGroupMembersSync = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDefinition: ICronjobDefinition = {
        branch,
        name: "entra-id-group-members-sync",
        namespace: PRODUCTION_NAMESPACE,
        concurrencyPolicy: "Replace",
        activeDeadlineSeconds: 300,
        schedule: everyNHoursSchedule(2, 3),
        containers: [{
            name: "entra-id-group-members-sync",
            image: getUserServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/user-v1",
                "node",
                "dist/src/scripts/syncEntraGroupMembersJob.js"
            ],
            mountProductionConfig: true
        }]
    };
    await createJob(jobDefinition, "entra-id-group-members-sync");
}

export async function createUserCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("user", PRODUCTION_NAMESPACE)
    const tags = {
        "user-v1-service": tag
    }
    await createUserInviteBouncesJob(tags, branch);
    await createEntraIdGroupMembersSync(tags, branch);
}