import { ICronjobDefinition, buildCronJob, dailyCronSchedule, everyNHoursSchedule } from "../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { dumpAndRunKubeCtl } from "../k8s";
import { getBindersServiceImageTag } from "../../actions/docker/build";
import { getRecentImageTag } from ".";

const createBinPurger = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "purge-recycle-bins",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "purge-recycle-bin",
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/purgeRecycleBins.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(4, 17),
        concurrencyPolicy: "Replace"
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "purge-recycle-bin", false)
}

const createCheckCorruptBinders = async (activeServiceTags: Record<string, string>, branch: string) => {
    const scriptName = "check-corrupt-binders";
    const jobDef: ICronjobDefinition = {
        branch,
        name: scriptName,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: scriptName,
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/fixCorruptBinders/index.js",
                "cron"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(5, 12),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, scriptName, false);
}

const createCheckAncestorIdsCronjob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const scriptName = "populate-ancestor-ids";
    const jobDef: ICronjobDefinition = {
        branch,
        name: scriptName,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: scriptName,
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/populateAncestorIds.js",
                "--quick",
                "--errorOnMissingAncestorIds"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(4, 0),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, scriptName, false);
}

const createCalculateBindersStatusesCronjob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const scriptName = "calculate-binders-statuses";
    const jobDef: ICronjobDefinition = {
        branch,
        name: scriptName,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: scriptName,
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/calculateBindersStatuses/index.js",
            ],
            mountProductionConfig: true
        }],
        schedule: everyNHoursSchedule(12),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, scriptName, false);
}

const createSendFeedbackDigestJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const scriptName = "send-feedback-digest";
    const jobDef: ICronjobDefinition = {
        branch,
        name: scriptName,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: scriptName,
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/sendFeedbackDigest/index.js",
                "1" // Note: 1 is "days ago", indicating which day in the past we use for the digest period. This should stay in sync with the cronjob schedule
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(8, 10),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, scriptName, false);
}

const createUpdateCachedMTLanguagesCronJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const scriptName = "update-cached-mt-languages";
    const jobDef: ICronjobDefinition = {
        branch,
        name: scriptName,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: scriptName,
            image: getBindersServiceImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/binders-v3",
                "node",
                "dist/src/scripts/updateCachedMTLanguages.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(6, 10),
        concurrencyPolicy: "Forbid",
    };
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, scriptName, false);
}

export async function createBindersCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("binders", PRODUCTION_NAMESPACE)
    const tags = {
        "binders-v3-service": tag
    }
    await createBinPurger(tags, branch);
    await createCheckCorruptBinders(tags, branch);
    await createCheckAncestorIdsCronjob(tags, branch);
    await createCalculateBindersStatusesCronjob(tags, branch);
    await createSendFeedbackDigestJob(tags, branch);
    await createUpdateCachedMTLanguagesCronJob(tags, branch);
}