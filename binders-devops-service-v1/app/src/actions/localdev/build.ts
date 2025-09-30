import { BINDERS_SERVICE_SPECS, DevTypeScriptCompiler, IServiceSpec, WebAppBundler } from "../../config/services";
import { ElasticCompatibilityMode } from "../../lib/eck";
import { runCommand } from "../../lib/commands";

export const rmrf = (target: string) => {
    if (["", "/", "."].includes(target.trim())) {
        throw new Error(`Invalid target provided to rmrf: "${target}"`);
    }
    return runCommand("rm", ["-rf", target])
};

export interface IDevConfig {
    devTypeScriptCompiler?: DevTypeScriptCompiler;
    dockerBridgeDeviceName: string;
    dockerBridgeIpPrefix: string;
    elasticCompatibilityMode?: ElasticCompatibilityMode;
    elasticPathPrefix?: string;
    environmentVariables: { [name: string]: string };
    hostPathFolder: string;
    includeAPM?: boolean;
    kubeContext: string;
    localBuildDir: string;
    minimalEnvironment?: boolean;
    webAppBundler?: WebAppBundler;
}

export const getServicesToBuild = () => {
    return BINDERS_SERVICE_SPECS
        .filter(spec => !spec.sharedDeployment)
        .filter(spec => spec.name !== "static-pages");
};

export const getLocalServiceImageTag = (serviceSpec: IServiceSpec) => `local-${serviceSpec.name}-${serviceSpec.version}`;
