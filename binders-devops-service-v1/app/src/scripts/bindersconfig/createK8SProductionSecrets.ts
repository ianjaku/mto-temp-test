import { createProductionK8SSecretFromFile } from "../../lib/bindersconfig";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

main(
    async () => {
        await runGetKubeCtlConfig(getProductionCluster(), true);
        await createProductionK8SSecretFromFile();
    }
);
