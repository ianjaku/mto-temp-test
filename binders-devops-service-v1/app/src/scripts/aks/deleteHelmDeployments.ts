/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildHelmCommand, buildKubeCtlCommand } from "../..//lib/commands";
import { main } from "../../lib/program"


interface HelmDeployment {
    chart: string
    name: string
}

const STAGING_CHART = "bindersStagingInfrastructure-0.0.1"


const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        chartFilter: {
            long: "chart",
            short: "c",
            description: "The chart from which helm deplyments should be removed'",
            kind: OptionType.STRING,
            required: false,
            default: STAGING_CHART
        }

    };
    const parser = new CommandLineParser("createProductionTLSSecret", programDefinition);
    return parser.parse();
};

async function getHelmDeployments(): Promise<HelmDeployment[]> {
    const { output } = await buildAndRunCommand(() => buildHelmCommand(["ls", "-a", "--tls"]));
    const [_, ...deployments] = output.trim().split("\n")
    console.log(deployments)
    return deployments.map(d => {
        const columns = d.split("\t")
        const name = columns[0].trim()
        const chart = columns[4].trim()
        return {
            chart,
            name
        }
    })
}

async function getK8sNamescpaces() {
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(["get", "namespaces"]))
    const [_, ...namespaces] = output.trim().split("\n")
    return namespaces.reduce((acc, curr) => {
        const namespace = curr.split(" ")[0].trim()
        acc[namespace] = true
        return acc;
    }, {})
}

async function deleteHelmDeplyoment(deploymentName: string) {
    await buildAndRunCommand(() => buildHelmCommand(["delete", "--purge", deploymentName, "--tls"]))
}

const doIt = async () => {
    const { chartFilter } = getOptions()
    const helmDeployments = await getHelmDeployments()
    const k8sNamespaces = await getK8sNamescpaces()

    for (const { name, chart } of helmDeployments) {
        if (!k8sNamespaces[name] && chart === chartFilter) {
            console.log(`Deleting deployment ${name} from chart ${chart}`)
            deleteHelmDeplyoment(name)
        }
    }
}

main(doIt)