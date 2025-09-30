import { cleanServiceDeploy, getDeployments } from "../../actions/bindersenv/deployment";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { sequential } from "../../lib/promises";

const doIt = async () => {
    await runGetKubeCtlConfig(getProductionCluster());
    const deploys = await getDeployments(PRODUCTION_NAMESPACE);
    await sequential(d => cleanServiceDeploy(d, PRODUCTION_NAMESPACE, 1), deploys);
};

main(doIt);