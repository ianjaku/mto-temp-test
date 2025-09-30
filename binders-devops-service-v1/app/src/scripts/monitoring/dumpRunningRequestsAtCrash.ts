/* eslint-disable no-console */
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { any } from "ramda";
import { getDeployments } from "../../actions/bindersenv/deployment";
import { listPods } from "../../actions/k8s/pods";
import { loadFile } from "../../lib/fs";
import { main } from "../../lib/program";
import moment from "moment";
import { runCommand } from "../../lib/commands";

const getOptions = () => {
    const serviceName = process.argv[2];
    const availableServices = BINDERS_SERVICE_SPECS.map(s => s.name);
    const service = availableServices.find(s => s === serviceName);
    if (!service) {
        console.log("Available services: ", availableServices.join(", "));
        throw new Error(`Invalid service: ${serviceName}`);
    }
    return {
        namespace: PRODUCTION_NAMESPACE,
        serviceName
    };
}

const findLastRestartedPod = (pods) => {
    const restartedPods = pods.filter(
        pod => any<{ restartCount: number }>(cStatus => cStatus.restartCount > 0, pod.status.containerStatuses)
    )
    if (restartedPods.length === 0) {
        throw new Error("No restarted pods found?!");
    }
    let mostRecentRestartMoment = moment(0);
    let mostRecentRestartPod = undefined;
    for(const restartedPod of restartedPods) {
        for (const status of restartedPod.status.containerStatuses) {
            const restartTime = moment(status?.state?.running?.startedAt);
            if (restartTime.isAfter(mostRecentRestartMoment)) {
                mostRecentRestartMoment = restartTime;
                mostRecentRestartPod = restartedPod;
            }
        }
    }
    return mostRecentRestartPod;
}

const parseLog = async (pod, namespace) => {
    const podName = pod.metadata.name;
    const fileName = `/tmp/${podName}.log`;
    await runCommand("kubectl", ["-n", namespace, "logs", "-p", podName, ">", fileName], { shell: true});
    const logContents = await loadFile(fileName);
    const logLines = logContents.split("\n");
    const runningRequests = {};
    for (let i = 0; i < logLines.length; i++) {
        try {
            const parsed = JSON.parse(logLines[i]);
            if (!parsed) {
                throw new Error("Invalid JSON");
            }
            const { correlationKey, msg } = parsed;
            if (msg === "Incoming request") {
                runningRequests[correlationKey] = [ logLines[i] ];
                continue;
            }
            if (correlationKey && msg === "Request finished") {
                delete runningRequests[correlationKey];
                continue;
            }
            runningRequests[correlationKey].push(logLines[i]);
        } catch (err) {
            // console.log("Unparsable", logLines[i]);
        }
    }
    console.log(JSON.stringify(runningRequests, null, 4));
}

const getActivePods = async (serviceDeploy, namespace) => {
    if (!serviceDeploy.activeDeployment) {
        throw new Error(`No active deploy found for service ${serviceDeploy.spec.name}-${serviceDeploy.spec.version}`);
    }
    const { activeDeployment, spec } = serviceDeploy;
    const { branch, commitRef } = activeDeployment;
    const podPrefix = `${branch}-${spec.name}-${spec.version}-${commitRef}`;
    const pods = await listPods(podPrefix, namespace);
    const lastRestartedPod = findLastRestartedPod(pods);
    await parseLog(lastRestartedPod, namespace);
}
const doIt = async () => {
    const { serviceName, namespace } = getOptions();
    const deploys = await getDeployments(namespace);
    const serviceDeploy = deploys.find(d => d.spec.name === serviceName);
    await getActivePods(serviceDeploy, namespace);

}

main(doIt);