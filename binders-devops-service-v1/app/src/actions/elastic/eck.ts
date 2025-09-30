import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { checkIfNamespaceExist } from "../k8s/namespaces";
import { log } from "../../lib/logging";
import { realpathSync } from "fs";

const installElasticCloudOnK8sOperator = async (): Promise<void> => {
    const customResourceDefinitonUri = realpathSync(__dirname + "/elastic-cloud-resources/crds.yaml")
    const operatorDefinitonUri = realpathSync(__dirname + "/elastic-cloud-resources/operator.yaml")
    const createCustomResourceArgs = ["create", "-f", customResourceDefinitonUri];
    await buildAndRunCommand(() => buildKubeCtlCommand(createCustomResourceArgs));
    const installOperatorArgs = ["apply", "-f", operatorDefinitonUri];
    await buildAndRunCommand(() => buildKubeCtlCommand(installOperatorArgs));
}

export const deleteElasticsearchCluster = async (clusterName: string, namespace: string): Promise<void> => {
    const args = ["delete", "elasticsearch", clusterName, "--namespace", namespace]
    await buildAndRunCommand(() => buildKubeCtlCommand(args));
}

export const deleteKibana = async (clusterName: string, namespace: string): Promise<void> => {
    try {
        const args = ["delete", "kibana", clusterName, "--namespace", namespace]
        await buildAndRunCommand(() => buildKubeCtlCommand(args));
    } catch (err) {
        if (err.output && err.output.indexOf("Error from server (NotFound)") > -1) {
            log("kibana-binders was not found");
        } else {
            throw err;
        }
    }
}


export const maybeInstallEckOperator = async (): Promise<void> => {
    try {
        await checkIfNamespaceExist("elastic-system")
    } catch (err) {
        if (err.output.indexOf("namespaces \"elastic-system\" not found")) {
            await installElasticCloudOnK8sOperator()
        }
    }
}

export const maybeCleanElasticPersistentVolume = async (): Promise<void> => {
    const namespace = "develop"
    const getVolumeArgs = ["get", "pv", "--namespace", namespace];
    let getVolumeResult
    try {
        getVolumeResult = await buildAndRunCommand(() => buildKubeCtlCommand(getVolumeArgs), { mute: true });
    } catch (error) {
        return;
    }
    const { output } = getVolumeResult
    for (const line of output.split("\n")) {
        if (line.includes("es-data") && line.includes("Released")) {
            const persistentVolumeName = line.split(/(\s+)/)[0]
            const getVolumeArgs = ["delete", "pv", persistentVolumeName, "--namespace", namespace];
            await buildAndRunCommand(() => buildKubeCtlCommand(getVolumeArgs));
        }
    }
}

export async function isElasticClusterExists(clusterName: string, namespace: string): Promise<boolean> {
    const args = ["get", "elasticsearch", clusterName, "--namespace", namespace];
    try {
        await buildAndRunCommand(() => buildKubeCtlCommand(args), { mute: true });
        return true
    } catch (error) {
        return false;
    }
}