import { buildAndRunCommand, buildKubeCtlCommand } from "../commands";
import { BINDERS_SERVICE_SPECS_BY_NAME } from "../../config/services";

type ScaleTargetRef = {
    apiVersion: string;
    kind: string;
    name: string;
};

type MetricTarget = {
    type: string;
    averageUtilization: number;
};

type ResourceMetric = {
    name: string;
    target: MetricTarget;
};

type Metric = {
    type: string;
    resource: ResourceMetric;
};

type HPA_Spec = {
    scaleTargetRef: ScaleTargetRef;
    minReplicas: number;
    maxReplicas: number;
    metrics: Metric[];
};

export type HorizontalPodAutoscaler = {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
    };
    spec: HPA_Spec;
};

export const DEFAULT_HPA_CONFIG = {
    minReplicas: 2,
    maxReplicas: 6,
    metrics: [
        {
            resourceName: "memory",
            averageUtilization: 80
        },
        {
            resourceName: "cpu",
            averageUtilization: 80
        }
    ]
}

export function getHPAName(deploymentName: string): string {
    return deploymentName.replace("deployment", "hpa")
}

interface HPAConfig {
    name: string;
    deploymentName: string;
    minReplicas: number;
    maxReplicas: number;
    metrics: {
        resourceName: string;           // Resource name (e.g., 'memory', 'cpu')
        averageUtilization: number;     // Average utilization target percentage
    }[];
}

export function createHPA(config: HPAConfig): HorizontalPodAutoscaler {
    return {
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        metadata: {
            name: config.name,
        },
        spec: {
            scaleTargetRef: {
                apiVersion: "apps/v1",
                kind: "Deployment",
                name: config.deploymentName,
            },
            minReplicas: config.minReplicas,
            maxReplicas: config.maxReplicas,
            metrics: config.metrics.map(metric => ({
                type: "Resource",
                resource: {
                    name: metric.resourceName,
                    target: {
                        type: "Utilization",
                        averageUtilization: metric.averageUtilization,
                    },
                },
            }))
        },
    };
}

export function shouldCreateHPA(serviceName: string): boolean {
    const service = BINDERS_SERVICE_SPECS_BY_NAME[serviceName]

    if (!service) {
        return false
    }

    if (service.replicas && service.replicas === 1) {
        return false
    }

    return true
}

export function buildHPAConfig(deploymentName: string, maxReplicas = 6, minReplicas = 2): HPAConfig {
    return {
        name: getHPAName(deploymentName),
        deploymentName,
        minReplicas,
        maxReplicas,
        metrics: DEFAULT_HPA_CONFIG.metrics
    }
}

export async function deleteHPA(name: string, namespace: string): Promise<void> {
    const args = ["delete", "hpa", name];
    if (namespace) {
        args.push("-n", namespace);
    }
    try {
        await buildAndRunCommand(
            () => buildKubeCtlCommand(args),
            { mute: true }
        );
    } catch (exc) {
        if (exc?.output?.indexOf("(NotFound)") > -1) {
            return;
        }
        throw exc;
    }
}