import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { createSecret } from "../../actions/k8s/secrets";
import { getMongoCredentialsSecretName } from "../../actions/bindersenv/secrets";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const getOptions = () => {
    if (process.argv.length < 4) {
        throw new Error("Usage node <SCRIPT> <SERVICE_NAME> <SERVICE_PASWORD>");
    }
    return {
        serviceName: process.argv[2],
        password: process.argv[3]
    }
}

main(async() => {
    const { serviceName, password } = getOptions();
    await runGetKubeCtlConfig(getProductionCluster());
    const login = `${serviceName}_service`;
    const secretName = getMongoCredentialsSecretName(serviceName);
    await createSecret(secretName, {login, password}, PRODUCTION_NAMESPACE);
});
