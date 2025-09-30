import {
    EnvironmentStatus,
    PRODUCTION_NAMESPACE,
} from  "../../lib/bindersenvironment";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { dumpFile } from "../../lib/fs";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { runKubeCtlFile } from "../../lib/k8s";
import { toOfflineIngress } from "../../lib/k8s/ingress";

const doIt = async () => {
    const env = {
        isProduction: true,
        branch: "none-existing-branch",
        commitRef: "none-existing-commit",
        services: BINDERS_SERVICE_SPECS,
        status: EnvironmentStatus.ONLINE
    };
    await runGetKubeCtlConfig(getProductionCluster());
    const ingress = toOfflineIngress(env);
    const file = "/tmp/offline-ingress.yml";
    await dumpFile(file, ingress);
    return runKubeCtlFile(file, false, PRODUCTION_NAMESPACE);
};

main( doIt );