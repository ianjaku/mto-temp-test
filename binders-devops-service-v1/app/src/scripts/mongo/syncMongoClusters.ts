import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createK8sResources } from "../../lib/k8s";
import { generateMongoLoadBalancerServiceName } from "../../actions/mongo/k8s";
import { getExternalIpFromService } from "../../actions/k8s/services";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { resolveOutboundIp } from "../../actions/aks/network";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { sleep } from "../../lib/promises";

const MONGO_PORT = 27017
const NGINX_CONFIGMAP_KEY = "nginx.conf"
const NGNIX_VOLUME_NAME = "nginx-conf"
const role = "mongo-proxy"

interface SyncMongoClusterOptions {
    namespace: string
    sourceK8sCluster: string;
    sourceMongoCluster: string;
    targetK8sCluster: string;
    targetMongoCluster: string;
}

function getOptions(): SyncMongoClusterOptions {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespace in both clusters",
            default: "production",
            kind: OptionType.STRING
        },
        sourceK8sCluster: {
            long: "sourceK8sCluster",
            short: "s",
            kind: OptionType.STRING,
            description: "Name of k8s cluster from which data will be moved",
        },
        targetK8sCluster: {
            long: "targetK8sCluster",
            short: "t",
            kind: OptionType.STRING,
            description: "Name of the new k8s cluster",
        },
        sourceMongoCluster: {
            long: "sourceMongoCluster",
            kind: OptionType.STRING,
            default: "mongo-main-service",
            description: "Name of k8s cluster from which data will be moved",
        },
        targetMongoCluster: {
            long: "targetMongoCluster",
            kind: OptionType.STRING,
            default: "mongo-service",
            description: "Name of the new k8s cluster",
        },
    }
    const parser = new CommandLineParser("SyncMongoClusterOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { namespace, sourceK8sCluster, sourceMongoCluster, targetK8sCluster, targetMongoCluster } = (<any>parser.parse()) as SyncMongoClusterOptions

    return {
        namespace,
        sourceK8sCluster,
        sourceMongoCluster,
        targetK8sCluster,
        targetMongoCluster,
    }
}

//Load balances
const toIpRange = (subnet: string, mask: number) => `${subnet}/${mask}`

function createLoadBalancerService(name: string, namespace: string, outboundIpAddress: string, podName: string) {
    return {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            name,
            namespace,
            labels: {
                name
            }
        },
        spec: {
            loadBalancerSourceRanges: [
                toIpRange(outboundIpAddress, 32)
            ],
            ports: [{
                name: "mongo",
                port: MONGO_PORT
            }],
            selector: {
                "statefulset.kubernetes.io/pod-name": podName
            },
            type: "LoadBalancer"
        }
    };
}

function createExternalServicesDefinitions(mongoReleaseName: string, namespace: string, outboundIpAddress: string, sourceCluster = true) {
    return [0, 1, 2].map(index => {
        const podName = `${mongoReleaseName}-mongod-${index}`
        const name = generateMongoLoadBalancerServiceName(index, sourceCluster)
        return createLoadBalancerService(name, namespace, outboundIpAddress, podName)
    })
}

//Proxy pods
interface NginxDeploymentConfig {
    configMap: string
    hostname: string
    name: string
    namespace: string
    subdomain: string
}

function createNginxDeployment(config: NginxDeploymentConfig) {
    const { configMap, hostname, name, namespace, subdomain } = config
    return {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
            name,
            namespace,
        },
        spec: {
            selector: {
                matchLabels: {
                    name,
                    role
                }
            },
            replicas: 1,
            template: {
                metadata: {
                    labels: {
                        name,
                        role
                    }
                },
                spec: {
                    hostname,
                    subdomain,
                    containers: [{
                        name: "mongo-proxy",
                        image: "nginx:latest",
                        ports: [{
                            containerPort: MONGO_PORT
                        }],
                        volumeMounts: [{
                            name: "nginx-conf",
                            mountPath: "/etc/nginx/nginx.conf",
                            subPath: NGINX_CONFIGMAP_KEY,
                            readOnly: true
                        }]
                    }],
                    volumes: [{
                        name: NGNIX_VOLUME_NAME,
                        configMap: {
                            name: configMap,
                            items: [{
                                key: NGINX_CONFIGMAP_KEY,
                                path: NGINX_CONFIGMAP_KEY
                            }]
                        }
                    }]
                }
            }
        }
    };
}

