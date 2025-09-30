import { Command } from "commander";
import { createKubeConfig } from "../../actions/k8s-client/util";
import { createOrUpdateSecret } from "../../actions/k8s/secrets";
import { main } from "../../lib/program";
import { panic } from "@binders/client/lib/util/cli";




const SCRIPT_NAME = "Update AWS Certificate Sync Credentials Secret"
const SECRET_NAME = "aws-cert-sync-credentials";
const program = new Command();
program
    .name(SCRIPT_NAME)
    .description("This script is responsible uploading tls certificate into AWS")
    .option("-n, --namespace <namespace>", "Namespace in which script will fetch tls secret")
    .option("-c, --clusterName <clusterName>", "AKS cluster name")
program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    clusterName?: string;
    namespace?: string;
};


main(async () => {
    if (!options.clusterName) {
        panic("You need to provide aks clusterName e.g: -n clusterName")
    }

    if (!options.namespace) {
        panic("You need to provide some namespace e.g: -n develop")
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        panic("ERROR: Environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.")
    }
    const kubeConfig = await createKubeConfig(options.clusterName, { useAdminContext: true });

    try {
        await createOrUpdateSecret(kubeConfig, SECRET_NAME, options.namespace, {
            AWS_ACCESS_KEY_ID: accessKeyId,
            AWS_SECRET_ACCESS_KEY: secretAccessKey
        })
    } catch (error) {
        panic(error)
    }
})