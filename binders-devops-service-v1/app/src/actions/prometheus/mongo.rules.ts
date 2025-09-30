import { setAlertLabels } from "./alertmgr";

const getMongoAlertRules = () => {
    return [
        {
            alert: "MONGO Up",
            expr: "mongodb_up < 1",
            annotations: {
                summary: "MongoDB instance is down",
                description: "The MongoDB instance is not reachable. Immediate action is required to restore the service."
            },
            ...setAlertLabels("infra", "critical")
        },
        {
            alert: "MONGO Node Count",
            expr: "sum(mongodb_rs_ok) < 3",
            annotations: {
                summary: "MongoDB replica set has less than 3 healthy members",
                description: "The MongoDB replica set has fewer than 3 healthy members. This may lead to data replication issues or loss of redundancy."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Replica Set Health",
            expr: "mongodb_rs_ok < 1",
            annotations: {
                summary: "MongoDB replica set is not healthy",
                description: "The MongoDB replica set is reporting unhealthy status. Immediate attention is required to ensure data replication and availability."
            },
            ...setAlertLabels("infra", "critical")
        },
        {
            alert: "MONGO Replication Lag",
            expr: "(scalar(max(mongodb_rs_members_optimeDate{member_state=\"PRIMARY\",app_kubernetes_io_instance=\"prometheus-mongodb-exporter-0\"})) - mongodb_rs_members_optimeDate{member_state=\"SECONDARY\",app_kubernetes_io_instance=\"prometheus-mongodb-exporter-0\"}) / 1000 > 10",
            for: "5m",
            annotations: {
                summary: "MongoDB replication lag exceeds 60 seconds",
                description: "The MongoDB replica set is experiencing replication lag greater than 60 seconds between the primary and secondary nodes. This can lead to data inconsistency."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Connection Count",
            expr: "mongodb_ss_connections{conn_type=\"current\"} > 10000",
            annotations: {
                summary: "High number of active MongoDB connections",
                description: "MongoDB is handling more than 10,000 active connections. This may indicate heavy load or connection leaks, leading to performance degradation."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Memory Pressure",
            expr: "(sum(mongodb_ss_mem_virtual) BY (instance) / sum(mongodb_ss_mem_resident) BY (instance)) > 4",
            annotations: {
                summary: "High virtual memory usage in MongoDB",
                description: "MongoDB is experiencing high virtual memory usage relative to resident memory, indicating memory pressure. This could affect performance."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Resident Memory High",
            expr: "sum(mongodb_ss_mem_resident) by (instance) > 20000",
            annotations: {
                summary: "MongoDB is consuming a high amount of resident memory",
                description: "The resident memory usage by MongoDB has exceeded the defined threshold. This could lead to memory pressure, increased swapping, or degraded performance."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Collection missing",
            expr: "manualto_mongo_collection_missing{collection != \"msTransactableEvents\", namespace=\"production\"} > 0",
            annotations: {
                summary: "MongoDB collection is missing",
                description: "A MongoDB collection is missing in the production namespace, which may cause application issues or data inconsistency."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Index missing",
            expr: "manualto_mongo_index_missing{namespace=\"production\"} > 0",
            annotations: {
                summary: "MongoDB index is missing",
                description: "A MongoDB index is missing in the production namespace. Missing indexes can lead to slow queries and degraded performance."
            },
            ...setAlertLabels("infra")
        },
        {
            alert: "MONGO Index Extra",
            expr: "manualto_mongo_index_extra{namespace=\"production\"} > 0",
            annotations: {
                summary: "Extra MongoDB index detected",
                description: "An extra index has been detected in the MongoDB production namespace. Extra indexes can cause overhead during write operations and consume unnecessary disk space."
            },
            ...setAlertLabels("infra")
        },
    ];
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getMongoAlertRulesGroup = () => ({
    name: "mongo.rules",
    rules: getMongoAlertRules()
});