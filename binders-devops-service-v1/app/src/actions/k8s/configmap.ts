import { getKubeCtlDecodedJson } from "../../lib/k8s";

export const getK8SConfigMap = async (configMapName: string, namespace = "default"): Promise<Record<string, unknown>> => {
    try {
        const args = ["get", "configmap", configMapName, "-n", namespace];
        return await getKubeCtlDecodedJson(args);
    } catch (ex) {
        if (ex.output && ex.output.indexOf("(NotFound)")) {
            return undefined;
        }
        throw ex;
    }
};