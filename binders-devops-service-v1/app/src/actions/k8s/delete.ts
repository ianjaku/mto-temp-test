import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";

type k8sResource = "pod" | "service" | "deployment" | "configmap"

export async function deleteK8sResouce(name: string, namespace: string, resourceType: k8sResource): Promise<{ output: string }> {
    const args = ["delete", resourceType, name, "-n", namespace];
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
}