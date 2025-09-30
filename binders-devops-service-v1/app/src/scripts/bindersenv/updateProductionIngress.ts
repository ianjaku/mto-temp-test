import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { dumpFile } from "../../lib/fs";
import { main } from "../../lib/program";
import { runKubeCtlFile } from "../../lib/k8s";
import { toIngress } from "../../lib/k8s/ingress";

const doIt = async () => {
    const env = {
        isProduction: true,
        branch: "none-existing-branch",
        commitRef: "none-existing-commit",
        services: BINDERS_SERVICE_SPECS
    };
    const ingress = toIngress(env);
    const file = "/tmp/production-ingress.yml";
    await dumpFile(file, ingress);
    return runKubeCtlFile(file, false, PRODUCTION_NAMESPACE);
};

main( doIt );