import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getDeployments } from "../../actions/bindersenv/deployment";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

const restartDeployment = async (namespace: string, deploymentName: string) => {
    const args = ["rollout", "restart", "--namespace", namespace, "deployment", deploymentName]
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
}

const getBackendDeploymentsToRestart = async (namespace: string) => {
    const deploys = await getDeployments(namespace)
    return deploys
        .filter(d => d.activeDeployment)
        .filter(d => !d.spec.isFrontend)
        .map(d => `${d.activeDeployment.branch}-${d.spec.name}-${d.spec.version}-${d.activeDeployment.commitRef}-deployment`)

}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespaces",
            kind: OptionType.STRING,
            required: true
        },
    }
    const parser = new CommandLineParser("MaintenanceOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { namespace } = (<any>parser.parse())
    return {
        namespace
    }
}

const doIt = async () => {
    const { namespace } = getOptions()
    const deploymentsToRestart = await getBackendDeploymentsToRestart(namespace)
    const result = []
    for (const deploy of deploymentsToRestart) {
        const r = restartDeployment(namespace, deploy)
        result.push(r)
    }

    await Promise.all(result).catch(
        (err) => { log(err) }
    )
}

main(doIt)