import {
    BINDERS_SERVICE_SPECS,
    DevTypeScriptCompiler,
    IServiceSpec,
    WebAppBundler,
    getServiceDir,
    isFrontendContainer,
} from "../config/services";
import {
    LOCALDEV_IMAGE,
    LOCALDEV_IMAGE_DEVOPS,
    LOCALDEV_IMAGE_REPO
} from "../actions/localdev/env";
import { ELASTIC_USER_SECRET_NAME } from "./eck";
import { IDevConfig } from "../actions/localdev/build";
import { addK8sValuesToEnv } from "./bindersenvironment";
import { getDevConfigSecret } from "../actions/localdev/config";
import { getLocalDevMemoryLimits } from "./bindersdeployment";
import { getLocalRepositoryRoot } from "../actions/git/local";
import { loadJSON } from "./json";
import { runCommand } from "./commands";
import { uniqBy } from "ramda";

/*
1.
az ad sp create-for-rbac --scopes /subscriptions/0370c56f-76ae-4423-8da8-c391ad332bf4/resourcegroups/docker-registry/providers/Microsoft.ContainerRegistry/registries/binders --role Contributor --name dev-tom

OR

az ad sp list // then find your appId
az ad sp credential reset -n "87604474-ff6e-4732-9d26-fcb17af37480"

2.
kubectl create secret docker-registry acr-secret --docker-server binders.azurecr.io --docker-email tom@manual.to --docker-username="87604474-ff6e-4732-9d26-fcb17af37480" --docker-password "4e283122-f572-4eec-bde5-040543edc59b"

*/
export interface Volume {
    name: string;
}

export type HostPathVolumeType = "Directory" | "DirectoryOrCreate" |
    "FileOrCreate" | "File" | "Socket" | "CharDevice" | "BlockDevice"

export interface HostPathVolume extends Volume {
    hostPath: string;
    containerPath: string;
    volumeType: HostPathVolumeType;
}

export interface VolumeMount extends Volume {
    containerPath: string;
}

export interface SecretVolume extends Volume {
    containerPath: string;
    secret: string;
}

export interface DevelopmentContainer {
    name: string;
    image: string;
    command: string[];
    hostPathVolumes: HostPathVolume[];
    volumeMounts: VolumeMount[];
    secretVolumes: SecretVolume[];
    env: Record<string, string>;
    requiredInitContainers?: DevelopmentContainer[];
}

export const getServiceDevImage = (serviceSpec: IServiceSpec): string => {
    return `local-${serviceSpec.name}-${serviceSpec.version}`;
};

