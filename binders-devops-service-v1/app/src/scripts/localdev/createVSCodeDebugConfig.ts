import { BINDERS_SERVICE_SPECS, IServiceSpec } from "../../config/services";
import { existsSync, mkdirSync } from "fs";
import { toInspectPort, toNodePort } from "../../lib/devenvironment";
import { dumpJSON } from "../../lib/json";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

const emptyLaunchFile = () => {
    return {
        "version": "0.2.0",
        "configurations": [ ]
    }
};

const getConfigName = (spec: IServiceSpec) => `${spec.name}-${spec.version} Service`;

const getLaunchObject = (spec: IServiceSpec) => {
    return {
        "type": "node",
        "request": "attach",
        "name": getConfigName(spec),
        "address": "localhost",
        "port": toNodePort(toInspectPort(spec.port)),
        "skipFiles": [
            "<node_internals>/**"
        ],
        "localRoot": "${workspaceFolder}",
        "remoteRoot": "/opt/binders",
    }
}

const createLaunchJson = async (configurations: unknown[]) => {
    const repoRoot = await getLocalRepositoryRoot();
    const vsCodeFolder = `${repoRoot}/.vscode`;
    if (!existsSync(vsCodeFolder)) {
        mkdirSync(vsCodeFolder);
    }
    const launchFileLocation = `${vsCodeFolder}/launch.json`;
    const startFile = emptyLaunchFile();
    const finalFile = {
        ...startFile,
        configurations,
    }
    log(`Saving to file ${launchFileLocation}`);
    await dumpJSON(finalFile, launchFileLocation, true);
}

const createAllConfigs = async () => {
    const isDebuggable = (f: IServiceSpec) => !f.sharedDeployment && f.name !== "static-pages";
    const services = BINDERS_SERVICE_SPECS.filter(isDebuggable);
    await createLaunchJson(services.map(getLaunchObject));
}
main(createAllConfigs);
