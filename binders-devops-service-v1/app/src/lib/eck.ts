import {
    AzureBlobStoreConfig,
    loadDevSecret,
    loadProductionSecrets,
    loadStagingSecrets
} from "./bindersconfig";
import { MINIMAL_STAGING_RESOURCE_LIMITS, STAGING_RESOURCE_LIMITS } from "./bindersdeployment";
import { createSecret, deleteSecret, getK8SSecret } from "../actions/k8s/secrets";
import { Env } from "./environment";
import { IDevConfig } from "../actions/localdev/build";
import { createKubeConfig } from "../actions/k8s-client/util";
import { createOrUpdateIngress } from "../actions/k8s-client/ingress";
import { dumpFile } from "./fs";
import { getStorageClass } from "../actions/aks/storageclass";
import { runKubeCtlFile } from "./k8s";
import { sleep } from "./promises";
import { yamlStringify } from "./yaml";

const READ_WRITE_ONCE = "ReadWriteOnce"
const NODE_SET_NAME = "master"
const LOCAL_DEV_STORAGE_CLASS_NAME = "standard"
const KIBANA_DEFAULT_PORT = 5601
const KIBANA_BINDERS_NAME = "kibana-binders"

export const ELASTIC_CLUSTER_NAME = "binders"
export const ELASTIC_USER_SECRET_NAME = `${ELASTIC_CLUSTER_NAME}-es-elastic-user`
export const SNAPSHOT_CREDENTIALS_SECRET = "snapshot-secret"
export const ELASTIC_POD_NAME_PREFIX = `${ELASTIC_CLUSTER_NAME}-es-${NODE_SET_NAME}`
export const NUMBER_OF_PRODUCTION_NODES = 3
export const ELASTIC_BACKUP_CONTAINER = "elasticbackups"
export const ECK_NODE_LABEL = "elastic-eck-binders"

export type ElasticCompatibilityMode = "6" | "7"
export interface ElasticClusterConfig {
    accessMode: string
    compatibilityMode: ElasticCompatibilityMode
    name: string;
    secretName: string
    shouldInstallRepositoryPlugin: boolean
    storage: string
    s3PluginNeeded: boolean
    isPreprod: boolean
}

export interface S3Credentials {
    accessKey: string;
    secret: string;
}

export interface EckBackupConfig {
    azure: AzureBlobStoreConfig;
    secondary?: AzureBlobStoreConfig
}

interface InitContainer {
    command: string[];
    name: string;
    securityContext?: { privileged: boolean }
}

const createElasticLocalPersistentVolume = (name: string, storage: string, storageClassName: string, path: string) => {
    return {
        apiVersion: "v1",
        kind: "PersistentVolume",
        metadata: {
            name,
            labels: {
                app: name
            }
        },
        spec: {
            accessModes: [READ_WRITE_ONCE],
            capacity: {
                storage
            },
            hostPath: {
                path
            },
            storageClassName,
        }
    }
}

function getHostPathForLocalVolume(devConfig: IDevConfig, minimalEnvironment = true): string {
    const elasticPathPrefix = devConfig.elasticPathPrefix ? devConfig.elasticPathPrefix : "/data/elastic7"
    return minimalEnvironment ? `${elasticPathPrefix}/0` : `${elasticPathPrefix}/1`
}

const getInitContainersForElasticPod = (shouldInstallRepositoryPlugin: boolean, s3PluginNeeded: boolean): InitContainer[] => {
    const initContainers: InitContainer[] = [{
        command: ["sh", "-c", "sysctl -w vm.max_map_count=262144"],
        name: "sysctl",
        securityContext: {
            privileged: true
        }
    }
    ]

    if (shouldInstallRepositoryPlugin) {
        let command
        if (s3PluginNeeded) {
            command = ["sh", "-c",
                "[ ! -d \"/usr/share/elasticsearch/plugins/repository-azure\" ] && bin/elasticsearch-plugin install --batch repository-azure;"
            ]

        } else {
            command = ["sh", "-c", "[ ! -d \"/usr/share/elasticsearch/plugins/repository-azure\" ] && bin/elasticsearch-plugin install --batch repository-azure"]
        }

        initContainers.push({
            command,
            name: "install-plugins",
        })
    }

    return initContainers
}

