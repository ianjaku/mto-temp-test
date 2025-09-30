import { getInfrastructurePodsAndServices, getPodDefinition, getServices } from "../../lib/devenvironment";
import { IDevConfig } from "./build";
import { getAllDevPodContainers } from "./containers";

export const LOCALDEV_IMAGE = "localdev";
export const LOCALDEV_IMAGE_REPO = "localdev-repo"
export const LOCALDEV_IMAGE_DEVOPS = "localdev-devops";

export const MONGO_POD_NAME = "mongo";
export const CPU_LIMIT_RANGE = "cpu-limit-range"


function getLimitRange() {
    return {
        apiVersion: "v1",
        kind: "LimitRange",
        metadata: {
            name: CPU_LIMIT_RANGE
        },
        spec: {
            limits: [{
                default: {
                    cpu: 0.8
                },
                defaultRequest: {
                    cpu: 0.5
                },
                type: "Container"
            }]
        }
    }
}

export const getK8sDevEnvironmentObjects = async (devConfig: IDevConfig, includeLimit = false, useNoLimitsMemoryConfig: boolean): Promise<Array<Record<string, unknown>>> => {
    const { hostPathFolder, includeAPM } = devConfig;
    const containers = await getAllDevPodContainers(devConfig);
    const options = {
        hostPathFolder,
        includeAPM
    }
    const envObjects = [
        getPodDefinition(containers, useNoLimitsMemoryConfig),
        ...getServices(),
        ...getInfrastructurePodsAndServices(options),
    ];

    if (includeLimit) {
        envObjects.push(getLimitRange())
    }

    return envObjects
};
