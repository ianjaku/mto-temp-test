/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";

export const getPersistentVolumeClaims = async () => {
    const args = ["get", "pvc", "--all-namespaces"];
    const { items } = await getKubeCtlDecodedJson(args);
    return items;
};

export const getPersistentVolumes = async () => {
    const args = ["get", "pv", "--all-namespaces"];
    const { items } = await getKubeCtlDecodedJson(args);
    return items;
};

export const getPersistentVolume = async (volumeName) => {
    const args = ["get", "pv", "--all-namespaces", volumeName];
    return getKubeCtlDecodedJson(args);
};

export const deletePersistentVolume = async (volumeName, namespace = "default") => {
    const args = ["delete", "pv", "-n", namespace, volumeName];
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};

export const deletePersistentVolumeClaim = async (claimName, namespace = "default") => {
    const args = ["delete", "pvc", "-n", namespace, claimName];
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};