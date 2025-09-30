/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";


export const getJobs = async (namespace) => {
    const args = [
        "get", "jobs", "-n", namespace
    ];
    const result = await getKubeCtlDecodedJson(args);
    return result.items;
};

export const deleteJobs = async (jobNames, namespace) => {
    const args = [
        "delete", "jobs", "-n", namespace, ...jobNames
    ];
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};