const fixVolumePath = (folder: string) => folder.replace(/^\/mnt\/c\//, "/C/");

export const buildFrontendServiceContainer = async (
    serviceSpec: IServiceSpec,
    devConfig: IDevConfig
): Promise<DevelopmentContainer> => {
    const { includeAPM, environmentVariables, webAppBundler } = devConfig;

    const containerName = `${serviceSpec.name}-${serviceSpec.version}`;
    const hostPathVolumes: HostPathVolume[] = [
        {
            name: "repo-root",
            hostPath: (await getLocalRepositoryRoot()),
            containerPath: "/opt/binders",
            volumeType: "Directory"
        }
    ];
    const secretVolumes = [
        { name: "config-secret", containerPath: "/etc/binders", secret: getDevConfigSecret() }
    ];

    const bundler = serviceSpec.webAppBundler?.includes(webAppBundler) ?
        webAppBundler :
        (serviceSpec.webAppBundler?.at(0) ?? WebAppBundler.Webpack);

    return {
        name: containerName,
        image: LOCALDEV_IMAGE,
        hostPathVolumes,
        command: [
            "concurrently",
            "-p",
            "[{name}]",
            "-n",
            "CLIENT,SERVICE",
            "-c",
            "bgBlue.bold,bgMagenta.bold",
            `"yarn workspace @binders/${containerName}-client dev:${bundler}"`,
            `"yarn workspace @binders/${containerName} dev:${bundler}"`,
        ],
        volumeMounts: [],
        secretVolumes,
        env: {
            BINDERS_SERVICE_PORT: `${serviceSpec.port}`,
            ELASTIC_APM_SERVER_URL: "http://apm-server:8200",
            ELASTIC_APM_SERVICE_NAME: containerName,
            ELASTIC_APM_ACTIVE: `${includeAPM}`,
            BINDERS_ENV: "development",
            ...(environmentVariables || {}),
        }
    };
};

async function getRequiredInitContainers(serviceSpec: IServiceSpec,
    hostPathVolumes: HostPathVolume[], secretVolumes: SecretVolume[]) {

    if (serviceSpec.name === "image") {
        const containerName = `${serviceSpec.name}-${serviceSpec.version}`;
        const initContainerName = `init-${containerName}`;
        const folder = getServiceDir(serviceSpec);
        const pJSONPath = `${await getLocalRepositoryRoot()}/${folder}/app/package.json`;
        const pJSON = await loadJSON(pJSONPath);
        const sharpVersion = pJSON.dependencies.sharp;
        return [
            {
                name: initContainerName,
                image: LOCALDEV_IMAGE,
                hostPathVolumes,
                command: ["/bin/bash", "binders-image-service-v1/initContainer", `sharp@${sharpVersion}`],
                volumeMounts: [],
                secretVolumes,
                env: {
                    ELASTIC_APM_ACTIVE: "0",
                    BINDERS_ENV: "development",
                }
            }
        ];
    }
    return undefined;
}

function getLocalDevImage(serviceSpec: IServiceSpec): string {
    if (serviceSpec.name === "devops") {
        return LOCALDEV_IMAGE_DEVOPS;
    }
    if (serviceSpec.name === "binders") {
        return LOCALDEV_IMAGE_REPO;
    }
    return LOCALDEV_IMAGE;
}

export const buildApiServiceContainer = async (serviceSpec: IServiceSpec, devConfig: IDevConfig): Promise<DevelopmentContainer> => {
    const { includeAPM, environmentVariables, devTypeScriptCompiler = DevTypeScriptCompiler.Tsc } = devConfig;
    const containerName = `${serviceSpec.name}-${serviceSpec.version}`;
    const hostPathVolumes: HostPathVolume[] = [
        {
            name: "repo-root",
            hostPath: (await getLocalRepositoryRoot()),
            containerPath: "/opt/binders",
            volumeType: "Directory"
        }
    ];
    if (serviceSpec.name === "devops") {
        hostPathVolumes.push({
            name: "docker-socket",
            hostPath: "/var/run/docker.sock",
            containerPath: "/var/run/docker.sock",
            volumeType: "Socket"
        })
    }
    const secretVolumes = [
        { name: "config-secret", containerPath: "/etc/binders", secret: getDevConfigSecret() },
    ];

    secretVolumes.push({ name: "elastic-secret", containerPath: "/etc/elastic", secret: ELASTIC_USER_SECRET_NAME })

    const compiler = serviceSpec.compilers?.find(c => c === devTypeScriptCompiler) ?? DevTypeScriptCompiler.Tsc;

    const command = {
        [DevTypeScriptCompiler.Tsc]: ["yarn", "workspace", `@binders/${containerName}`, "dev"],
        [DevTypeScriptCompiler.Esbuild]: ["yarn", "workspace", `@binders/${containerName}`, "dev:esbuild"],
    }[compiler];

    return {
        name: containerName,
        image: getLocalDevImage(serviceSpec),
        hostPathVolumes,
        command,
        volumeMounts: [],
        secretVolumes,
        env: {
            BINDERS_SERVICE_PORT: `${serviceSpec.port}`,
            BINDERS_SHOULD_LOG_CORS: "1",
            ELASTIC_APM_SERVER_URL: "http://apm-server:8200",
            ELASTIC_APM_SERVICE_NAME: containerName,
            ELASTIC_APM_ACTIVE: `${includeAPM}`,
            ELASTIC_COMPABILITY_MODE: devConfig.elasticCompatibilityMode,
            BINDERS_ENV: "development",
            ...(environmentVariables || {}),
        },
        requiredInitContainers: await getRequiredInitContainers(serviceSpec, hostPathVolumes, secretVolumes)
    };
};


const toPodVolumeMount = (hostPathVolume: HostPathVolume) => ({
    mountPath: hostPathVolume.containerPath,
    name: hostPathVolume.name
});

const toK8sHostPathVolume = (hostPathVolume: HostPathVolume) => ({
    name: hostPathVolume.name,
    hostPath: {
        path: fixVolumePath(hostPathVolume.hostPath),
        type: hostPathVolume.volumeType
    }
});

const toK8sSecretVolume = (secretVolume: SecretVolume) => ({
    name: secretVolume.name,
    secret: {
        secretName: secretVolume.secret
    }
});

const toK8sVolumeMount = (vm: VolumeMount) => ({
    name: vm.name,
    mountPath: vm.containerPath,
    readOnly: true
});

const memoryLimit = (expectedMemory: string, maxMemory: string) => ({
    resources: {
        requests: {
            memory: expectedMemory
        },
        limits: {
            memory: maxMemory
        }
    }
});

const getResourceDefinitions = (containerDef: DevelopmentContainer, useNoLimitsMemoryConfig: boolean) => {
    if (useNoLimitsMemoryConfig || isFrontendContainer(containerDef.name)) {
        return {}
    }
    const limit = getLocalDevMemoryLimits(containerDef.name.split("-")[0])
    return memoryLimit(limit, limit);
}

const containerDefToJS = (containerDef: DevelopmentContainer, useNoLimitsMemoryConfig: boolean, isInit?: boolean) => {
    const containerEnv = [];
    for (const key in containerDef.env) {
        containerEnv.push({ name: key, value: containerDef.env[key] });
    }
    const imagesWithEntryPoint = [
        LOCALDEV_IMAGE,
        LOCALDEV_IMAGE_DEVOPS
    ]
    const cmdKey = (imagesWithEntryPoint.includes(containerDef.image) && !isInit) ? "args" : "command";
    const env = [
        { name: "NODE_ENV", value: "development" },
        ...containerEnv
    ];
    addK8sValuesToEnv(env);
    return {
        name: containerDef.name,
        image: containerDef.image,
        ...getResourceDefinitions(containerDef, useNoLimitsMemoryConfig),
        imagePullPolicy: (containerDef.image.indexOf("/") > -1) ? "Always" : "IfNotPresent",
        [cmdKey]: containerDef.command,
        volumeMounts: [
            ...containerDef.hostPathVolumes.map(toPodVolumeMount),
            ...containerDef.volumeMounts.map(toK8sVolumeMount),
            ...containerDef.secretVolumes.map(toK8sVolumeMount)
        ],
        env,
    };
};

export const DEV_POD_SELECTOR = { pod: "local-dev" };

export const getPodDefinition = (containerDefs: DevelopmentContainer[], useNoLimitsMemoryConfig: boolean): Record<string, unknown> => {
    const allVolumes = containerDefs.reduce(
        (reduced, containerDef) => [
            ...reduced,
            ...containerDef.hostPathVolumes.map(toK8sHostPathVolume),
            ...containerDef.secretVolumes.map(toK8sSecretVolume)
        ],
        []
    );
    const volumes = uniqBy(v => v.name, allVolumes);
    const initContainers = containerDefs
        .filter(cd => !!cd.requiredInitContainers)
        .map(cd => cd.requiredInitContainers.map(ic => containerDefToJS(ic, useNoLimitsMemoryConfig, true)))
        .flat();

    return {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: "local-dev",
            labels: DEV_POD_SELECTOR
        },
        spec: {
            initContainers,
            containers: containerDefs.map(c => containerDefToJS(c, useNoLimitsMemoryConfig)),
            volumes,
            securityContext: {
                sysctls: [
                    {
                        // Starting in Docker v26, attempts are made to enable IPv6 on a container's loopback interface
                        // but this breaks out inter-service communication useless, because it relies on 'localhost'
                        // so we'll disable it
                        name: "net.ipv6.conf.all.disable_ipv6",
                        value: "1",
                    }
                ]
            }
        }
    };
};
type Resources = {
    requests?: {
        cpu?: string;
        memory?: string;
    };
    limits?: {
        cpu?: string;
        memory?: string;
    };
};
const getInfrastructurePod = (name: string, volumeMounts: HostPathVolume[], image?: string, env?: { [key: string]: string }, resources?: Resources) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pod: any = {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name,
            labels: {
                app: name
            }
        },
        spec: {
            containers: [
                {
                    name,
                    image: image || name,
                    volumeMounts: volumeMounts.map(toPodVolumeMount)
                }
            ],
            volumes: volumeMounts.map(toK8sHostPathVolume),
        }
    };
    if (env) {
        const podEnv = [];
        for (const e of Object.keys(env)) {
            podEnv.push({ name: e, value: env[e] });
        }
        pod.spec.containers[0].env = podEnv;
    }

    if (resources) {
        pod.spec.containers[0].resources = {};
        if (resources.requests) {
            pod.spec.containers[0].resources.requests = resources.requests;
        }
        if (resources.limits) {
            pod.spec.containers[0].resources.limits = resources.limits;
        }
    }
    return pod;
};

