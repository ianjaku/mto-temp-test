/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createTLSSecret, deleteSecret, getDefaultTLSSecretName } from "../../actions/k8s/secrets";
import { getK8SNamespaces } from "../../actions/k8s/namespaces";
import { getStagingCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        directory: {
            long: "directory",
            short: "d",
            description: "The directory containing the PEM files 'privkey.pem' and 'fullchain.pem'",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("createStagingTLSSecret", programDefinition);
    return parser.parse();
};


main( async () => {
    const { directory } = getOptions();
    await runGetKubeCtlConfig(getStagingCluster());
    const key = `${directory}/privkey.pem`;
    const certificate = `${directory}/fullchain.pem`;
    const secretName = getDefaultTLSSecretName();
    const namespaces = (await getK8SNamespaces()).map(ns => ns.metadata.name);
    for (const ns of namespaces) {
        console.log(`Creating secret in ns ${ns}`);
        try {
            await deleteSecret(secretName, ns)
        } catch (err) {
            console.log("Cant delete secret:", err)
        }
        await createTLSSecret(secretName, key, certificate, ns);
    }
});