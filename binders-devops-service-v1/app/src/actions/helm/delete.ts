import { buildAndRunCommand, buildHelmCommand } from "../../lib/commands";

export interface HelmDeleteOptions {
    namespace: string
}

const HELM_DELETE_DEFAULT_OPTIONS = {
    purge: false
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function deleteDeploy(deployName: string, options: Partial<HelmDeleteOptions> = {}) {
    const filledOptions = {
        ...HELM_DELETE_DEFAULT_OPTIONS,
        ...options
    }
    const args = ["delete", deployName];
    if (filledOptions.namespace) {
        args.push("-n");
        args.push(filledOptions.namespace)
    }
    return buildAndRunCommand(
        () => buildHelmCommand(args));
}