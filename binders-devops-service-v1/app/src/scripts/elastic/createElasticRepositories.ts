import { getProductionCluster, getStagingCluster } from "../../actions/aks/cluster";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getCurrentBranch } from "../../actions/git/branches";
import { isProduction } from "../../lib/environment";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { setupElasticRepositories } from "../../actions/elastic/backup";
import { shortenBranchName } from "../../lib/k8s";

main( async () => {
    const [cluster, namespace] = isProduction() ?
        [getProductionCluster(), PRODUCTION_NAMESPACE] :
        [getStagingCluster(), process.argv[2] || shortenBranchName(await getCurrentBranch())];
    if (!namespace) {
        log("For staging environments you need to specify a namespace");
        process.exit(1);
    }
    await runGetKubeCtlConfig(cluster, true);
    const elasticClusterName = "binders";
    await setupElasticRepositories(elasticClusterName, namespace);
});