export const toInspectPort = (servicePort: number): number => {
    return servicePort + 500;
}

export const toNodePort = (containerPort: number): number => {
    if (containerPort > 31000) {
        return containerPort;
    }
    return 30000 + (containerPort % 2000);
};

const portSpecFromNumber = (port: number, type: string) => {
    return type === "NodePort" ?
        { port, nodePort: toNodePort(port) } :
        { port };
};

const getK8sService = (name: string, ports: Port[], selector: Record<string, unknown>, type: string) => {
    const portDefinition = (port: Port) => {
        if (typeof port === "number") {
            return {
                name: `${name}-${port}`,
                ...portSpecFromNumber(port, type),
                targetPort: port
            }
        } else {
            const { containerPort, servicePort } = port;
            return {
                name: `${name}-${containerPort}`,
                ...portSpecFromNumber(servicePort, type),
                targetPort: containerPort
            }
        }
    };
    return {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            name
        },
        spec: {
            selector,
            ports: ports.map(portDefinition),
            type
        }
    };
};

const getInfrastructureServices = (name: string, ports: Port[]) => {
    return [
        getK8sService(name, ports, { app: name }, "ClusterIP"),
        getK8sService(`${name}-external`, ports, { app: name }, "NodePort")
    ];
};

interface PortDefinition {
    containerPort: number,
    servicePort: number
}

