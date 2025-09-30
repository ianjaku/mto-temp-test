import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createTLSSecret, deleteSecret, getTLSSecretName } from "../../actions/k8s/secrets";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getProductionCluster } from "../../actions/aks/cluster";
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
    const parser = new CommandLineParser("createProductionTLSSecret", programDefinition);
    return parser.parse();
};


const getKeyAndCert = (dir) => {
    return {
        key: `${dir}/privkey.pem`,
        cert: `${dir}/fullchain.pem`
    };
};

main( async () => {
    const { directory } = getOptions();
    await runGetKubeCtlConfig(getProductionCluster(), true);
    const env = {
        isProduction: true,
        branch: undefined,
        commitRef: undefined,
        services: []
    };
    const secretName = getTLSSecretName(env);
    const { key, cert } = getKeyAndCert(directory);
    await deleteSecret(secretName, PRODUCTION_NAMESPACE);
    await createTLSSecret(secretName, key, cert, PRODUCTION_NAMESPACE);
});
