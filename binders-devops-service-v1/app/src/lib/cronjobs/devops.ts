import {
    ICronjobDefinition,
    buildCronJob,
    dailyCronSchedule,
    everyNHoursSchedule,
    monthlyCronSchedule
} from "../../actions/k8s/cronjob";
import { createJob, getRecentImageTag } from ".";
import { PRODUCTION_NAMESPACE } from "../bindersenvironment";
import { createSaveLaunchDarklyFlagsJob } from "./devops/saveFlagsInRedis";
import { dumpAndRunKubeCtl } from "../k8s";
import { getDevopsDockerImageTag } from "../../actions/docker/build";
import log from "../logging";
import { syncTlsSecretWithAws } from "./devops/syncTlsSecretWithAws";


const createDockerRegistryCleanup = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "docker-registry-maintenance",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "cleanup",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/aks/pruneImagesFromRegistry.js"
            ],
            mountProductionConfig: true
        }],
        schedule: dailyCronSchedule(16, 46),
        concurrencyPolicy: "Replace",
    };
    log("Creating docker registry maintenance job");
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "docker-registry-maintenance", false);
}

const createElasticJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const hourInterval = 8
    const minutes = 20
    const elasticBackupDefinition: ICronjobDefinition = {
        branch,
        name: "elastic-binders-backup-azure",
        namespace: PRODUCTION_NAMESPACE,
        schedule: everyNHoursSchedule(hourInterval, 1, minutes),
        concurrencyPolicy: "Replace",
        containers: [{
            name: "backup",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/backup/elasticAzure.js",
                "-c",
                "binders"
            ],
            mountProductionConfig: true
        }]
    };
    log("Creating elastic backup job");
    const job = buildCronJob(elasticBackupDefinition);
    await dumpAndRunKubeCtl(job, "elastic-backup", false);
};

const createMongoJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const hourInterval = 8
    const mongoBackupDefinition: ICronjobDefinition = {
        branch,
        name: "mongo-binders-backup",
        namespace: PRODUCTION_NAMESPACE,
        schedule: everyNHoursSchedule(hourInterval, 1),
        concurrencyPolicy: "Replace",
        containers: [{
            name: "backup",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/backup/mongo.js"
            ],
            mountProductionConfig: true
        }]
    };
    log("Creating mongo backup job");
    const job = buildCronJob(mongoBackupDefinition);
    await dumpAndRunKubeCtl(job, "mongo-backup", false);
};

const createMongoRestoreJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDefinition: ICronjobDefinition = {
        branch,
        name: "validate-mongo-restore",
        namespace: PRODUCTION_NAMESPACE,
        concurrencyPolicy: "Replace",
        schedule: dailyCronSchedule(3, 3),
        backoffLimit: 0,
        activeDeadlineSeconds: 18000,
        shareProcessNamespace: true,
        containers: [{
            name: "mongo",
            image: "mongo:6.0",
            imagePullPolicy: "IfNotPresent",
            resources: {
                requests:{
                    memory: "21Gi",
                },
                limits: {
                    memory: "32Gi"
                }
            }
        }, {
            name: "devops",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            mountProductionConfig: true,
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/backup/validateLatestMongoRestore.js"
            ]
        }]
    }
    await createJob(jobDefinition, "validate-mongo-restore");
}

const createAzureValidateElasticRestoreJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const elasticImage = "elasticsearch:7.17.25";
    const pluginVolume = "volume-plugins";
    const pluginVolumeMountpathCopy = "/usr/share/elasticsearch/plugins_copy";
    const pluginVolumeMountpath = "/usr/share/elasticsearch/plugins";

    const keystoreVolume = "keystore"
    const snapshotSecretVolume = "keystore-elastic-config-secret"
    const snapshotSecret = "snapshot-secret-restore"
    const jobDefinition: ICronjobDefinition = {
        branch,
        name: "validate-elastic-restore",
        namespace: PRODUCTION_NAMESPACE,
        concurrencyPolicy: "Replace",
        restartPolicy: "Never",
        activeDeadlineSeconds: 1800,
        backoffLimit: 0,
        schedule: dailyCronSchedule(4, 4),
        shareProcessNamespace: true,
        containers: [{
            name: "elastic",
            image: elasticImage,
            imagePullPolicy: "IfNotPresent",
            volumeMounts: [
                {
                    name: pluginVolume,
                    mountPath: pluginVolumeMountpath
                },
                {
                    name: keystoreVolume,
                    mountPath: "/usr/share/elasticsearch/config/elasticsearch.keystore",
                    subPath: "elasticsearch.keystore"
                }
            ],
            resources: {
                limits: {
                    memory: "5Gi"
                },
                requests: {
                    memory: "2Gi"
                }
            },
            command: ["/bin/sh", "-c"],
            args: ["chroot --userspec=1000 / /usr/share/elasticsearch/bin/elasticsearch -E discovery.type=single-node; exit 0"]
        }, {
            name: "devops",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/backup/validateLatestElasticRestore.js"
            ],
            resources: {
                limits: {
                    memory: "500Mi"
                },
                requests: {
                    memory: "500Mi"
                }
            },
            mountProductionConfig: true
        }],
        initContainers: [
            {
                name: "configure-sysctl",
                image: elasticImage,
                imagePullPolicy: "IfNotPresent",
                command: ["sysctl", "-w", "vm.max_map_count=262144"],
                securityContext: {
                    runAsUser: 0,
                    privileged: true
                }
            },
            {
                name: "plugins",
                image: elasticImage,
                imagePullPolicy: "IfNotPresent",
                command: [
                    "sh",
                    "-c",
                    "bin/elasticsearch-plugin install --batch repository-azure && cp -r /usr/share/elasticsearch/plugins/* /usr/share/elasticsearch/plugins_copy"
                ],
                volumeMounts: [{
                    name: pluginVolume,
                    mountPath: pluginVolumeMountpathCopy
                }]
            },
            {
                name: "keystore",
                image: elasticImage,
                imagePullPolicy: "IfNotPresent",
                command: [
                    "sh",
                    "-c",
                    `#!/usr/bin/env bash
                set -euo pipefail
                elasticsearch-keystore create
                for i in /tmp/keystoreSecrets/*/*; do
                  key=$(basename $i)
                  echo "Adding file $i to keystore key $key"
                  elasticsearch-keystore add-file "$key" "$i"
                done
                cp -a /usr/share/elasticsearch/config/elasticsearch.keystore /tmp/keystore/`
                ],
                volumeMounts: [
                    {
                        name: keystoreVolume,
                        mountPath: "/tmp/keystore"
                    },
                    {
                        name: snapshotSecretVolume,
                        mountPath: "/tmp/keystoreSecrets/elastic-config-secret"
                    }
                ]
            }],
        volumes: [
            {
                name: pluginVolume,
                emptyDir: {}
            },
            {
                name: keystoreVolume,
                emptyDir: {}
            },
            {
                name: snapshotSecretVolume,
                secret: {
                    secretName: snapshotSecret
                }
            }
        ]
    };
    await createJob(jobDefinition, "validate-elastic-restore");
}

const createNodeCertificationChecker = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "check-expiry-date-of-node-certificate",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "node-certificate-expiry-checker",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/k8s/checkNodeCerts.js",
                "-n",
                "binder-prod-cluster"
            ],
            mountProductionConfig: true,
        }],
        schedule: monthlyCronSchedule(10),
        concurrencyPolicy: "Replace"

    }
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "empty-domainCollectionId-checker", false);
}

const createAzureAppRotationSecretsChecker = async (activeServiceTags: Record<string, string>, branch: string) => {
    const jobDef: ICronjobDefinition = {
        branch,
        name: "azure-app-rotation-secret",
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "azure-app-rotation-secret",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/azure/rotateSecrets.js"
            ],
            mountProductionConfig: true,
        }],
        schedule: monthlyCronSchedule(10),
        concurrencyPolicy: "Replace"

    }
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, "empty-domainCollectionId-checker", false);
}

const createSyncPipelineToPosthogJob = async (activeServiceTags: Record<string, string>, branch: string) => {
    const name = "sync-pipeline-to-posthog";
    const jobDef: ICronjobDefinition = {
        branch,
        name,
        namespace: PRODUCTION_NAMESPACE,
        containers: [{
            name: "main",
            image: getDevopsDockerImageTag(activeServiceTags),
            imagePullPolicy: "Always",
            command: [
                "yarn",
                "workspace",
                "@binders/devops-v1",
                "node",
                "dist/src/scripts/bitbucket/publishPipelineToPosthog.js",
                "--interval",
                "2"
            ],
            mountProductionConfig: true,
        }],
        schedule: everyNHoursSchedule(2, 1),
        concurrencyPolicy: "Replace"

    }
    const job = buildCronJob(jobDef);
    await dumpAndRunKubeCtl(job, name, false);
}





export async function createDevopsCronjobs(branch: string): Promise<void> {
    const tag = await getRecentImageTag("devops", PRODUCTION_NAMESPACE)
    const tags = {
        "devops-v1-service": tag
    }
    await createElasticJob(tags, branch);
    await createMongoJob(tags, branch);
    await createDockerRegistryCleanup(tags, branch)
    await createAzureAppRotationSecretsChecker(tags, branch)
    await createAzureValidateElasticRestoreJob(tags, branch)
    await createMongoRestoreJob(tags, branch)
    await createNodeCertificationChecker(tags, branch)
    await createSaveLaunchDarklyFlagsJob(tags, branch)
    await syncTlsSecretWithAws(tags, branch, PRODUCTION_NAMESPACE, "production")
    await createSyncPipelineToPosthogJob(tags, branch)
}



