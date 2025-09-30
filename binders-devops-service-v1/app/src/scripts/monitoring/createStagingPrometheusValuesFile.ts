import { getSlackCustomTemplates, getStagingConfig } from "../../actions/prometheus/alertmgr";
import { HTPASSWD_SECRET } from "../../actions/aks/access";
import { MANAGED_PREMIUM_DELETE } from "../../actions/aks/storageclass";
import { dumpFile } from "../../lib/fs";
import {
    getAzureAppGatewayIngressAlertRulesGroup
} from "../../actions/prometheus/app.gateway.rules";
import { getAzureAppGatewayScrapeConfigs } from "../../actions/prometheus/azure.exporter";
import { getK8sNodeAlertRulesGroup } from "../../actions/prometheus/k8s.node.rules";
import { getK8sPodAlertRulesGroup } from "../../actions/prometheus/k8s.pod.rules";
import { getK8sVolumeAlertRulesGroup } from "../../actions/prometheus/k8s.volume.rules";
import { main } from "../../lib/program";
import { yamlStringify } from "../../lib/yaml";



const TLS_SECRET_NAME = "tls-staging-secret"
const createValuesFile = async () => {
    const filePath = "/tmp/staging-monitoring-values.yaml";
    const prometheusHosts = ["prometheus.staging.binders.media"];
    const pushgatewayHosts = ["pushgateway.staging.binders.media"]
    const prometheusAlertHosts = ["alerts.staging.binders.media"];
    const values = {
        alertmanager: {
            persistent: {
                storageClassName: MANAGED_PREMIUM_DELETE
            },
            ingress: {
                enabled: true,
                annotations: {
                    "cert-manager.io/cluster-issuer": "letsencrypt",
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus Alerts",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: prometheusAlertHosts.map(host => ({ host, paths: [{ path: "/", pathType: "Prefix" }] })),
                tls: [
                    {
                        hosts: prometheusAlertHosts,
                        secretName: TLS_SECRET_NAME
                    }
                ]
            },
            config: await getStagingConfig(),
            templates: {
                "custom.tmpl": getSlackCustomTemplates()
            }
        },
        pushgateway: {
            ingress: {
                enabled: true,
                annotations: {
                    "cert-manager.io/cluster-issuer": "letsencrypt",
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: pushgatewayHosts,
                tls: [{
                    hosts: pushgatewayHosts,
                    secretName: TLS_SECRET_NAME
                }]
            },
        },
        server: {
            ingress: {
                enabled: true,
                annotations: {
                    "cert-manager.io/cluster-issuer": "letsencrypt",
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required: Prometheus",
                    "nginx.ingress.kubernetes.io/auth-secret": HTPASSWD_SECRET,
                    "nginx.ingress.kubernetes.io/auth-type": "basic",
                },
                hosts: prometheusHosts,
                tls: [
                    {
                        hosts: prometheusHosts,
                        secretName: TLS_SECRET_NAME
                    }
                ]
            },
            persistentVolume: {
                size: "32Gi",
                storageClass: MANAGED_PREMIUM_DELETE
            }
        },
        serverFiles: {
            rules: {
                groups: [
                    getK8sNodeAlertRulesGroup(),
                    getK8sPodAlertRulesGroup(),
                    getK8sVolumeAlertRulesGroup(),
                    getAzureAppGatewayIngressAlertRulesGroup()
                ]
            }
        }
    };
    const yamlValues = await yamlStringify(values, true)
    const resourceType = "Microsoft.Network/applicationgateways"
    const subscriptionId = "df893890-4da6-47bc-8a71-2ec64776511a"
    const target = "azure-metrics-exporter:8080"
    const extraScrapeConfig = getAzureAppGatewayScrapeConfigs({ resourceType, subscriptionId, target })
    const finalConfig = [yamlValues, extraScrapeConfig].join("\n")
    await dumpFile(filePath, finalConfig)
    return filePath;
};

const doIt = async () => {
    await createValuesFile();
};

main(doIt);