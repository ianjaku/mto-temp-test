/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { Env } from "../../lib/environment";
import log from "../../lib/logging";

const PRODUCTION_AKS_CLUSTER = "binder-prod-cluster";
const STAGING_AKS_CLUSTER = "binder-stg-cluster";

const CLUSTER_NAME_RG_MAPPING = {
    "binder-stg-cluster": "binder-stg-k8s-rg",
    "binder-prod-cluster": "binder-prod-k8s-rg",
}
const CLUSTER_NAME_SUBSCRIPTION_MAPPING = {
    "binder-stg-cluster": "df893890-4da6-47bc-8a71-2ec64776511a",
    "binder-prod-cluster": "93eddcda-b319-4357-9de4-cb610ae0ede9",
}

const ENVIRONMENT_SUBSCRIPTION_MAPPING = {
    "dev": "df893890-4da6-47bc-8a71-2ec64776511a",
    "staging": "df893890-4da6-47bc-8a71-2ec64776511a",
    "production": "93eddcda-b319-4357-9de4-cb610ae0ede9",
}

const STORAGE_CLASS_MAPPING = {
    "binder-stg-cluster": "managed-premium-zrs-delete",
    "binder-prod-cluster": "managed-premium-zrs-retain",
}

export const getAKSCluster = (isProduction: boolean): string => {
    if (!isProduction) {
        log(`Getting staging aks cluster name ${STAGING_AKS_CLUSTER}`)
        return STAGING_AKS_CLUSTER
    }

    log(`Getting production aks cluster name: ${PRODUCTION_AKS_CLUSTER}`)
    return PRODUCTION_AKS_CLUSTER
};

export const getSubscriptionForCluster = (clusterName: string): string => {
    const subscription = CLUSTER_NAME_SUBSCRIPTION_MAPPING[clusterName]
    if (!subscription) {
        throw new Error(`[Subscription mapping error]: cluster ${clusterName}, mapping ${CLUSTER_NAME_SUBSCRIPTION_MAPPING}`)
    }
    return subscription
}

export const getSubscriptionForEnv = (env: Env): string => {
    const subscription = ENVIRONMENT_SUBSCRIPTION_MAPPING[env]
    if (!subscription) {
        throw new Error(`[Subscription mapping error]: env ${env}, mapping ${ENVIRONMENT_SUBSCRIPTION_MAPPING}`)
    }
    return subscription
}

export const getResourceGroupForCluster = (clusterName: string): string => {
    const resourceGroup = CLUSTER_NAME_RG_MAPPING[clusterName]
    if (!resourceGroup) {
        throw new Error(`[Resource group mapping error]: cluster ${clusterName}, mapping ${CLUSTER_NAME_RG_MAPPING}`)
    }
    return resourceGroup
}

export const getStorageClassForCluster = (clusterName: string): string => {
    const storageClass = STORAGE_CLASS_MAPPING[clusterName]
    if (!storageClass) {
        throw new Error(`[Storage class mapping error]: cluster ${clusterName}, mapping ${STORAGE_CLASS_MAPPING}`)
    }
    return storageClass
}

export const getStagingCluster = () => STAGING_AKS_CLUSTER;
export const getProductionCluster = () => PRODUCTION_AKS_CLUSTER;


export const getScopeId = async (aksClusterName) => {
    const args = [
        "aks", "show",
        "--name", aksClusterName,
        "-g", aksClusterName,
        "--query", "id",
        "--output", "tsv"
    ];
    const { output } = await buildAndRunCommand(() => buildAzCommand(args));
    return output.trim();
};

export const getAksCredentials = async (clusterName: string): Promise<void> => {
    const resourceGroup = CLUSTER_NAME_RG_MAPPING[clusterName]
    log(`Getting credentials for ${clusterName} cluster in ${resourceGroup} resource group`)
    try {
        const args = [
            "aks", "get-credentials", "--name", clusterName, "--resource-group", resourceGroup
        ]
        await buildAndRunCommand(() => buildAzCommand(args))
        log("SUCCESSFULL GOT AKS CREDENTIALS");
    } catch (ex) {
        log("FAILED GOT AKS CREDENTIALS");
        log(ex);
    }
}