function getElasticResourceLimits(isProduction: boolean, isMinimal: boolean, isPreprod: boolean) {
    if (isProduction && !isPreprod) {
        return {
            memoryLimits: "11Gi",
            memoryRequests: "9Gi",
            cpu: 1,
            esJavaOptsValue: "-Xms6g -Xmx6g"
        }
    }
    const { memory: { elastic } } = isMinimal ? MINIMAL_STAGING_RESOURCE_LIMITS : STAGING_RESOURCE_LIMITS;
    return {
        memory: elastic.pod,
        cpu: 0.8,
        esJavaOptsValue: `-Xms${elastic.jvm} -Xmx${elastic.jvm}`
    }
}

function getNodeCount(env: Env, minimal: boolean): number {
    if (env === "production") {
        return NUMBER_OF_PRODUCTION_NODES
    }
    else if (env === "staging") {
        return minimal ? 1 : 3
    } else {
        return minimal ? 1 : 2
    }
}

const getCommonHttpConfiguration = () => {
    return {
        tls: {
            selfSignedCertificate: {
                disabled: true
            }
        }
    }
}

const getLocalDevHttpConfiguration = () => {
    return {
        service: {
            spec: {
                type: "NodePort",
                ports: [
                    {
                        name: "http",
                        protocol: "TCP",
                        port: 5601,
                        nodePort: 31602
                    }
                ]
            }
        },
        tls: {
            selfSignedCertificate: {
                disabled: true
            }
        }
    }
}


const createElasticCluster = (elasticConfig: ElasticClusterConfig, environment: Env, minimal = false) => {
    const { accessMode, name, secretName, shouldInstallRepositoryPlugin, storage, s3PluginNeeded, compatibilityMode, isPreprod } = elasticConfig
    const isProductionOrStaging = environment === "production" || environment === "staging"
    const isProduction = environment === "production"
    const count = getNodeCount(environment, minimal)
    const { cpu, esJavaOptsValue, memoryLimits, memoryRequests } = getElasticResourceLimits(isProduction, minimal, isPreprod);
    const storageClass = isProductionOrStaging ? getStorageClass(isProduction) : LOCAL_DEV_STORAGE_CLASS_NAME
    return {
        apiVersion: "elasticsearch.k8s.elastic.co/v1",
        kind: "Elasticsearch",
        metadata: {
            name
        },
        spec: {
            http: getCommonHttpConfiguration(),
            nodeSets: [
                {
                    count,
                    ...(compatibilityMode === "7" && {
                        config: {
                            "search.max_buckets": 900000
                        }
                    }),
                    name: NODE_SET_NAME,
                    podTemplate: {
                        metadata: {
                            labels: {
                                name
                            }
                        },
                        spec: {
                            initContainers: [
                                ...getInitContainersForElasticPod(shouldInstallRepositoryPlugin, s3PluginNeeded)
                            ],
                            containers: [{
                                env: [{
                                    name: "ES_JAVA_OPTS",
                                    value: esJavaOptsValue
                                }],
                                name: "elasticsearch",
                                ...{
                                    resources: {
                                        requests: {
                                            memoryRequests,
                                            cpu
                                        },
                                        limits: {
                                            memoryLimits
                                        }
                                    }
                                }
                            }]
                        }
                    },
                    volumeClaimTemplates: [
                        {
                            metadata: {
                                name: "elasticsearch-data"
                            },
                            spec: {
                                accessModes: [accessMode],
                                resources: {
                                    requests: { storage }
                                },
                                storageClassName: storageClass
                            }
                        }
                    ]
                }
            ],
            podDisruptionBudget: {
                spec: {
                    minAvailable: isProduction ? 2 : 1,
                    selector: {
                        matchLabels: {
                            ["elasticsearch.k8s.elastic.co/cluster-name"]: name
                        }
                    }
                }
            },
            secureSettings: [{ secretName }],
            version: resolveElasticVersion(compatibilityMode)
        }
    }
}

