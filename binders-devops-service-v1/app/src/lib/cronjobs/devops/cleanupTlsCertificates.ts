import { ICronjobDefinition, buildCronJob, dailyCronSchedule } from "../../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../../bindersenvironment";
import { dumpAndRunKubeCtl } from "../../k8s";
import { getDevopsDockerImageTag } from "../../../actions/docker/build";
import log from "../../logging";

export const cleanupAzureTlsCertificates = async (activeServiceTags: Record<string, string>, branch: string, namespace = PRODUCTION_NAMESPACE): Promise<void> => {
    const name = "cleanup-azure-tls-certificates"
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace,
        containers: [{
            name: "clean-tls",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "tsx",
                "src/scripts/tls/appGatewayCertCleaner",
            ],
            mountProductionConfig: true,
            runOnStaging: true
        }],
        schedule: dailyCronSchedule(7,10),
        concurrencyPolicy: "Replace",
    };
    log(`Creating ${name} job`);
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}