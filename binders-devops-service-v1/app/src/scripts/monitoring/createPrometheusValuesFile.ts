import { getProductionConfig, getSlackCustomTemplates } from "../../actions/prometheus/alertmgr";
import { HTPASSWD_SECRET } from "../../actions/aks/access";
import { MANAGED_PREMIUM_RETAIN } from "../../actions/aks/storageclass";
import { dumpFile } from "../../lib/fs";
import { getAppAlertRulesGroup } from "../../actions/prometheus/app.rules";
import {
    getAzureAppGatewayIngressAlertRulesGroup
} from "../../actions/prometheus/app.gateway.rules";
import { getAzureAppGatewayScrapeConfigs } from "../../actions/prometheus/azure.exporter";
import { getElasticAlertRulesGroup } from "../../actions/prometheus/elastic.rules";
import { getK8sNodeAlertRulesGroup } from "../../actions/prometheus/k8s.node.rules";
import { getK8sPodAlertRulesGroup } from "../../actions/prometheus/k8s.pod.rules";
import { getK8sVolumeAlertRulesGroup } from "../../actions/prometheus/k8s.volume.rules";
import { getManualtoRulesGroup } from "../../actions/prometheus/manualto.rules";
import { getMongoAlertRulesGroup } from "../../actions/prometheus/mongo.rules";
import { getRedisAlertRulesGroup } from "../../actions/prometheus/redis.rules";
import { main } from "../../lib/program";
import path from "path";
import { yamlStringify } from "../../lib/yaml";

const STORAGE_SIZE = "1024Gi";
function getPersistentVolume(size = "128Gi", storageClass = MANAGED_PREMIUM_RETAIN) {
    return {
        size,
        storageClass
    }
}

const createValuesFile = async () => {
    const prometheusHosts = ["prometheus.binders.media"];
    const prometheusAlertHosts = ["alerts.binders.media"];
    const pushgatewayHosts = ["pushgateway.binders.media"]
    const values = {
        alertmanager: {
            persistence: {
                enabled: true,
                size: "2Gi",
                storageClass: MANAGED_PREMIUM_RETAIN
            },
            ingress: {
                enabled: true,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus Alerts",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: prometheusAlertHosts.map(host => ({ host, paths: [{ path: "/", pathType: "Prefix" }] })),
                tls: [
                    {
                        hosts: prometheusAlertHosts,
                        secretName: "tls-production-secret"
                    }
                ]
            },
            config: await getProductionConfig(),
            templates: {
                "custom.tmpl": getSlackCustomTemplates()
            }
        },
        pushgateway: {
            ingress: {
                enabled: true,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: pushgatewayHosts,
                tls: [{
                    hosts: pushgatewayHosts,
                    secretName: "tls-production-secret"

                }]
            },
            persistentVolume: getPersistentVolume(),
        },
        configmapReload: {
            prometheus: {
                resources: {
                    requests: {
                        cpu: 0.05,
                        memory: "10Mi"
                    },
                    limits: {
                        memory: "100Mi"
                    }
                }
            }
        },
        server: {
            ingress: {
                enabled: true,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: prometheusHosts,
                tls: [
                    {
                        hosts: prometheusHosts,
                        secretName: "tls-production-secret"
                    }
                ]
            },
            persistentVolume: getPersistentVolume(STORAGE_SIZE),
            resources: {
                requests: {
                    cpu: 0.5,
                    memory: "3Gi"
                },
                limits: {
                    memory: "6Gi"
                }
            }
        },
        serverFiles: {
            rules: {
                groups: [
                    getK8sNodeAlertRulesGroup(),
                    getK8sPodAlertRulesGroup(),
                    getK8sVolumeAlertRulesGroup(),
                    getElasticAlertRulesGroup(),
                    getMongoAlertRulesGroup(),
                    getRedisAlertRulesGroup(),
                    getAppAlertRulesGroup(),
                    getManualtoRulesGroup(),
                    getAzureAppGatewayIngressAlertRulesGroup()
                ]
            }

        }
    };
    const yamlValues = await yamlStringify(values, true)
    const resourceType = "Microsoft.Network/applicationgateways"
    const subscriptionId = "93eddcda-b319-4357-9de4-cb610ae0ede9"
    const target = "azure-metrics-exporter:8080"
    const extraScrapeConfig = getAzureAppGatewayScrapeConfigs({ resourceType, subscriptionId, target })
    const finalConfig = [yamlValues, extraScrapeConfig].join("\n")
    const outputPath = path.resolve(__dirname, "../../../helm/prometheus/config/production.yaml");
    await dumpFile(outputPath, finalConfig)
    return outputPath;
};


const doIt = async () => {
    await createValuesFile();
};

main(doIt);