const createKibana = (elasticCompatibilityMode: ElasticCompatibilityMode, namespace: string, isLocalDev = false) => {
    const version = resolveElasticVersion(elasticCompatibilityMode)
    const http = isLocalDev ? getLocalDevHttpConfiguration() : getCommonHttpConfiguration()
    return {
        apiVersion: "kibana.k8s.elastic.co/v1",
        kind: "Kibana",
        metadata: {
            name: KIBANA_BINDERS_NAME
        },
        spec: {
            count: 1,
            elasticsearchRef: {
                name: ELASTIC_CLUSTER_NAME,
                namespace
            },
            http,
            version
        }
    }
}

const getEckDevResources = async (devConfig: IDevConfig, compatibilityMode: ElasticCompatibilityMode, bakcupConfig?: EckBackupConfig, minimal = true): Promise<Record<string, unknown>[]> => {
    const environment = "dev"
    const namespace = "develop"
    const storage = "5Gi"
    const config = {
        accessMode: READ_WRITE_ONCE,
        compatibilityMode,
        name: ELASTIC_CLUSTER_NAME,
        secretName: SNAPSHOT_CREDENTIALS_SECRET,
        shouldInstallRepositoryPlugin: !!bakcupConfig,
        storage,
        storageClassName: LOCAL_DEV_STORAGE_CLASS_NAME,
        s3PluginNeeded: false,
        isPreprod: false
    }
    await createBackupSecret(bakcupConfig, namespace);
    const resources: Record<string, unknown>[] = [createElasticLocalPersistentVolume(`es-data-${random()}`, storage, LOCAL_DEV_STORAGE_CLASS_NAME, getHostPathForLocalVolume(devConfig))]
    if (!minimal) {
        resources.push(createElasticLocalPersistentVolume(`es-data-${random()}`, storage, LOCAL_DEV_STORAGE_CLASS_NAME, getHostPathForLocalVolume(devConfig, minimal)))
    }
    resources.push(createElasticCluster(config, environment, minimal))
    resources.push(createKibana(compatibilityMode, namespace, true))
    return resources
}

const getEckResources = async (compatibilityMode: ElasticCompatibilityMode, namespace: string, bakcupConfig: EckBackupConfig, environment: Env, minimal = false, isPreprod = false): Promise<unknown[]> => {
    const storage = "128Gi"
    const config = {
        accessMode: READ_WRITE_ONCE,
        compatibilityMode,
        name: ELASTIC_CLUSTER_NAME,
        secretName: SNAPSHOT_CREDENTIALS_SECRET,
        shouldInstallRepositoryPlugin: !!bakcupConfig,
        storage,
        s3PluginNeeded: true,
        isPreprod
    }
    await createBackupSecret(bakcupConfig, namespace);

    const resources: unknown[] = [
        createElasticCluster(config, environment, minimal),
    ]

    if (!minimal && !isPreprod) {
        resources.push(createKibana(compatibilityMode, namespace))
    }
    return resources
}

export const getElasticUserPassword = async (namespace: string): Promise<string> => {
    const secret = await getK8SSecret(ELASTIC_USER_SECRET_NAME, namespace)
    const encoded = secret?.data?.elastic;
    return encoded ? Buffer.from(encoded, "base64").toString() : "";
}

export const elasticUserSecretExist = async (namespace: string): Promise<boolean> => {
    const secret = await getK8SSecret(ELASTIC_USER_SECRET_NAME, namespace)
    return !!secret
}



async function createBackupSecret(bakcupConfig: EckBackupConfig, namespace: string): Promise<void> {
    const { azure } = bakcupConfig

    const newSecretValue = {
        "azure.client.default.account": azure.account,
        "azure.client.default.key": azure.accessKey,
    }

    try {
        await createSecret(SNAPSHOT_CREDENTIALS_SECRET, newSecretValue, namespace);
    } catch (err) {
        if (err.output.indexOf("(AlreadyExists)") > -1 ||
            err.output.indexOf("already exists") > -1) {
            await deleteSecret(SNAPSHOT_CREDENTIALS_SECRET, namespace)
            await createSecret(SNAPSHOT_CREDENTIALS_SECRET, newSecretValue, namespace);
        }
    }
}