export type Port = number | PortDefinition;

const getInfrastructurePodAndServices = (name: string, ports: Port[], volumeMounts: HostPathVolume[], image?: string, podEnv?: { [key: string]: string }, resources?: Resources) => {
    return {
        pod: getInfrastructurePod(name, volumeMounts, image, podEnv, resources),
        services: getInfrastructureServices(name, ports)
    };
};

const getMongoHostPathDbFolder = (hostPathFolder: string) => `${hostPathFolder}/mongo-data-db`;
const getMongoHostPathDbConfigFolder = (hostPathFolder: string) => `${hostPathFolder}/mongo-data-db-config`;
const getElasticHostPathDataFolder = (hostPathFolder: string) => `${hostPathFolder}/elastic-data`;
const getElasticHostPathPluginsFolder = (hostPathFolder: string) => `${hostPathFolder}/elastic-plugins`;

const getMongoPodAndServices = (hostPathFolder: string) => {
    const volumes: HostPathVolume[] = [
        {
            name: "mongo-data-db",
            hostPath: getMongoHostPathDbFolder(hostPathFolder),
            containerPath: "/data/db",
            volumeType: "Directory"
        },
        {
            name: "mongo-data-db-config",
            hostPath: getMongoHostPathDbConfigFolder(hostPathFolder),
            containerPath: "/data/configdb",
            volumeType: "Directory"
        }
    ];

    const resources = {
        requests: {
            memory: "2Gi"
        },
        limits: {
            memory: "6Gi"
        }
    }
    return getInfrastructurePodAndServices("mongo", [27017], volumes, "mongo:8.0", undefined, resources);
};

