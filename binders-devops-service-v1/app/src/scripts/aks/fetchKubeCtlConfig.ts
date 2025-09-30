import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

interface IFetchConfigParams {
    admin: boolean;
    clusterName: string;
}
const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        admin: {
            long: "admin",
            description: "Fetch admin credentials",
            kind: OptionType.BOOLEAN,
            default: false
        }
    };
    const parser = new CommandLineParser("openDashboardTunnel", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse()) as IFetchConfigParams;
};


main( async () => {
    const { admin, clusterName } = getOptions();
    await runGetKubeCtlConfig(clusterName, admin);
});