import { setAlertLabels } from "./alertmgr";

const getElasticClusterAlertRules = (clusterName, clusterSize) => {
    return [
        {
            alert: `ES Cluster ${clusterName} Green`,
            expr: `elasticsearch_cluster_health_status{color="green",cluster="${clusterName}"} < 1`,
            annotations: {
                summary: `Elasticsearch cluster ${clusterName} is not in green state`,
                description: `The Elasticsearch cluster ${clusterName} is not in a healthy (green) state. Immediate investigation is needed to ensure cluster health and availability.`
            },
            ...setAlertLabels("infra", "critical")
        },
        {
            alert: `ES Cluster ${clusterName} Node Count`,
            expr: `elasticsearch_cluster_health_number_of_nodes{cluster="${clusterName}"} < ${clusterSize}`,
            annotations: {
                summary: `Node count in Elasticsearch cluster ${clusterName} is below ${clusterSize}`,
                description: `The number of nodes in the Elasticsearch cluster ${clusterName} has dropped below the expected count (${clusterSize}). This could lead to reduced performance and redundancy.`
            },
            ...setAlertLabels("infra")
        },
        {
            alert: `ES No Data ${clusterName}`,
            expr: `count(absent(elasticsearch_cluster_health_status{cluster="${clusterName}"})) > 0`,
            for: "3m",
            annotations: {
                summary: `No data from Elasticsearch cluster ${clusterName} for 3 minutes`,
                description: `No data has been received from the Elasticsearch cluster ${clusterName} for 3 minutes. This could indicate a monitoring issue or cluster failure.`
            },
            ...setAlertLabels("infra", "critical")
        },
        {
            alert: `ES Unassigned Shards ${clusterName}`,
            expr: `elasticsearch_cluster_health_unassigned_shards{cluster="${clusterName}"} > 0`,
            annotations: {
                summary: `Unassigned shards detected in Elasticsearch cluster ${clusterName}`,
                description: `There are unassigned shards in the Elasticsearch cluster ${clusterName}. This can cause degraded performance and availability issues.`
            },
            ...setAlertLabels("infra")
        },
        {
            alert: `ES Relocating Shards ${clusterName}`,
            expr: `elasticsearch_cluster_health_relocating_shards{cluster="${clusterName}"} > 0`,
            annotations: {
                summary: `Shards are being relocated in Elasticsearch cluster ${clusterName}`,
                description: `Elasticsearch is relocating shards in the cluster ${clusterName}. If this persists, it could indicate resource constraints or rebalancing issues.`
            },
            ...setAlertLabels("infra")
        },
        {
            alert: `ES Initializing Shards ${clusterName}`,
            expr: `elasticsearch_cluster_health_initializing_shards{cluster="${clusterName}"} > 0`,
            annotations: {
                summary: `Initializing shards detected in Elasticsearch cluster ${clusterName}`,
                description: `There are initializing shards in the Elasticsearch cluster ${clusterName}. This may happen during node recovery or cluster rebalancing, but extended durations could indicate issues.`
            },
            ...setAlertLabels("infra")
        },
        {
            alert: `Manualto elastic shard failures ${clusterName}`,
            expr: "irate(manualto_elastic_search_shard_failures{}[5m]) > 0.1",
            annotations: {
                summary: `Shard failures detected in Elasticsearch cluster ${clusterName}`,
                description: `There have been shard failures in the Elasticsearch cluster ${clusterName} over the last 5 minutes.`
            },
            ...setAlertLabels("infra")
        },

    ];
};

const getElasticAlertRules = () => {
    return [
        ...getElasticClusterAlertRules("binders", 3),
        ...getElasticClusterAlertRules("logevents-new", 3)
    ];
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getElasticAlertRulesGroup = () => ({
    name: "elastic.rules",
    rules: getElasticAlertRules()
});