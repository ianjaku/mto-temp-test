/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { IK8SNode, getK8SNodes } from "../../actions/k8s/nodes";
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { main } from "../../lib/program";
import {
    sendNotificationToPushgateway
} from "@binders/binders-service-common/lib/monitoring/prometheus";
import { setupAksAccess } from "../../service/aks/access";

const bindersConfig = BindersConfig.get();

const getOptions = (): { aksClusterName: string } => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The name of the aks cluster",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("printNodeLabels", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<unknown>parser.parse()) as any;
};

const NO_DAYS_TO_EXPIRY = 30

const getNodeCert = async ({ name }: IK8SNode) => {
    console.log(`Connecting to node ${name}`)
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(["node-shell", name, "--", "bash", "-c", "openssl x509 -in /etc/kubernetes/certs/apiserver.crt -text | grep \"Not After\""]))
    console.log(output)
    return output
}

const getDateFromOutput = (output: string) => {
    const [_, date] = output.split(" : ")
    const [month, day, _time, year,] = date.toString().split(" ");
    const parsebleDate = [month, day, year].join(" ");
    return new Date(parsebleDate)
}

const calculateDatesDiff = (endDate: Date, startDate: Date = new Date()) => {
    const diffInMs = endDate.valueOf() - startDate.valueOf()
    return diffInMs / (1000 * 60 * 60 * 24);
}


const processNode = async (node: IK8SNode) => {
    const output = await getNodeCert(node)
    const nodeCertExpiryDate = getDateFromOutput(output)

    if (calculateDatesDiff(nodeCertExpiryDate, new Date()) < NO_DAYS_TO_EXPIRY) {
        console.log(`apiserver.crt for node ${node.name} will expire soon: ${nodeCertExpiryDate}`)
        await sendNotificationToPushgateway(bindersConfig, "k8s-node-cert-expired")
    } else {
        console.log(`Cert will expire in more than ${NO_DAYS_TO_EXPIRY} days`)
    }
}

const doIt = async () => {
    const { aksClusterName } = getOptions();
    const config = BindersConfig.get();
    await setupAksAccess(config, aksClusterName)
    await runGetKubeCtlConfig(aksClusterName);
    for (const node of await getK8SNodes()) {
        await processNode(node)
    }
}

main(doIt)