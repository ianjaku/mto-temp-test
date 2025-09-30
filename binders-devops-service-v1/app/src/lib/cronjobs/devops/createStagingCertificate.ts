import { ICronjobDefinition, buildCronJob, everyNmonth } from "../../../actions/k8s/cronjob";
import { PRODUCTION_NAMESPACE } from "../../bindersenvironment";
import { dumpAndRunKubeCtl } from "../../k8s";
import { getDevopsDockerImageTag } from "../../../actions/docker/build";
import log from "../../logging";

export const createStagingTlsCertificate = async (activeServiceTags: Record<string, string>, branch: string, namespace = PRODUCTION_NAMESPACE): Promise<void> => {
    const name = "create-staging-tls-certificate"
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace,
        containers: [{
            name: "cert",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/letsencrypt/createCertManager.js",
                "-r",
                "-n",
                "default",
                "-e",
                "staging"
            ],
            mountProductionConfig: true
        }],
        schedule: everyNmonth(3),
        concurrencyPolicy: "Replace",
    };
    log(`Creating ${name} job`);
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}