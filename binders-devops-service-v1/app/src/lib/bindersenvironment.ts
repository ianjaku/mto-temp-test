import { BINDERS_SERVICE_SPECS_BY_NAME, IServiceSpec } from "../config/services";
import {
    BindersDeploymentStatus,
    getProductionMemoryLimits,
    getServiceMemoryLimit,
    getServiceMemoryRequests,
    makeDeploymentPlan
} from "./bindersdeployment";
import { ImageVersion, listImageVersions } from "../actions/aks/registry";
import { buildHPAConfig, createHPA, shouldCreateHPA } from "./k8s/hpa";
import { createK8SSecretFromFiles, getK8SSecret } from "../actions/k8s/secrets";
import { getAllTags, regexForBranch } from "../actions/git/tags";
import { ACR_NAME } from "../actions/docker/build";
import { BindersConfig } from "./bindersconfig";
import { BuildBlueprint } from "./pipeline";
import { createPDB } from "./k8s/podDistruptionBudget";
import { dumpFile } from "./fs";
import { dumpJSON } from "./json";
import { getK8SConfigMap } from "../actions/k8s/configmap";
import { getServiceCpuConfig } from "../config/cpu";
import { listPods } from "../actions/k8s/pods";
import { log } from "./logging";
import { runCommand } from "./commands";
import { runExec } from "../actions/k8s/exec";
import { runKubeCtlFile } from "./k8s";
import { toOfflineIngress } from "./k8s/ingress";
import { unlink } from "fs";
import { yamlStringify } from "./yaml";

const yamlDump = (content: unknown): string => yamlStringify(content, true);

export enum EnvironmentStatus {
    ONLINE,
    MAINTENANCE,
}

export interface IBindersEnvironment {
    branch: string;
    cluster?: string;
    CI?: boolean;
    commitRef: string;
    isMinimal?: boolean;
    isProduction: boolean;
    mockServices?: string;
    prefix?: string;
    services: IServiceSpec[];
    status?: EnvironmentStatus;
    testProductionMode?: boolean;
    useBranchAsNamespace?: boolean;
    useCustomNamespacePrefix?: boolean;
}

export interface IHostConfig {
    api: string;
    manualto: string;
    editor: string[];
    manage: string;
    dashboard: string;
    offline: string;
    partners: string;
}

const buildNumberToNamespace = (prefix = PIPELINE_PREFIX_NAMESPACE): string | undefined => {
    const fromEnv = process.env.BITBUCKET_BUILD_NUMBER;
    if (fromEnv) {
        return `${prefix}-${fromEnv}`;
    }
    return undefined;
}

export function getPipelineNamespace(useCustomNamespace = false): string {
    const prefix = useCustomNamespace ? CUSTOM_PREFIX_NAMESPACE : PIPELINE_PREFIX_NAMESPACE;
    const namespaceFromBuildNumber = buildNumberToNamespace(prefix);
    if (namespaceFromBuildNumber) {
        return namespaceFromBuildNumber;
    }
    throw new Error("Could not determine namespace for pipeline");
}

export const CUSTOM_PREFIX_NAMESPACE = "custom"
export const PIPELINE_PREFIX_NAMESPACE = "pipe"
export const getNamespace = (env: IBindersEnvironment): string => {
    /*
    For preprod env isProduction also returns true, that's why first we're checking testProductionMode flag
    */
    if (env.testProductionMode) {
        return PREPROD_NAMESPACE
    }
    if (env.isProduction) {
        return PRODUCTION_NAMESPACE;
    }
    if (env.useBranchAsNamespace) {
        return env.branch;
    }
    return getPipelineNamespace(env.useCustomNamespacePrefix);
};

export const isProductionCluster = (environment: IBindersEnvironment): boolean => {
    const namespace = getNamespace(environment)
    return isProductionClusterNamespace(namespace)
};

const isProductionClusterNamespace = (namespace: string): boolean => {
    return namespace === PRODUCTION_NAMESPACE || namespace === PREPROD_NAMESPACE //Prepod env should be treated as production
};


