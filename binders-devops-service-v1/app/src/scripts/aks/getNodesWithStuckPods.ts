/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { listPods } from "../../actions/k8s/pods";
import { main } from "../../lib/program";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            description: "The k8s namespace",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("setupSSHAccess", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const acceptedPhases = [
    "Running",
    "Succeeded"
];

const getNodesWithStuckPods = async (namespace: string) => {
    const allPods = await listPods("", namespace);
    const pods = allPods
        .filter(p => (!acceptedPhases.find(ph => ph === p.status.phase)) || p.status.reason === "NodeLost");

    const result = {};
    pods.forEach(pod => {
        const phase = pod.status.phase;
        if (!result[phase]) {
            result[phase] = [];
        }
        result[phase].push(pod);
    });
    return result;
};

// tslint:disable:no-console

const doIt = async () => {
    const { namespace } = getOptions();
    const stuck = await getNodesWithStuckPods(namespace);
    const byNode = {};
    for (const state in stuck) {
        const pods = stuck[state];
        pods.forEach( p => {
            const node = p.spec.nodeName;
            if (! (node in byNode)) {
                byNode[node] = [];
            }
            byNode[node].push(p);
        });
    }
    for (const n in byNode) {
        console.log(`${n}: ${byNode[n].length} stuck pods`);
    }
};

main(doIt);