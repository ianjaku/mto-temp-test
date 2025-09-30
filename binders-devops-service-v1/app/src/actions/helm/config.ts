/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { runCommand } from "../../lib/commands";

export type HelmReleaseType = "service" | "setup";

export const getHelmReleaseName = (prefix: string, name: string, releaseType: HelmReleaseType) => (
    name ? `${prefix}-${name}-${releaseType}` : `${prefix}-${releaseType}`
);

export const getHelmHome = async () => {
    const { output } = await runCommand("helm", ["home"]);
    return output.trim();
};

export const MONGO_RELEASE_NAME = "mongo-service";
export const MONGO_REPLICASET_NAME = "mongo-main-service";
