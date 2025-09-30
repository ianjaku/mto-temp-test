import { Command } from "commander";
import { cleanupAzureTlsCertificates } from "../../lib/cronjobs/devops/cleanupTlsCertificates";
import { cleanupStagingNamespaces } from "../../lib/cronjobs/devops/cleanupStagingNamespaces";
import { createStagingTlsCertificate } from "../../lib/cronjobs/devops/createStagingCertificate";
import { getConfigSecret } from "../../lib/bindersenvironment";
import { getStagingCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { panic } from "@binders/client/lib/util/cli";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { shortenBranchName } from "../../lib/k8s";
import { syncTlsSecretWithAws } from "../../lib/cronjobs/devops/syncTlsSecretWithAws";
import { verifySecretExists } from "../../actions/k8s/secrets";

const SCRIPT_NAME = "CreateStagingCronjobs";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible for creating cronjobs on staging k8s cluster")
    .option("-n, --namespace <namespace>", "Namespace where cronjobs will be deployed")
    .option("-b, --branch <branch>", "Branch parameters is used for attaching cronjobs to correct binders config")


program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    branch?: string;
    namespace?: string;
};


async function createDevopsCronjobs(branch: string, namespace: string): Promise<void> {
    const tags = {
        "devops-v1-service": "develop"
    }
    await syncTlsSecretWithAws(tags, branch, namespace, "staging")
    await createStagingTlsCertificate(tags, branch, namespace)
    await cleanupStagingNamespaces(tags, branch, namespace)
    await cleanupAzureTlsCertificates(tags, branch, namespace)
}
const doIt = async () => {
    if (!options.branch) {
        panic("You need to provide some branch e.g: -n branch")
    }

    if (!options.namespace) {
        panic("You need to provide some namespace e.g: -n develop")
    }
    const clusterName = getStagingCluster()
    await runGetKubeCtlConfig(clusterName);

    const branch = shortenBranchName(options.branch)
    const secretName = getConfigSecret(branch)
    if (!await verifySecretExists(secretName, options.namespace)) {
        panic(`Secret ${secretName} not exists in namespace ${options.namespace}`)
    }
    await createDevopsCronjobs(branch, options.namespace)
}

main(doIt)