export const toServicePodSelectorLabelPrefix = (environment: IBindersEnvironment, spec: IServiceSpec): string => {
    return `${environment.prefix}-${spec.name}-${spec.version}`;
};

export const toServicePodSelectorLabel = (environment: IBindersEnvironment, spec: IServiceSpec): string => {
    // Kubernetes has a very short name limit, i.e. 63 characters
    // This service name will be suffixed by "-service" and "-deployment" so we need to calculate that in
    const suffixMaxLength = 63 - "-deployment".length - `${environment.prefix}-${spec.name}-${spec.version}`.length;
    if (suffixMaxLength < 6) {
        throw new Error("Ambiguous commit ref");
    }
    const suffix = environment.commitRef ? `-${environment.commitRef}`.substr(0, suffixMaxLength) : "";
    return `${toServicePodSelectorLabelPrefix(environment, spec)}${suffix}`;
};

export const toDeploymentName = (environment: IBindersEnvironment, spec: IServiceSpec): string => {
    return `${toServicePodSelectorLabel(environment, spec)}-deployment`;
};

export const extractServiceFromDeploymentName = (deploymentName: string): string => {
    if (!deploymentName.endsWith("-deployment")) {
        throw new Error("Invalid deployment name format");
    }

    const trimmedName = deploymentName.slice(0, -"-deployment".length);

    const parts = trimmedName.split("-");
    const versionIndex = parts.findIndex(part => /^v\d+$/.test(part)); // Find the "v2", "v3", etc.

    if (versionIndex === -1 || versionIndex === 0) {
        throw new Error("Version not found in deployment name or invalid format");
    }

    // Service name is the part right before the version
    const serviceName = parts[versionIndex - 1];

    return serviceName;
}

export function parseDeploymentName(
    deploymentName: string,
): {
    branchName: string;
    service: string;
    version: string;
    commitRef: string | null;
} {
    const withoutDeploymentSuffix = deploymentName.replace(/-deployment$/, "");

    // Sort service names by length (descending) to match the longest service first
    const serviceNames = Object.keys(BINDERS_SERVICE_SPECS_BY_NAME).sort((a, b) => b.length - a.length);

    const servicesPattern = serviceNames.map(s => s.replace(/-/g, "\\-")).join("|");

    const pattern = new RegExp(`^(.+?)-(${servicesPattern})-(v\\d+)-(.+)$`);

    const match = withoutDeploymentSuffix.match(pattern);

    if (!match) {
        throw new Error("Could not parse deployment name with available services");
    }

    return {
        branchName: match[1],
        service: match[2],
        version: match[3],
        commitRef: match[4]
    };
}
export const toServiceName = (spec: IServiceSpec | { name: string, version: string }): string => {
    return `${spec.name}-${spec.version}-service`;
};


const toPodSelector = (environment: IBindersEnvironment, spec: IServiceSpec) => (
    { component: toServicePodSelectorLabel(environment, spec) }
);

export const toK8sService = (environment: IBindersEnvironment, spec: IServiceSpec): Record<string, unknown> => {
    /*
    apiVersion: v1
    kind: Service
    metadata:
      name: {{ $fullService }}-service
    spec:
      selector:
        component: {{ $fullService }}
      ports:
      - protocol: TCP
        port: {{ $service.port }}
    */
    const toServicePort = p => ({ protocol: "TCP", port: p, name: `port-${p}` })
    const service = {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            name: toServiceName(spec)
        },
        spec: {
            selector: toPodSelector(environment, spec),
            ports: [toServicePort(spec.port)]
        }
    };
    if (spec.extraPorts) {
        const extraServicePorts = spec.extraPorts.map(toServicePort);
        service.spec.ports.push(...extraServicePorts);
    }
    return service;
}

export const toEncodedK8sService = (environment: IBindersEnvironment, spec: IServiceSpec): string => {
    const service = toK8sService(environment, spec);
    return yamlDump(service);
};

