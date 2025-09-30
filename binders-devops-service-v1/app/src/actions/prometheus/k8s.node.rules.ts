import { Severity, setAlertLabels } from "./alertmgr";

const WARNING_TRESHOLD = 75
const CRITICAL_TRESHOLD = 90
const CPU_HIGH_LOAD_TRESHOLD = 200

function createK8SNodeMemoryLowAlert(threshold: number, severity: Severity) {
    return {
        alert: `K8S Node Memory Low - ${severity.toUpperCase()}`,
        expr: `avg by (node) (100 * (1 - ((node_memory_MemAvailable_bytes{job="kubernetes-service-endpoints"} or node_memory_MemFree_bytes{job="kubernetes-service-endpoints"}) / node_memory_MemTotal_bytes{job="kubernetes-service-endpoints"}))) > ${threshold}`,
        for: "5m",
        annotations: {
            summary: `Kubernetes node memory usage exceeds ${threshold}%`,
            description: `Memory usage on one or more Kubernetes nodes has exceeded ${threshold}% for more than 5 minutes. This may lead to performance degradation or out-of-memory (OOM) errors. Immediate investigation is required.`
        },
        ...setAlertLabels("infra", severity),
    };
}

function createK8SNodeCPUHighAlert(threshold: number, severity: Severity) {
    return {
        alert: `K8S Node CPU High - ${severity.toUpperCase()}`,
        expr: `100 - (avg by (node) (irate(node_cpu_seconds_total{job="kubernetes-service-endpoints",mode="idle", node!~"aks-memory.*"}[5m])) * 100) > ${threshold}`,
        for: "5m",
        annotations: {
            summary: `Kubernetes node CPU usage exceeds ${threshold}%`,
            description: `The CPU usage on one or more Kubernetes nodes has been higher than ${threshold}% for more than 5 minutes. This could cause performance issues and indicates that the node is under heavy load. Immediate investigation is recommended.`
        },
        ...setAlertLabels("infra", severity),
    };
}

function createK8SNodeDiskSpaceAlert(threshold: number, severity: Severity) {
    return {
        alert: `K8S Node Disk Space ${severity.toUpperCase()}`,
        expr: `avg by (node) (100 - 100*(node_filesystem_avail_bytes / node_filesystem_size_bytes)) > ${threshold}`,
        annotations: {
            summary: `Kubernetes node disk usage exceeds ${threshold}%`,
            description: `The disk usage on one or more Kubernetes nodes has exceeded ${threshold}%. This may lead to insufficient disk space and impact performance.`
        },
        ...setAlertLabels("infra", severity)
    };
}

const getK8sNodeAlertRules = () => [
    {
        alert: "K8S Node Instance Down",
        expr: "up{job=\"kubernetes-nodes\"} == 0",
        for: "10m",
        annotations: {
            summary: "Kubernetes node instance is down",
            description: "A Kubernetes node instance is down for more than 10 minutes. Immediate investigation is required to restore node functionality."
        },
        ...setAlertLabels("infra")

    },
    createK8SNodeDiskSpaceAlert(WARNING_TRESHOLD, "warning"),
    createK8SNodeDiskSpaceAlert(CRITICAL_TRESHOLD, "critical"),
    createK8SNodeCPUHighAlert(WARNING_TRESHOLD, "warning"),
    createK8SNodeCPUHighAlert(CRITICAL_TRESHOLD, "critical"),
    {
        alert: "K8S Node CPU High",
        expr: "100 - (avg by (node) (irate(node_cpu_seconds_total{job=\"kubernetes-service-endpoints\",mode=\"idle\"}[5m])) * 100) > 90",
        for: "5m",
        ...setAlertLabels("infra")
    },
    {
        alert: "K8S Node Load High",
        expr: `(sum(node_load5) by (node) / count(node_cpu_seconds_total{mode="system"}) by (node) * 100) > ${CPU_HIGH_LOAD_TRESHOLD}`,
        for: "5m",
        annotations: {
            summary: `Kubernetes node load is above ${CPU_HIGH_LOAD_TRESHOLD}%`,
            description: "The load on one or more Kubernetes nodes has been higher than 200% for more than 5 minutes. This indicates the node is overloaded."
        },
        ...setAlertLabels("infra")
    },
    createK8SNodeMemoryLowAlert(WARNING_TRESHOLD, "warning"),
    createK8SNodeMemoryLowAlert(CRITICAL_TRESHOLD, "critical"),
    {
        alert: "K8S Node cert expiration",
        expr: "push_time_seconds{job=\"k8s-node-cert-expired\"}",
        annotations: {
            summary: "Kubernetes node certificate expiration detected",
            description: "One or more Kubernetes node certificates have expired or are nearing expiration. Renew the certificates to avoid connection issues."
        },
        ...setAlertLabels("infra")
    }
];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getK8sNodeAlertRulesGroup = () => ({
    name: "kubernetes.node.rules",
    rules: getK8sNodeAlertRules()
});