function createNginxConfigMap(name: string, namespace: string, ipAddress: string) {
    const config = []
    config.push(
        "events {}",
        "stream {",
        "   server {",
        `       listen ${MONGO_PORT} so_keepalive=on;`,
        "       proxy_connect_timeout 3s;",
        "       proxy_timeout 20s;",
        `       proxy_pass ${ipAddress}:${MONGO_PORT};`,
        "   }",
        "}",
    )
    return {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
            name,
            namespace,
        },
        data: {
            [NGINX_CONFIGMAP_KEY]: config.join("\n")
        }
    };
}

function createProxyService(name: string, namespace: string) {
    return {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            name,
            namespace,
            labels: {
                name
            }
        },
        spec: {
            clusterIP: "None",
            ports: [{
                name: "mongo",
                port: MONGO_PORT
            }],
            selector: {
                role
            },
        }
    };
}

function createProxyDefinitions(ipAddresses: string[], mongoReleaseName: string, namespace: string) {
    const results = []
    const mongoServiceName = `${mongoReleaseName}-mongodb-service`
    for (let index = 0; index < ipAddresses.length; index++) {
        const config: NginxDeploymentConfig = {
            configMap: `nginx-conf-${index}`,
            hostname: `${mongoReleaseName}-mongod-${index}`,
            subdomain: mongoServiceName,
            name: `mongo-${index}`,
            namespace
        }
        const deployment = createNginxDeployment(config)
        const ipAddress = ipAddresses[index]
        const configMap = createNginxConfigMap(config.configMap, namespace, ipAddress)
        results.push(deployment, configMap)
    }
    results.push(createProxyService(mongoServiceName, namespace))
    return results
}

async function waitForServiceIp(name: string, namespace: string): Promise<string> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { ip, valid } = await getExternalIpFromService(name, namespace)
        if (valid) {
            return ip
        }
        await sleep(5000)
    }
}

async function resolveExternalIps(clusterName: string, namespace: string, sourceCluster = true): Promise<string[]> {
    await runGetKubeCtlConfig(clusterName, true)
    const ips = [0, 1, 2].map(index => waitForServiceIp(generateMongoLoadBalancerServiceName(index, sourceCluster), namespace))
    return Promise.all(ips)
}

main(async () => {
    const { namespace, sourceK8sCluster, sourceMongoCluster, targetK8sCluster, targetMongoCluster } = getOptions()
    log("Resolving outbound IP for both k8s clusters")
    const outboundIpSourceCluster = await resolveOutboundIp(sourceK8sCluster)
    log(`Resolved outbound IP for ${sourceK8sCluster}: ${outboundIpSourceCluster}`)
    const outboundIpTargetCluster = await resolveOutboundIp(targetK8sCluster)
    log(`Resolved outbound IP for ${targetK8sCluster}: ${outboundIpTargetCluster}`)
    log("Creating external services definition")
    const servicesInSourceCluster = createExternalServicesDefinitions(sourceMongoCluster, namespace, outboundIpTargetCluster)
    const servicesInTargetCluster = createExternalServicesDefinitions(targetMongoCluster, namespace, outboundIpSourceCluster, false)
    log("Creating load balancers services")
    await createK8sResources(sourceK8sCluster, "services-source", namespace, servicesInSourceCluster)
    await createK8sResources(targetK8sCluster, "services-target", namespace, servicesInTargetCluster)
    log("Resolving ip addresses of services")
    const externalIpAddressesFromSource = await resolveExternalIps(sourceK8sCluster, namespace)
    const externalIpAddtessesFromTarget = await resolveExternalIps(targetK8sCluster, namespace, false)
    log("Creating proxy deployments definition")
    const proxiesInSourceCluster = createProxyDefinitions(externalIpAddtessesFromTarget, targetMongoCluster, namespace)
    const proxiesInTargetCluster = createProxyDefinitions(externalIpAddressesFromSource, sourceMongoCluster, namespace)
    log("Creating proxy deployments")
    await createK8sResources(sourceK8sCluster, "proxies-source", namespace, proxiesInSourceCluster)
    await createK8sResources(targetK8sCluster, "proxies-target", namespace, proxiesInTargetCluster)
})