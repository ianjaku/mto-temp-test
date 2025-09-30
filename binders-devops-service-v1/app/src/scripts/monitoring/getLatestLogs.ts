/* eslint-disable no-console */
import { ServiceDeployment, getDeployments } from "../../actions/bindersenv/deployment";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { listPods } from "../../actions/k8s/pods";
import { main } from "../../lib/program";
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

const fetchLog = async (pod: string, namespace: string, index: number) => {
    const fileName = `log.${index}`;
    await runCommand("kubectl", ["-n", namespace, "logs", pod, ">", fileName], { shell: true});
}

const extractLogs = async (serviceDeploy: ServiceDeployment, namespace: string) => {
    if (!serviceDeploy.activeDeployment) {
        throw new Error(`No active deploy found for service ${serviceDeploy.spec.name}-${serviceDeploy.spec.version}`);
    }
    const { activeDeployment, spec } = serviceDeploy;
    const { branch, commitRef } = activeDeployment;
    const podPrefix = `${branch}-${spec.name}-${spec.version}-${commitRef}`;
    const pods = await listPods(podPrefix, namespace);
    console.log(`Fetching logs for ${pods.length} pods`);
    await Promise.all(pods.map( (p, i) => fetchLog(p.metadata.name, namespace, i)));
}

const doIt = async () => {
    const { serviceName, namespace } = getOptions();
    const deploys = await getDeployments(namespace);
    const serviceDeploy = deploys.find(d => d.spec.name === serviceName);
    await extractLogs(serviceDeploy, namespace);
}

main(doIt);