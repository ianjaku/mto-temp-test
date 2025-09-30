import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { deletePods, listPods } from "../../actions/k8s/pods";
import { CPU_LIMIT_RANGE } from "../../actions/localdev/env";
import { deleteDeploy } from "../../actions/helm/delete";
import { helmReleaseExists } from "../../actions/helm/install";
import log from "../../lib/logging";
import { main } from "../../lib/program";

const APM_SERVER_HELM_DEPLOY = "apm-server";
const NAMESPACE = "develop"
const cleanupHelm = async (namespace) => {
    try {
        if (await helmReleaseExists(APM_SERVER_HELM_DEPLOY, NAMESPACE)) {
            log("Deleting APM helm deploy");
            await deleteDeploy(APM_SERVER_HELM_DEPLOY, { namespace });
        }
        // eslint-disable-next-line no-empty
    } catch (err) { }
}

const cleanupElasticPods = async () => {
    const checkAndDeletePod = async (podName: string) => {
        const runningPods = await listPods(podName, NAMESPACE);
        if (runningPods.length > 0) {
            const wantedPod = runningPods.find(p => p.metadata.name === podName);
            if (!wantedPod) {
                log(`Pod ${podName} was not found to be running, nothing to do`);
                return
            }
            log(`Deleting pod ${podName}`);
            await deletePods([podName], { namespace: NAMESPACE });
        }
    }
    await checkAndDeletePod("elastic-apm");
    await checkAndDeletePod("kibana");
}

const cleanupApm = async () => {
    await cleanupHelm(NAMESPACE);
    await cleanupElasticPods();
}

const cleanupK8sResourceLimits = async () => {
    const getLimitArgs = ["get", "limits", CPU_LIMIT_RANGE, "-n", NAMESPACE]
    try {
        const output = await buildAndRunCommand(() => buildKubeCtlCommand(getLimitArgs))
        if (output) {
            const deleteLimitArgs = ["delete", "limits", CPU_LIMIT_RANGE, "-n", NAMESPACE]
            await buildAndRunCommand(() => buildKubeCtlCommand(deleteLimitArgs))
        }
    } catch (error) {
        if (error?.output.includes("NotFound")) {
            return;
        }
        throw new Error(`Can't cleanup Limits in k8s: ${error}`)
    }
}



const doIt = async () => {
    await cleanupK8sResourceLimits()
    log("Deleting dev pod");
    await buildAndRunCommand( () => buildKubeCtlCommand(["delete", "pod", "local-dev", "-n", NAMESPACE, "--grace-period", "0"]))
    await cleanupApm();
};

main(doIt);
