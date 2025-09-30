import { Severity,setAlertLabels } from "./alertmgr";

const WARNING_TRESHOLD = 75
const CRITICAL_TRESHOLD = 90

function createK8SVolumeUsedDiskAlert(threshold: number, severity: Severity) {
    return {
        alert: `K8S Volume Used Disk % - ${severity.toUpperCase()}`,
        expr: `(kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes) > ${threshold / 100}`,
        annotations: {
            summary: `Kubernetes volume disk usage exceeds ${threshold}%`,
            description: `The disk usage on one or more Kubernetes volumes has exceeded the defined threshold of ${threshold}%. This may lead to insufficient storage space and potential write failures.`
        },
        ...setAlertLabels("infra", severity),
    };
}

function createK8SVolumeUsedInodeAlert(threshold: number, severity: Severity) {
    return {
        alert: `K8S Volume Used Inode % - ${severity.toUpperCase()}`,
        expr: `(kubelet_volume_stats_inodes_used / kubelet_volume_stats_inodes) > ${threshold / 100}`,
        annotations: {
            summary: `Kubernetes volume inode usage exceeds ${threshold}%`,
            description: `The inode usage on one or more Kubernetes volumes has exceeded the defined threshold of ${threshold}%. High inode usage can prevent new files from being created, even if there is available disk space.`
        },
        ...setAlertLabels("infra", severity),
    };
}

const getK8sVolumeAlertRules = () => [
    createK8SVolumeUsedDiskAlert(WARNING_TRESHOLD, "warning"),
    createK8SVolumeUsedDiskAlert(CRITICAL_TRESHOLD, "critical"),
    createK8SVolumeUsedInodeAlert(WARNING_TRESHOLD, "warning"),
    createK8SVolumeUsedInodeAlert(CRITICAL_TRESHOLD, "critical")
]

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getK8sVolumeAlertRulesGroup = () => ({
    name: "kubernetes.volume.rules",
    rules: getK8sVolumeAlertRules()
});