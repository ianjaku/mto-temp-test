import { ICronjobDefinition, buildCronJob, monthlyCronSchedule } from "../../../actions/k8s/cronjob";
import { getProductionCluster, getStagingCluster } from "../../../actions/aks/cluster";
import { Env } from "../../environment";
import { PRODUCTION_NAMESPACE } from "../../bindersenvironment";
import { dumpAndRunKubeCtl } from "../../k8s";
import { getDevopsDockerImageTag } from "../../../actions/docker/build";
import log from "../../logging";

export const syncTlsSecretWithAws = async (activeServiceTags: Record<string, string>, branch: string, namespace = PRODUCTION_NAMESPACE, env: Env): Promise<void> => {
    const name = "sync-tls-secret-with-aws"
    const secretName = "aws-cert-sync-credentials"
    const AWS_ACCESS_KEY_ID = "AWS_ACCESS_KEY_ID"
    const AWS_SECRET_ACCESS_KEY = "AWS_SECRET_ACCESS_KEY"
    const cluster = env == "production" ? getProductionCluster() :  getStagingCluster()
    const runOnStaging = env === "staging"
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
                "tsx",
                "src/scripts/tls/syncTlsSecretWithAws",
                "-c",
                cluster,
                "-n",
                namespace,
                "-e",
                env
            ],
            mountProductionConfig: true,
            runOnStaging,
            env: [
                {
                    name: AWS_ACCESS_KEY_ID,
                    valueFrom: {
                        secretKeyRef: {
                            key: AWS_ACCESS_KEY_ID,
                            name: secretName
                        }
                    }
                },
                {
                    name: AWS_SECRET_ACCESS_KEY,
                    valueFrom: {
                        secretKeyRef: {
                            key: AWS_SECRET_ACCESS_KEY,
                            name: secretName
                        }
                    }
                }
            ]
        }],
        schedule: monthlyCronSchedule(10),
        concurrencyPolicy: "Replace",
    };
    log(`Creating ${name} job`);
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}