export const toUntaggedContainerImage = (spec: IServiceSpec): string => {
    switch (spec.name) {
        case "binders": {
            return `binders-repository-service-${spec.version}`;
        }
        case "manualto": {
            return `manualto-service-${spec.version}`;
        }
        default: {
            return `binders-${spec.name}-service-${spec.version}`;
        }
    }
};

const NO_MATCHING_IMAGE_COMMIT_MSG = "Could not find an image tag with a valid commit ref";


const getMostRecentCommitRef = (buildCommitRefs: string[], versions: ImageVersion[]) => {
    log("Need to inspect older image tags to find a deploy candidate");
    for (let i = buildCommitRefs.length - 1; i >= 0; i--) {
        const commitRef = buildCommitRefs[i];
        const hasImage = !!versions.find(
            iVersion => !!(iVersion.tags && iVersion.tags.find(tag => tag === commitRef))
        );
        if (hasImage) {
            log(`Found a valid tag: ${commitRef}`);
            return commitRef;
        }
    }
    throw new Error(NO_MATCHING_IMAGE_COMMIT_MSG);
};

export const defaultPodReplicas = (environment: IBindersEnvironment): number => environment.isProduction || !environment.CI ? 2 : 1;

const toContainerImage = async (environment: IBindersEnvironment, spec: IServiceSpec): Promise<string> => {
    const untaggedImage = toUntaggedContainerImage(spec);
    const dockerImageVersions = await listImageVersions("binders", untaggedImage);
    let buildTags = await getAllTags(regexForBranch(environment.branch));
    let tagPrefix = environment.branch;
    let buildCommitRefs = buildTags.map(tag => tag.substr(tagPrefix.length + 1));
    const hasImageWithCommitRef = dockerImageVersions.find(
        iVersion => !!(iVersion.tags && iVersion.tags.find(tag => tag === environment.commitRef))
    );
    try {
        log(`Finding commit ref for ${spec.name}-${spec.version}`);
        const commitRef = hasImageWithCommitRef ?
            environment.commitRef :
            getMostRecentCommitRef(buildCommitRefs, dockerImageVersions);
        return `${ACR_NAME}/${untaggedImage}:${commitRef}`;
    } catch (exc) {
        if (exc.message === NO_MATCHING_IMAGE_COMMIT_MSG) {
            if (environment.isProduction && spec.name !== "static-pages") {
                throw new Error("No image found for production environment");
            }
            // If we get here there are no images with tags yet for the branch
            // Use the last successful build from develop as image target
            tagPrefix = "develop";
            buildTags = await getAllTags(regexForBranch(tagPrefix));
            buildCommitRefs = buildTags.map(tag => tag.substr(tagPrefix.length + 1));
            if (spec.name === "static-pages") {
                return "binders.azurecr.io/binders-static-pages-service-v1:latest"
            }
            const commitRef = getMostRecentCommitRef(buildCommitRefs, dockerImageVersions);
            return `${ACR_NAME}/${untaggedImage}:${commitRef}`;
        }
        throw exc;
    }
    // return `${ACR_NAME}/${untaggedImage}:386a6b5d8c3f4cc1ff36d360d60fe975dd1d66e5`;
};

const getPrometheusPath = (spec: IServiceSpec): string => {
    const prefix = spec.isFrontend ? "" : `/${spec.name}/${spec.version}`;
    return `${prefix}/_status/metrics`;
};

const getHttpProbe = (path, port, allowedFailures, probePeriodInSeconds) => {
    return {
        httpGet: {
            path,
            port
        },
        failureThreshold: allowedFailures,
        periodSeconds: probePeriodInSeconds
    }
}

const getProbes = (spec: IServiceSpec) => {
    const { port } = spec;
    const healthPathPrefix = spec.isFrontend ? "" : `/${spec.name}/${spec.version}`;
    const healthPath = spec.name === "static-pages" ?
        "/healthz" :
        `${healthPathPrefix}/_status/healtz`;
    return {
        livenessProbe: getHttpProbe(healthPath, port, 60, 5),
        readinessProbe: getHttpProbe(healthPath, port, 1, 30),
        // startupProbe: getHttpProbe(healthPath, port, 60, 5),
    }
}

