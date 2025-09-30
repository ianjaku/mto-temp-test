import { Env, parseEnv } from "../../lib/environment";
import { ReclaimPolicy, createPersistentVolume } from "../../actions/aks/persistentVolumes";
import { dumpFile } from "../../lib/fs";
import { getNodeResourceGroup } from "../../lib/aks";
import { main } from "../../lib/program";
import { runKubeCtlFile } from "../../lib/k8s";
import { yamlStringify } from "../../lib/yaml";

const envMapping = {
    "staging": "stg",
    "production": "prod"
}

const subscriptionMapping = {
    "staging": "df893890-4da6-47bc-8a71-2ec64776511a",
    "production": "93eddcda-b319-4357-9de4-cb610ae0ede9"
}

const getClusterName = (env: Env) => `binder-${envMapping[env]}-cluster`
const getResourceGroup = (env: Env) => `binder-${envMapping[env]}-resource-group`


const createConfig = (nodePoolResourceGroup: string, subscription: string) => volumeName => ({
    labels: {
        pv: "mongo"
    },
    nodePoolResourceGroup,
    persistentVolumeReclaimPolicy: "Retain" as ReclaimPolicy,
    subscription,
    storageClassName: "managed-premium-zrs-retain",
    storage: "128Gi",
    volumeName
})

const generatePersistentVolumesAndClaims = (disks: string[], nodePoolResourceGroup: string, subscription: string) => {
    const pvs = disks
        .map(createConfig(nodePoolResourceGroup, subscription))
        .map(createPersistentVolume)
    return pvs
}

const dumpAndCreateVolumesAndClaims = async (namespace: string, volumesAndClaims: Record<string, unknown>[]) => {
    const fileContents = volumesAndClaims
        .map(volumeOrClaim => yamlStringify(volumeOrClaim))
        .join("\n---\n");
    const file = "/tmp/pv.yaml";
    await dumpFile(file, fileContents);
    await runKubeCtlFile(file, false, namespace);
}

const getOptions = () => {
    const env = process.argv[2]
    const namespace = process.argv[3]
    const disks = process.argv.slice(4)

    return {
        env,
        namespace,
        disks
    }
}

const doIt = async () => {
    const { env, namespace, disks} = getOptions()
    const environment = parseEnv(env)
    const clusterName = getClusterName(environment)
    const rg = getResourceGroup(environment)
    const subscription = subscriptionMapping[environment]
    const nodePoolResourceGroup = await getNodeResourceGroup(clusterName, rg)
    const k8sObjects = generatePersistentVolumesAndClaims(disks, nodePoolResourceGroup, subscription)
    await dumpAndCreateVolumesAndClaims(namespace, k8sObjects)
}

main(doIt)