const getBackupConfig = async (env: Env, currentBranch?: string): Promise<EckBackupConfig> => {
    const secretsLoaderMap = {
        "dev": loadDevSecret,
        "staging": loadStagingSecrets,
        "production": loadProductionSecrets,
    }

    if (env === "production") {
        const prodSecrets = await loadProductionSecrets(currentBranch)
        return {
            azure: prodSecrets.azure.blobs[ELASTIC_BACKUP_CONTAINER],
        }
    }
    const secretLoader = secretsLoaderMap[env]
    const secrets = await secretLoader(currentBranch)
    return {
        azure: secrets.azure.blobs[ELASTIC_BACKUP_CONTAINER],
    }
}

const getKibanaHost = (namespace: string, isProduction: boolean) => isProduction ? "kibana-binders.binders.media" : `kibana-${namespace}.staging.binders.media`

async function createKibanaIngress(clusterName: string, namespace: string, isProduction: boolean) {
    const ingressConfig = {
        name: KIBANA_BINDERS_NAME,
        namespace,
        isProduction,
        rules: [{
            host: getKibanaHost(namespace, isProduction),
            paths: [{
                path: "/",
                portNumber: KIBANA_DEFAULT_PORT,
                serviceName: `${KIBANA_BINDERS_NAME}-kb-http`
            }]
        }]
    }
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    await createOrUpdateIngress(kc, ingressConfig)
}

export interface EckConfig {
    namespace: string
    isProduction: boolean
    loadProductionBackup: boolean
    minimal: boolean
    k8sClusterName: string
    compatibilityMode: ElasticCompatibilityMode
    isPreprod?: boolean
}

export const createEckK8sResources = async (config: EckConfig): Promise<void> => {
    const { namespace, k8sClusterName, isProduction, minimal, loadProductionBackup, compatibilityMode, isPreprod } = config
    const env: Env = isProduction ? "production" : "staging"
    const backupConfig = await getBackupConfig(loadProductionBackup ? "production" : env)
    const elasticResources = await getEckResources(compatibilityMode, namespace, backupConfig, env, minimal, isPreprod)
    const fileContents = elasticResources
        .map(resource => yamlStringify(resource))
        .join("\n---\n");
    const file = "/tmp/local-elastic-dev.yaml";
    await dumpFile(file, fileContents);
    await runKubeCtlFile(file, false, namespace);
    if (!minimal && !isPreprod) {
        await createKibanaIngress(k8sClusterName, namespace, isProduction)
    }
}

export const createEckDevK8sResources = async (devConfig: IDevConfig, elasticVersion: ElasticCompatibilityMode, loadProductionSecret: boolean, currentBranch?: string, minimal = true): Promise<void> => {
    const backupConfig = await getBackupConfig(loadProductionSecret ? "production" : "dev", currentBranch)
    const elasticResources = await getEckDevResources(devConfig, elasticVersion, backupConfig, minimal)
    const fileContents = elasticResources
        .map(resource => yamlStringify(resource))
        .join("\n---\n");
    const file = "/tmp/local-elastic-dev.yaml";
    await dumpFile(file, fileContents);
    await runKubeCtlFile(file, false, "develop");
}


export const waitForElasticUser = async (namespace: string): Promise<void> => {
    const exists = await elasticUserSecretExist(namespace)
    if (!exists) {
        // eslint-disable-next-line no-console
        console.log("Elastic user secret is not ready yet...")
        await sleep(5000)
        await waitForElasticUser(namespace)
        return;
    }
}

function random(length = 8) {
    return Math.random().toString(16).substr(2, length);
}

function resolveElasticVersion(compatibilityMode: ElasticCompatibilityMode): string {
    return compatibilityMode === "7" ? "7.17.25" : "6.8.23"
}
