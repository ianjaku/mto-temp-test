import { BINDERS_SERVICE_SPECS, BINDERS_SERVICE_SPECS_BY_NAME } from "../../config/services";
import {
    IBindersEnvironment,
    extractServiceFromDeploymentName,
    parseDeploymentName,
    toServicePodSelectorLabel
} from "../../lib/bindersenvironment";
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { buildHPAConfig, createHPA, shouldCreateHPA } from "../../lib/k8s/hpa";
import { dumpYaml, yamlStringify } from "../../lib/yaml";
import { getDeployment, getDeployments } from "../../actions/k8s/deployments";
import { info, panic } from "@binders/client/lib/util/cli";
import { Command } from "commander";
import { createPDB } from "../../lib/k8s/podDistruptionBudget";
import { dumpFile } from "../../lib/fs";
import { main } from "../../lib/program";

const yamlDump = (content: unknown): string => yamlStringify(content, true);
const SCRIPT_NAME = "Create HPA for binders deployments";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Scipt checks if mongo is in running state and mongo server is responding")
    .option("-n, --namespace [namespace]", "Namespace where Horizontal Pod Autoscaler resources will be created")
    .option("-d, --deployment [deployment]", "Deployment for which Horizontal Pod Autoscale resource will be created")
    .option("-a, --all-deploys", "Flag will force creation of Horizontal Pod Autoscaler resources for each binders resource in given namespace")

program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    allDeploys?: boolean;
    deployment?: string;
    namespace?: string;
};

function getNumberOfReplicas(serviceName: string) {
    const service = BINDERS_SERVICE_SPECS_BY_NAME[serviceName]

    if (!service) {
        return { minReplicas: undefined, maxReplicas: undefined }
    }

    return { minReplicas: service.minReplicas, maxReplicas: service.maxReplicas }

}

function buildBindersEnvFromDeployment(deploymentName: string): IBindersEnvironment {
    const { branchName, commitRef } = parseDeploymentName(deploymentName)
    return {
        branch: branchName,
        prefix: branchName,
        commitRef,
        isProduction: true,
        services: BINDERS_SERVICE_SPECS
    }
}

async function processAllDeploys(namespace: string) {
    info(`Creating HPA resources for each deployment in namespace: ${namespace}`)
    const deployments = await getDeployments(namespace)
    const items = []
    for (const deploy of deployments) {
        const deploymentName = deploy.metadata.name
        const serviceName = extractServiceFromDeploymentName(deploymentName)
        if (shouldCreateHPA(serviceName)) {
            const { minReplicas, maxReplicas } = getNumberOfReplicas(serviceName)
            const hpaConfig = buildHPAConfig(deploymentName, maxReplicas, minReplicas)
            const hpa = createHPA(hpaConfig)
            items.push(yamlDump(hpa))
            const pdb = createPDB({
                deploymentName,
                maxUnavailable: 1,
                podSelector: toServicePodSelectorLabel(buildBindersEnvFromDeployment(deploymentName), BINDERS_SERVICE_SPECS_BY_NAME[serviceName])
            })
            items.push(yamlDump(pdb))
        }
    }
    const tmpFile = "/tmp/k8s-hpa"
    await dumpFile(tmpFile, items.join("---\n"))
    const args = ["apply", "-f", tmpFile, "--namespace", namespace];
    await buildAndRunCommand(() => buildKubeCtlCommand(args));
}

async function processSingleDeployment(deploymentName: string, namespace: string) {
    info(`Creating HPA resources for ${deploymentName} deployment in namespace: ${namespace}`)
    try {
        await getDeployment(deploymentName, namespace)
    } catch (error) {
        panic(`Deployment ${deploymentName} not found in namespace ${namespace}`)
    }
    const serviceName = extractServiceFromDeploymentName(deploymentName)
    if (shouldCreateHPA(serviceName)) {
        const { minReplicas, maxReplicas } = getNumberOfReplicas(serviceName)
        const hpaConfig = buildHPAConfig(deploymentName, maxReplicas, minReplicas)
        const hpa = createHPA(hpaConfig)
        const pdb = createPDB({
            deploymentName,
            maxUnavailable: 1,
            podSelector: toServicePodSelectorLabel(buildBindersEnvFromDeployment(deploymentName), BINDERS_SERVICE_SPECS_BY_NAME[serviceName])
        })
        await dumpAndApply(`/tmp/${deploymentName}-hpa`, hpa, namespace)
        await dumpAndApply(`/tmp/${deploymentName}-pdb`, pdb, namespace)
    } else {
        info(`Deployment ${deploymentName} either not exists in BINDERS_SERVICE_SPEC or has specify just 1 replicas.`)
    }
}

main(async () => {
    if (!options.namespace) {
        panic("You need to provide some namespace e.g: -n develop")
    }

    if (!options.deployment && options.allDeploys === undefined) {
        panic("You need to provide either specific deployment (with -d rel-october-24...) or pass --all-deploys flag")
    }

    if (options.allDeploys) {
        await processAllDeploys(options.namespace)
    }

    if (options.deployment) {
        await processSingleDeployment(options.deployment, options.namespace)
    }
})


async function dumpAndApply(filePath: string, data: unknown, namespace: string) {
    await dumpYaml(data, filePath);
    const args = ["apply", "-f", filePath, "--namespace", namespace];
    await buildAndRunCommand(() => buildKubeCtlCommand(args));
}