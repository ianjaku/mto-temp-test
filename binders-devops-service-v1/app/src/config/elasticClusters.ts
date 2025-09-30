import { getProductionCluster, getStagingCluster } from "../actions/aks/cluster";

export interface IElasticClusterConfig {
    aksClusterName: string;
    elasticClusterName: string;
    elasticNodeCount: number;
    elasticVersion: string;
    heapSize: string;
    initialMasterNodes: string[];
    k8sNodeLabel: string;
    namespace: string;
    resourcesCpu: string;
    resourcesMemory: string;
}

const PRODUCTION_CLUSTER_CONFIG: Partial<IElasticClusterConfig> = {
    aksClusterName: getProductionCluster(),
    elasticNodeCount: 3,
    heapSize: "8192m",
    namespace: "production",
    resourcesCpu: "3.0",
    resourcesMemory: "10Gi",
}

const ELASTIC_BINDERS_PRODUCTION_CONFIG: IElasticClusterConfig = {
    ...PRODUCTION_CLUSTER_CONFIG,
    elasticClusterName: "binders",
    elasticVersion: "5.6.16",
    initialMasterNodes: [
        "elastic-binders-service-0",
        "elastic-binders-service-1",
        "elastic-binders-service-2"
    ],
    k8sNodeLabel: "elastic-binders",
} as IElasticClusterConfig;

const ELASTIC_LOGEVENTS_PRODUCTION_CONFIG: IElasticClusterConfig = {
    ...PRODUCTION_CLUSTER_CONFIG,
    elasticClusterName: "logevents",
    elasticVersion: "7.4.1",
    initialMasterNodes: [
        "elastic-logevents-service-0",
        "elastic-logevents-service-1",
        "elastic-logevents-service-2"
    ],
    k8sNodeLabel: "elastic-logevents",
} as IElasticClusterConfig;

const TEST_STAGING_CLUSTER: IElasticClusterConfig = {
    aksClusterName: getStagingCluster(),
    elasticClusterName: "test-upgrade",
    elasticNodeCount: 3,
    elasticVersion: "7.4.1",
    heapSize: "512m",
    initialMasterNodes: [
        "elastic-test-upgrade-service-0",
        "elastic-test-upgrade-service-1",
        "elastic-test-upgrade-service-2"
    ],
    k8sNodeLabel: "elastic-test-upgrade",
    namespace: "test-upgrade",
    resourcesCpu: "0.5",
    resourcesMemory: "800Mi",
}

export const getClusterConfig = (elasticClusterName: string): IElasticClusterConfig => {
    const config = [
        ELASTIC_BINDERS_PRODUCTION_CONFIG,
        ELASTIC_LOGEVENTS_PRODUCTION_CONFIG,
        TEST_STAGING_CLUSTER
    ].find(c => c.elasticClusterName === elasticClusterName);
    if (config === undefined) {
        throw new Error(`No config found for elastic cluster '${elasticClusterName}'`);
    }
    return config;
}