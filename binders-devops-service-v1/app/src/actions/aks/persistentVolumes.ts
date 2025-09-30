export type ReclaimPolicy = "Delete" | "Retain"
const ReadWriteOnce = "ReadWriteOnce"
const Driver = "disk.csi.azure.com"


export interface PersistentVolumeConfig {
    labels: Record<string, string>
    nodePoolResourceGroup?: string
    persistentVolumeReclaimPolicy?: ReclaimPolicy
    subscription: string,
    storageClassName: string
    storage: string
    volumeName: string
}

function createDiskId(config: PersistentVolumeConfig): string {
    const { nodePoolResourceGroup, subscription, volumeName } = config
    return `/subscriptions/${subscription}/resourceGroups/${nodePoolResourceGroup}/providers/Microsoft.Compute/disks/${volumeName}`
}

export function createPersistentVolume(config: PersistentVolumeConfig): Record<string, unknown> {
    const { labels, persistentVolumeReclaimPolicy, storage, storageClassName, volumeName } = config
    const volumeHandle = createDiskId(config)
    return {
        apiVersion: "v1",
        kind: "PersistentVolume",
        metadata: {
            name: volumeName,
            labels
        },
        spec: {
            accessModes: [
                ReadWriteOnce
            ],
            capacity: {
                storage
            },
            csi: {
                driver: Driver,
                readOnly: false,
                volumeHandle
            },
            persistentVolumeReclaimPolicy,
            storageClassName,
        }
    }
}

