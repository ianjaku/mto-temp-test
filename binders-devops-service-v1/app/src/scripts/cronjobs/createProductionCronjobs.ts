import { PRODUCTION_NAMESPACE, getConfigSecret } from "../../lib/bindersenvironment";
import { Command } from "commander";
import { createAccountCronjobs } from "../../lib/cronjobs/account";
import { createBindersCronjobs } from "../../lib/cronjobs/binders";
import { createDevopsCronjobs } from "../../lib/cronjobs/devops";
import { createImageCronjobs } from "../../lib/cronjobs/image";
import { createNotificationCronjobs } from "../../lib/cronjobs/notification";
import { createTrackingCronjobs } from "../../lib/cronjobs/tracking";
import { createUserCronjobs } from "../../lib/cronjobs/user";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { panic } from "@binders/client/lib/util/cli";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { shortenBranchName } from "../../lib/k8s";
import { verifySecretExists } from "../../actions/k8s/secrets";

const SCRIPT_NAME = "CreateProductionCronjobs";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible for creating cronjobs on production k8s cluster")
    .option("-b, --branch [branch]", "Branch parameters is used for attaching cronjobs to correct binders config")

program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    branch?: string;
};

const doIt = async () => {
    if (!options.branch) {
        panic("You need to provide some branch e.g: -n branch")
    }
    const clusterName = getProductionCluster()
    await runGetKubeCtlConfig(clusterName);

    const branch = shortenBranchName(options.branch)
    const secretName = getConfigSecret(branch)
    if (!await verifySecretExists(secretName, PRODUCTION_NAMESPACE)) {
        panic(`Secret ${secretName} not exists in namespace ${PRODUCTION_NAMESPACE}`)
    }

    await createAccountCronjobs(branch)
    await createBindersCronjobs(branch)
    await createDevopsCronjobs(branch)
    await createImageCronjobs(branch)
    await createNotificationCronjobs(branch)
    await createTrackingCronjobs(branch)
    await createUserCronjobs(branch)
}

main(doIt)