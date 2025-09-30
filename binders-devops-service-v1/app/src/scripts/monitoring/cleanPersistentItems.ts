import { MONITORING_NAMESPACE } from "../../lib/bindersenvironment";
import { cleanPersistantItems } from "../../lib/storage";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const getOptions = () => {
    return {
        aksClusterName: getProductionCluster(),
        namespace: MONITORING_NAMESPACE
    }
}
main( async() => {
    const { aksClusterName, namespace } = getOptions();
    const releaseName = "binders-monitoring";
    await runGetKubeCtlConfig(aksClusterName);
    await cleanPersistantItems(aksClusterName, releaseName, namespace);
});