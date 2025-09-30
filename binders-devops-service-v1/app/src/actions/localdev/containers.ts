/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
    DevelopmentContainer,
    HostPathVolume,
    buildApiServiceContainer,
    buildFrontendServiceContainer
} from "../../lib/devenvironment";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { IDevConfig } from "./build";
import { LOCALDEV_IMAGE } from "./env";
import { SERVICES_NOT_TO_DEPLOY } from "../../scripts/bindersenv/deploy/shared";
import { getDevConfigSecret } from "./config";
import { getLocalRepositoryRoot } from "../git/local";
import { runCommand } from "../../lib/commands";

// eslint-disable-next-line @typescript-eslint/ban-types
async function getContainerDefinition(name: string, command: string[], env: {} = {}): Promise<DevelopmentContainer> {
    const hostPathVolume: HostPathVolume = {
        name: "repo-root",
        hostPath: (await getLocalRepositoryRoot()),
        containerPath: "/opt/binders",
        volumeType: "Directory"
    };
    const secretVolumes = [
        { name: "config-secret", containerPath: "/etc/binders", secret: getDevConfigSecret() }
    ];
    return {
        name,
        image: LOCALDEV_IMAGE,
        command,
        hostPathVolumes: [hostPathVolume],
        volumeMounts: [],
        secretVolumes,
        env: {
            ...env,
            BINDERS_ENV: "development"
        }
    }
}

const getApiServiceContainers = async (devConfig: IDevConfig): Promise<DevelopmentContainer[]> => {
    const { minimalEnvironment } = devConfig
    return Promise.all(
        BINDERS_SERVICE_SPECS
            .filter(spec => {
                if (minimalEnvironment) {
                    return !SERVICES_NOT_TO_DEPLOY.includes(spec.name)
                }
                return spec
            })
            .filter(spec => !spec.sharedDeployment && !spec.isFrontend)
            .map(async (spec) => buildApiServiceContainer(spec, devConfig))
    );
};

const getFrontendServiceContainers = async (devConfig: IDevConfig): Promise<DevelopmentContainer[]> => {
    const { minimalEnvironment } = devConfig
    return Promise.all(
        BINDERS_SERVICE_SPECS
            .filter(spec => {
                if (minimalEnvironment) {
                    return !SERVICES_NOT_TO_DEPLOY.includes(spec.name)
                }
                return spec
            })

            .filter(spec => !spec.sharedDeployment)
            .filter(spec => spec.isFrontend)
            .map(async (spec) => buildFrontendServiceContainer(spec, devConfig))
    );
};

export const getAllDevPodContainers = async (devConfig: IDevConfig): Promise<DevelopmentContainer[]> => {
    const [apiServiceContainers, frontendServiceContainers] = await Promise.all([
        getApiServiceContainers(devConfig),
        getFrontendServiceContainers(devConfig)
    ]);
    return [
        await getContainerDefinition("client", ["yarn", "workspace", "@binders/client", "dev"]),
        await getContainerDefinition("uikit", ["yarn", "workspace", "@binders/ui-kit", "dev"]),
        await getContainerDefinition("common", ["yarn", "workspace", "@binders/binders-service-common", "dev"]),
        ...apiServiceContainers,
        ...frontendServiceContainers,
    ];
};

const getContainerIds = async (partialName: string): Promise<string[]> => {
    const filter = `${partialName}_local-dev_develop`;
    const args = ["ps", "--filter", `name=${filter}`, "--format", "{{.ID}}"];
    const { output } = await runCommand(
        "docker",
        args,
        { mute: true }
    );
    const containerIds = output.trim().split("\n");
    if (containerIds.length > 0) {
        return containerIds.map(c => c.trim());
    }
    args.push("-a");
    const { output: outputWithStopped } = await runCommand(
        "docker",
        args,
        { mute: true }
    );
    const containerIdsWithStopped = outputWithStopped.trim().split("\n");
    return containerIdsWithStopped.map(c => c.trim());
};

export const getClientContainerIds = () => getContainerIds("client");
export const getUiKitContainerIds = () => getContainerIds("uikit");
export const getCommonContainerIds = () => getContainerIds("common");
export const getServiceContainerIds = getContainerIds;