const getPodAnnotations = (spec: IServiceSpec) => {
    if (spec.name === "static-pages") {
        return {};
    }
    return {
        "prometheus.io/port": `${spec.port}`,
        "prometheus.io/path": getPrometheusPath(spec),
        "prometheus.io/scrape": "true"
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getApmSecretToken = async (): Promise<string> => {
    const secretName = "apm-server-apm-token"
    const namespace = "monitoring"
    const secret = await getK8SSecret(secretName, namespace)
    const encoded = secret?.data["secret-token"];
    return encoded ? Buffer.from(encoded, "base64").toString() : "";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getPodEnv = async (
    spec: IServiceSpec,
    isProduction: boolean,
    readerLocation: string,
    environment: IBindersEnvironment,
): Promise<Record<string, string>> => {
    const env = {
        BINDERS_ENV: isProduction ? "production" : "staging",
        BINDERS_SERVICE: `${spec.name}-${spec.version}`,
        BINDERS_SERVICE_PORT: `${spec.port}`,
        BINDERS_SHOULD_LOG_CORS: (spec.name === "binders" || spec.name === "account" || spec.name === "user") ? "1" : "0",
    }
    if (spec.name === "binders") {
        env["BINDERS_ELASTIC_ALLOW_ENSURE_SETTINGS"] = !isProduction || environment.testProductionMode ? "allow" : "deny"
    }

    if (!isProduction) {
        env["MANUALTO_DEFAULT_DOMAIN"] = readerLocation;
    }
    env["K8S_NAMESPACE"] = getNamespace(environment)
    env["ELASTIC_APM_SERVICE_NAME"] = `${spec.name}-${spec.version}`;

    env["ELASTIC_APM_SERVER_URL"] = "http://apm-server-apm-http.monitoring:8200";
    env["ELASTIC_APM_SECRET_TOKEN"] = await getApmSecretToken();
    env["BINDERS_MOCK_SERVICES"] = environment.mockServices;
    return env;
}

type MemoryLimits = { maxMemory: string, expectedMemory: string }
const getMemoryLimits = (spec: IServiceSpec, environment: IBindersEnvironment): MemoryLimits => {
    if (environment.isProduction && !environment.testProductionMode) {
        const { expectedMemory, maxMemory } = getProductionMemoryLimits(spec.name)
        return {
            expectedMemory,
            maxMemory
        }
    }
    const requests = getServiceMemoryRequests(spec.name, environment)
    const limit = getServiceMemoryLimit(spec.name, environment);
    return {
        expectedMemory: requests,
        maxMemory: limit
    };
}

const getCpuLimists = (spec: IServiceSpec, isProduction: boolean) => getServiceCpuConfig(spec.name, isProduction)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addK8sValuesToEnv(env: Array<any>): void {
    env.push({
        name: "K8S_NODE",
        valueFrom: {
            fieldRef: {
                fieldPath: "spec.nodeName"
            }
        }
    });
    env.push({
        name: "K8S_POD",
        valueFrom: {
            fieldRef: {
                fieldPath: "metadata.name"
            }
        }
    });
}

function getTerminationGracePeriod(serviceName: string): number {
    if (serviceName === "image" || serviceName === "binders") {
        return 300
    }
    return 60
}


interface DeploymentSpec {
    yamlDefinition: string
    deploymentName: string
}

const toK8sScaledObject = (config: BindersConfig, environment: IBindersEnvironment, spec: IServiceSpec): string => {
    const deploymentName = toDeploymentName(environment, spec);
    const podSelector = toPodSelector(environment, spec);
    const { host, port } = config.redis["sessions"];

    if (!spec.redisQueueName) {
        throw new Error("Worker should have defined redis queue")
    }

    const scaledObject = {
        apiVersion: "keda.sh/v1alpha1",
        kind: "ScaledObject",
        metadata: {
            name: `${deploymentName}-scaled-object`,
            labels: podSelector
        },
        spec: {
            scaleTargetRef: {
                name: deploymentName
            },
            minReplicaCount: spec.minReplicas || 1,
            maxReplicaCount: spec.maxReplicas || 5,
            triggers: [
                {
                    type: "redis",
                    metadata: {
                        address: `${host}:${port}`,
                        listName: spec.redisQueueName,
                        listLength: "1"
                    }
                }
            ]
        }
    };

    return yamlDump(scaledObject)
};



const toK8sDeployment = async (environment: IBindersEnvironment, spec: IServiceSpec, image: string): Promise<DeploymentSpec> => {
    /*
    apiVersion: apps/v1
    kind: Deployment
    metadata:
        name: {{ $fullService }}-deployment
        labels:
            component: {{ $fullService }}
    spec:
        replicas: {{ $service.replicas | default 5 }}
        selector:
            matchLabels:
                component: {{ $fullService }}
        template:
            metadata:
                labels:
                    component: {{ $fullService }}
            spec:
                containers:
                - name: {{ $service.name }}
                    {{- $imageScope := dict "service" $service "environment" $release }}
                    image: {{ template "serviceImage" $imageScope }}
                    ports:
                    - containerPort: {{ $service.port }}
    */
    const deploymentName = toDeploymentName(environment, spec);
    const podSelector = toPodSelector(environment, spec);
    const podSelectorFirstKey = Object.keys(podSelector)[0];
    const isProd = isProductionCluster(environment);
    const defaultReplicas = defaultPodReplicas(environment);
    const { expectedMemory, maxMemory } = getMemoryLimits(spec, environment);
    const cpuConfig = getCpuLimists(spec, environment.isProduction)
    const environmentName = getNamespace(environment);
    const readerLocation = buildStagingEnvironmentLocation(environmentName, "manualto");
    const envVars = await getPodEnv(spec, isProd, readerLocation, environment);
    const env = [];
    for (const key in envVars) {
        env.push({
            name: key,
            value: envVars[key]
        });
    }
    addK8sValuesToEnv(env)


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployment: any = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
            name: deploymentName,
            labels: podSelector
        },
        spec: {
            replicas: (spec.replicas || defaultReplicas),
            selector: {
                matchLabels: podSelector
            },
            template: {
                metadata: {
                    labels: podSelector,
                    annotations: getPodAnnotations(spec)
                },
                spec: {
                    affinity: {
                        podAntiAffinity: {
                            preferredDuringSchedulingIgnoredDuringExecution: [
                                {
                                    weight: 100,
                                    podAffinityTerm: {
                                        labelSelector: {
                                            matchExpressions: [{
                                                key: podSelectorFirstKey,
                                                operator: "In",
                                                values: [podSelector[podSelectorFirstKey]]
                                            }]
                                        },
                                        topologyKey: "kubernetes.io/hostname"
                                    }
                                },
                                {
                                    weight: 90,
                                    podAffinityTerm: {
                                        labelSelector: {
                                            matchExpressions: [{
                                                key: podSelectorFirstKey,
                                                operator: "In",
                                                values: [podSelector[podSelectorFirstKey]]
                                            }]
                                        },
                                        topologyKey: "topology.kubernetes.io/zone"
                                    }
                                }

                            ]
                        }
                    },
                    containers: [
                        {
                            name: spec.name,
                            image,
                            imagePullPolicy: "Always",
                            env,
                            ports: [
                                { containerPort: spec.port }
                            ],
                            ...getProbes(spec),
                            resources: {
                                requests: {
                                    cpu: cpuConfig.requests,
                                    memory: expectedMemory
                                },
                                limits: {
                                    ...(cpuConfig?.limits && {
                                        cpu: cpuConfig.limits,
                                    }),
                                    memory: maxMemory
                                }
                            },
                            volumeMounts: [
                                {
                                    name: "config",
                                    mountPath: "/etc/binders",
                                    readOnly: true
                                }
                            ]
                        }
                    ],
                    terminationGracePeriodSeconds: getTerminationGracePeriod(spec.name),
                    volumes: [
                        {
                            name: "config",
                            secret: {
                                secretName: getConfigSecret(environment.branch)
                            }
                        }
                    ],
                }
            }
        }
    };
    return {
        deploymentName,
        yamlDefinition: yamlDump(deployment)
    };
};


export const buildStagingEnvironmentLocation = (environmentName: string, prefix: string): string => {
    const suffix = `-${environmentName}.staging.binders.media`;
    return `${prefix}${suffix}`;
};

export const toHostConfig = (environment: IBindersEnvironment): IHostConfig => {
    if (isProductionCluster(environment)) {
        const api = environment.testProductionMode ? "preprodapi.binders.media" : "api.binders.media"
        const manage = environment.testProductionMode ? "preprod-manage.binders.media" : "manage.binders.media"
        const dashboard = environment.testProductionMode ? "preprod-dashboard.binders.media" : "dashboard.binders.media"
        const partners = environment.testProductionMode ? "preprod-partners.binders.media" : "partners.binders.media"

        const manualto = environment.testProductionMode ?
            "preprod.manual.to" :
            "*.manual.to"
        const editor = environment.testProductionMode ?
            ["preprod-editor.manual.to"] :
            [
                "*.editor.manual.to",
                "editor.manual.to"
            ]

        return {
            api,
            manualto,
            dashboard,
            editor,
            manage,
            offline: "azure-offline.manual.to",
            partners
        };
    } else {
        const environmentName = getNamespace(environment);
        return {
            api: buildStagingEnvironmentLocation(environmentName, "api"),
            manualto: buildStagingEnvironmentLocation(environmentName, "manualto"),
            dashboard: buildStagingEnvironmentLocation(environmentName, "dashboard"),
            editor: [buildStagingEnvironmentLocation(environmentName, "editor")],
            manage: buildStagingEnvironmentLocation(environmentName, "manage"),
            offline: buildStagingEnvironmentLocation(environmentName, "offline"),
            partners: buildStagingEnvironmentLocation(environmentName, "partners"),
        };
    }
};


/*
IE not handling permanent redirect (308 http code)
https://github.com/kubernetes/ingress-nginx/issues/1825
*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setupRedirectCodeForNginxIngressController = async (isProduction: boolean, namespace = "default"): Promise<void> => {
    if (isProduction) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const config = await getK8SConfigMap("ingress-nginx-controller", namespace)
        if (!config?.data["http-redirect-code"]) {
            config.data["http-redirect-code"] = "301"
            const tmpFile = "/tmp/nginxConfigMap.json";
            await dumpJSON(config, tmpFile);
            await runKubeCtlFile(tmpFile, false, namespace)
        }
    }
}


type DeployPlanItem = {
    name: string;
    version: string;
    status: BindersDeploymentStatus;
};
export type DeployPlan = Record<string, DeployPlanItem>;
type K8sYamlDumpResult = {
    yamlFile: string;
    deployPlan: DeployPlan;
}

export const dumpK8sYaml = async (environment: IBindersEnvironment, blueprint: BuildBlueprint, config: BindersConfig): Promise<K8sYamlDumpResult> => {
    const deployPlan = await makeDeploymentPlan(environment, blueprint);
    const changedDeployments = [];
    const servicesToFindImageFor: IServiceSpec[] = [];
    for (const planKey in deployPlan) {
        const deployPlanItem = deployPlan[planKey];
        if (deployPlanItem.status === BindersDeploymentStatus.UP_TO_DATE) {
            log(`Skipping ${planKey}, it's up to date!`);
            continue;
        }
        const service = environment.services.find(
            s => s.name === deployPlanItem.name && s.version === deployPlanItem.version
        );
        if (service === undefined) {
            throw new Error(`Could not find definition for service ${planKey}`);
        }
        servicesToFindImageFor.push(service);
    }
    const foundImages: string[] = await Promise.all(servicesToFindImageFor.map(service => toContainerImage(environment, service)));
    const images = {};
    servicesToFindImageFor.forEach(async (service, index) => {
        images[service.name] = foundImages[index];
    });

    for (const planKey in deployPlan) {
        const deployPlanItem = deployPlan[planKey];
        if (deployPlanItem.status === BindersDeploymentStatus.UP_TO_DATE) {
            log(`Skipping ${planKey}, it's up to date!`);
            continue;
        }
        const service = environment.services.find(
            s => s.name === deployPlanItem.name && s.version === deployPlanItem.version
        );
        if (service === undefined) {
            throw new Error(`Could not find definition for service ${planKey}`);
        }
        const items = [];
        if (!environment.isProduction || environment.testProductionMode) {
            items.push(toEncodedK8sService(environment, service));
        }
        const image = images[service.name];
        const { yamlDefinition, deploymentName } = await toK8sDeployment(environment, service, image);
        items.push(yamlDefinition);
        if (service.isWorker) {
            const kedaScaledObject = toK8sScaledObject(config, environment, service);
            items.push(kedaScaledObject);
        } else {
            if (environment.isProduction && !environment.testProductionMode && shouldCreateHPA(extractServiceFromDeploymentName(deploymentName))) {
                const hpaConfig = buildHPAConfig(deploymentName, service.maxReplicas, service.minReplicas)
                const hpa = createHPA(hpaConfig)
                items.push(yamlDump(hpa))
            }
            const pdb = createPDB({
                deploymentName,
                maxUnavailable: 1,
                podSelector: toServicePodSelectorLabel(environment, service)
            })
            items.push(yamlDump(pdb))
        }

        changedDeployments.push(items.join("---\n"));
    }
    const contentItems = changedDeployments;

    if (environment.isProduction && !environment.testProductionMode) {
        contentItems.push(toOfflineIngress(environment))
    }
    const content = contentItems.join("---\n");
    const targetDirectory = `/tmp/k8s/${environment.branch}`;
    await runCommand("mkdir", ["-p", targetDirectory]);
    const targetFile = `${targetDirectory}/env.yml`;
    await dumpFile(targetFile, content);
    return {
        yamlFile: targetFile,
        deployPlan
    };
};

export const getConfigSecret = (branch: string): string => `${branch}-binders-config`;

export const createBindersConfigSecret = async (config: BindersConfig, branch: string, namespace: string): Promise<void> => {
    const productionFile = `/tmp/${branch}-config.json`;
    const configSecret = getConfigSecret(branch);
    await dumpJSON(config, productionFile);
    const filename = isProductionClusterNamespace(namespace) ? "production.json" : "staging.json";
    await createK8SSecretFromFiles(configSecret, {
        [filename]: productionFile,
    }, namespace, true);
    unlink(productionFile, err => {
        if (err) {
            log("Could not clean up json config");
        }
    });
};

const getCreationTimestamp = pod => new Date(pod.metadata.creationTimestamp).getTime();
const podCreationCompare = (left, right) => getCreationTimestamp(right) - getCreationTimestamp(left);

const findPodForService = async (environment: IBindersEnvironment, service: IServiceSpec) => {
    const namespace = getNamespace(environment);
    const infix = `${service.name}-${service.version}`;
    const runningPods = (await listPods("", namespace))
        .filter(pod => pod.metadata.name.indexOf(infix) > -1)
        .filter(pod => pod.status.phase === "Running");
    if (runningPods.length === 0) {
        throw new Error(`Could not find pod for service ${namespace} / ${service.name}`);
    }
    runningPods.sort(podCreationCompare);
    return runningPods[0];
};

export const runCommandInContainer = async (environment: IBindersEnvironment, service: IServiceSpec, command: string): Promise<{ output: string }> => {
    const pod = await findPodForService(environment, service);
    const namespace = getNamespace(environment);
    return runExec(pod.metadata.name, command, { namespace });
};

export const PRODUCTION_NAMESPACE = "production";
export const PREPROD_NAMESPACE = "preprod"
export const MONITORING_NAMESPACE = "monitoring";