const getElasticPodAndServices = (name: string, hostPathFolder: string | undefined, portDefinitions: Port[], image: string, podEnv?: { [key: string]: string }) => {
    const volumes: HostPathVolume[] = hostPathFolder ?
        [
            {
                name: "elastic-data",
                hostPath: getElasticHostPathDataFolder(hostPathFolder),
                containerPath: "/usr/share/elasticsearch/data",
                volumeType: "Directory"
            },
            {
                name: "elastic-plugins",
                hostPath: getElasticHostPathPluginsFolder(hostPathFolder),
                containerPath: "/usr/share/elasticsearch/plugins",
                volumeType: "Directory"
            }
        ] :
        [];
    return getInfrastructurePodAndServices(name, portDefinitions, volumes, image, podEnv);
};

const getRedisPodAndServices = () => {
    return getInfrastructurePodAndServices("redis", [6379], [], "redis:7.4.4-alpine");
};

export const setupHostPathFolders = async (hostPathFolder: string): Promise<void> => {
    await mkdir(getMongoHostPathDbFolder(hostPathFolder));
    await mkdir(getMongoHostPathDbConfigFolder(hostPathFolder));
    await mkdir(getElasticHostPathDataFolder(hostPathFolder));
    await mkdir(getElasticHostPathPluginsFolder(hostPathFolder));
};

export interface InfrastructureOptions {
    hostPathFolder: string;
    includeAPM?: boolean;
}

export const getAPMObjects = (): Array<Record<string, unknown>> => {
    // We need elastic (9201:9200)
    const elasticApmPorts = [
        { containerPort: 9200, servicePort: 9201 },
        { containerPort: 9300, servicePort: 9301 }
    ]
    const elasticImage = "docker.elastic.co/elasticsearch/elasticsearch:7.9.1";
    const elasticEnv = { "discovery.type": "single-node" };
    const { pod: elasticPod, services: elasticServices } =
        getElasticPodAndServices("elastic-apm", undefined, elasticApmPorts, elasticImage, elasticEnv);

    const kibanaImage = "docker.elastic.co/kibana/kibana:7.9.1";
    const kibanaEnv = { "ELASTICSEARCH_HOSTS": "http://elastic-apm:9201" };
    const { pod: kibanaPod, services: kibanaServices } =
        getInfrastructurePodAndServices("kibana", [5601], [], kibanaImage, kibanaEnv);
    return [elasticPod, ...elasticServices, kibanaPod, ...kibanaServices];
}

export const getInfrastructurePodsAndServices = (options: InfrastructureOptions): Array<Record<string, unknown>> => {
    const { hostPathFolder } = options;
    const { pod: mongoPod, services: mongoServices } = getMongoPodAndServices(hostPathFolder);
    const { pod: redisPod, services: redisServices } = getRedisPodAndServices();
    const podsAndServices = [
        mongoPod,
        ...mongoServices,
        redisPod,
        ...redisServices
    ];
    if (options.includeAPM) {
        podsAndServices.push(...getAPMObjects());
    }
    return podsAndServices;
};

export const getServices = (): Array<Record<string, unknown>> => {
    return BINDERS_SERVICE_SPECS.reduce((reduced, spec) => {
        if (spec.sharedDeployment || !spec.port) {
            return reduced;
        }
        const ports = [spec.port];
        if (["editor", "manualto"].includes(spec.name)) {
            ports.push(toNodePort(spec.port) + 1000);
        }
        if (spec.name !== "static-pages") {
            ports.push(toInspectPort(spec.port));
        }
        if (["dashboard", "manage", "editor"].includes(spec.name)) {
            ports.push(...spec.extraPorts)
        }
        return [
            ...reduced,
            getK8sService(`${spec.name}-${spec.version}`, ports, DEV_POD_SELECTOR, "NodePort")
        ];
    }, [] as Array<Record<string, unknown>>);
};

const mkdir = async (target: string) => runCommand("mkdir", ["-p", target]);
