import * as yaml from "js-yaml";

interface Dimension {
    dimension: string;
    operator: string; // e.g. "eq"
    value: string;    // e.g. "*"
}

export interface MetricEntry {
    name: string;
    dimensions?: Dimension[];
    aggregation: string[];
}

function generateMetricFilter(dimensions: Dimension[]): string {
    return dimensions
        .map(dim => `${dim.dimension} ${dim.operator} '${dim.value}'`)
        .join(" and ");
}

function generateJobName(metric: string): string {
    return `azure-metrics-exporter-${metric}`;
}


export interface ExporterConfig {
    resourceType: string
    subscriptionId: string
    target: string
}

interface AzureExporterJobConfig {
    metric: MetricEntry
    resourceType: string
    subscriptionId: string
    target: string
}

const metrics: MetricEntry[] = [
    {
        name: "BackendResponseStatus",
        dimensions: [
            { dimension: "BackendPool", operator: "eq", value: "*" },
            { dimension: "HttpStatusGroup", operator: "eq", value: "*" }
        ],
        aggregation: ["total"]
    },
    {
        name: "BackendLastByteResponseTime",
        dimensions: [
            { dimension: "BackendPool", operator: "eq", value: "*" },
            { dimension: "BackendHttpSetting", operator: "eq", value: "*" },
        ],
        aggregation: ["average", "maximum"]
    },
    {
        name: "FailedRequests",
        dimensions: [
            { dimension: "BackendSettingsPool", operator: "eq", value: "*" },
        ],
        aggregation: ["total"]
    },
    {
        name: "AzwafSecRule",
        dimensions: [
            { dimension: "Action", operator: "eq", value: "*" },
            { dimension: "Mode", operator: "eq", value: "*" },
            { dimension: "PolicyName", operator: "eq", value: "*" },
            { dimension: "RuleGroupID", operator: "eq", value: "*" },
            { dimension: "RuleID", operator: "eq", value: "*" }
        ],
        aggregation: ["total"]
    },
    {
        name: "AzwafCustomRule",
        dimensions: [
            { dimension: "Action", operator: "eq", value: "*" },
            { dimension: "CustomRuleID", operator: "eq", value: "*" },
            { dimension: "Mode", operator: "eq", value: "*" },
            { dimension: "PolicyName", operator: "eq", value: "*" },
        ],
        aggregation: ["total"]
    }
];

export function getAzureAppGatewayScrapeConfigs(config: ExporterConfig): string {
    const scrapeConfigJobs = metrics.map(metric => createAzureExporterJob({
        metric,
        ...config
    }))
    return formatExtraScrapeConfig(scrapeConfigJobs)
}

function createAzureExporterJob(config: AzureExporterJobConfig) {
    const { metric, resourceType, subscriptionId, target } = config

    const params = {
        name: [`app-gw-${metric.name}`],
        template: ["{name}_{aggregation}_{unit}"],
        subscription: [subscriptionId],
        resourceType: [resourceType],
        metric: [metric.name],
        interval: ["PT1M"],
        timespan: ["PT1M"],
        aggregation: metric.aggregation
    }

    if (metric.dimensions && metric.dimensions.length > 0) {
        params["metricFilter"] = [generateMetricFilter(metric.dimensions)]
    }

    return {
        job_name: generateJobName(metric.name),
        scrape_interval: "1m",
        metrics_path: "/probe/metrics/list",
        params,
        static_configs: [
            { targets: [target] }
        ]
    }
}

function formatExtraScrapeConfig(scrapeConfigJobs: unknown[]): string {
    const arrayYaml = yaml.dump(scrapeConfigJobs);
    const indentedArrayYaml = arrayYaml
        .split("\n")
        .map(line => (line.trim() ? "  " + line : line))
        .join("\n");

    return `extraScrapeConfigs: |-\n${indentedArrayYaml}`
}


