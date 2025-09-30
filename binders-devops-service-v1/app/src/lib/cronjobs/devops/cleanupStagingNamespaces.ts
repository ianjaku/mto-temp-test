import { ICronjobDefinition, buildCronJob, everyNHoursSchedule } from "../../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../../bindersenvironment";
import { dumpAndRunKubeCtl } from "../../k8s";
import { getDevopsDockerImageTag } from "../../../actions/docker/build";
import log from "../../logging";

export const cleanupStagingNamespaces = async (activeServiceTags: Record<string, string>, branch: string, namespace = PRODUCTION_NAMESPACE): Promise<void> => {
    const name = "cleanup-staging-namespaces"
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace,
        containers: [{
            name: "clean-stg-ns",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "tsx",
                "src/scripts/bindersenv/cleanupPipelineNamespaces",
            ],
            mountProductionConfig: true,
            runOnStaging: true
        }],
        schedule: everyNHoursSchedule(2),
        concurrencyPolicy: "Replace",
    };
    log(`Creating ${name} job`);
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}