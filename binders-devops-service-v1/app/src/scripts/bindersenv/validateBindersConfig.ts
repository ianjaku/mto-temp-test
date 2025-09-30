import { buildBindersProductionConfig, buildBindersStagingConfig } from "../../lib/bindersconfig";
import { dumpJSON } from "../../lib/json";
import { getCurrentBranch } from "../../actions/git/branches";
import { getProductionCluster } from "../../actions/aks/cluster";
import { getSecretNameFromBranch } from "../../lib/secrets";
import { main } from "../../lib/program";
import validateConfig from "../../lib/validation";

main(async () => {
    const namespace = "develop"
    const branch = await getCurrentBranch()
    const secretName = getSecretNameFromBranch(branch)
    const stagingConfig = await buildBindersStagingConfig(namespace, secretName, true);
    await dumpJSON(stagingConfig, "/tmp/staging.json")
    validateConfig(stagingConfig, "staging");
    const productionConfig = await buildBindersProductionConfig(getProductionCluster(), secretName);
    await dumpJSON(productionConfig, "/tmp/prod.json")
    validateConfig(productionConfig, "production");
    const newProductionConfig = await buildBindersProductionConfig(getProductionCluster(), secretName);
    await dumpJSON(newProductionConfig, "/tmp/prod.json")
    validateConfig(newProductionConfig, "production");
});
