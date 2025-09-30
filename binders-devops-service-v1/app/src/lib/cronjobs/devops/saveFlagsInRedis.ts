import { ICronjobDefinition, buildCronJob, everyNMinutesSchedule } from "../../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../../bindersenvironment";
import { dumpAndRunKubeCtl } from "../../k8s";
import { getDevopsDockerImageTag } from "../../../actions/docker/build";
import log from "../../logging";

export const createSaveLaunchDarklyFlagsJob = async (activeServiceTags: Record<string, string>, branch: string, namespace = PRODUCTION_NAMESPACE): Promise<void> => {
    const name = "save-launch-darkly-in-redis"
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace,
        containers: [{
            name: "cache-flags",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/launchdarkly/saveFlagsInRedis.js"
            ],
            mountProductionConfig: true
        }],
        schedule: everyNMinutesSchedule(5),
        concurrencyPolicy: "Replace",
    };
    log(`Creating ${name} job`);
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}