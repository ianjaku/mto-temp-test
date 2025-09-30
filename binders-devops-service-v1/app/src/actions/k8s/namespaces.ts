/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";

const runIt = async (args) => await buildAndRunCommand( () => buildKubeCtlCommand(args));

export const createK8SNamespace = async (namespace: string) => runIt(["create", "namespace", namespace]);
export const deleteK8SNamespace = async (namespace: string) => runIt(["delete", "namespace", namespace]);
export const deleteK8SNamespaces = async (namespaces: string[]) => runIt(["delete", "namespace", ...namespaces]);
export const getK8SNamespaces = async () => (await getKubeCtlDecodedJson(["get", "namespace"])).items;

export const checkIfNamespaceExist = async (namespace: string) => {
    const args = ["get", "namespace", namespace]
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(args));
    return output
}
