
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { listPods } from "../../actions/k8s/pods";
import { main } from "../../lib/program";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("openDashboardTunnel", programDefinition);
    return parser.parse();
};

main( async () => {
    const options = getOptions();
    const { clusterName } = options;
    await runGetKubeCtlConfig(clusterName as string, true);
    const pods = await listPods("kubernetes-dashboard-");
    if (pods.length < 1) {
        throw new Error("Could not find dashboard pods");
    }
    const dashboardPodName = pods[0].metadata.name;
    const args = ["port-forward", dashboardPodName, "9090", "-n", "kube-system"];
    await buildAndRunCommand( () => buildKubeCtlCommand(args));
});

