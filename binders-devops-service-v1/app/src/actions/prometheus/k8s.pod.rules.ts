import { setAlertLabels } from "./alertmgr";

//const POD_MEMORY_TRESHOLD = 0.9
const CPU_THROTTLING_TRESHOLD = 0.2

const getK8sPodAlertRules = () => {
    //const exludedHighMemoryContainers = ["devops", "aggregor", "image", "backup"]
    //const excludedContainers = exludedHighMemoryContainers.map(container => `container!="${container}"`).join(", ")
    return [
        {
            alert: "K8S Pod Unschedulable",
            expr: "sum(kube_node_spec_unschedulable) by (node) > 0",
            annotations: {
                summary: "Kubernetes pod is unschedulable",
                description: "One or more Kubernetes pods are unschedulable due to node constraints (e.g., nodes are marked unschedulable). This may affect workload availability."
            },
            ...setAlertLabels("infra", "warning"),
        },
        // todo swtich off for now, cause it generate too much noise on infra channel. It will require setting up resources and limits for cronjobs pod first.
        // {
        //     alert: "K8S Pod High Memory Usage",
        //     expr: `(container_memory_usage_bytes{image=~"binders.azurecr.*", ${excludedContainers}} / container_spec_memory_limit_bytes{image=~"binders.azurecr.*", ${excludedContainers}}) > ${POD_MEMORY_TRESHOLD}`,
        //     annotations: {
        //         summary: "Pod memory usage exceeds 90% of limit",
        //         description: "One or more Kubernetes pods are using more than 90% of their allocated memory limit. Consider increasing memory limits or optimizing memory usage."
        //     },
        //     ...setAlertLabels("infra", "warning"),
        // },
        {
            alert: "K8S Pod CPU Throttling",
            expr: `rate(container_cpu_cfs_throttled_seconds_total{image=~"binders.azurecr.*"}[5m]) > ${CPU_THROTTLING_TRESHOLD}`,
            annotations: {
                summary: "Pod CPU throttling detected",
                description: "One or more Kubernetes pods are experiencing significant CPU throttling. This indicates that the pod is being limited by its CPU quota and may lead to performance degradation."
            },
            ...setAlertLabels("infra", "warning"),
        },
        {
            alert: "K8S Pod Pending",
            expr: "sum by (pod, namespace) (kube_pod_status_phase{phase=\"Pending\", namespace=\"production\"}) > 0",
            for: "5m",
            annotations: {
                summary: "Pod is in Pending state for more than 5 minutes",
                description: "One or more Kubernetes pods have been stuck in the Pending state for more than 5 minutes, likely due to insufficient resources or node scheduling issues."
            },
            ...setAlertLabels("infra", "warning"),
        }
    ]
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getK8sPodAlertRulesGroup = () => ({
    name: "kubernetes.pod.rules",
    rules: getK8sPodAlertRules()
});