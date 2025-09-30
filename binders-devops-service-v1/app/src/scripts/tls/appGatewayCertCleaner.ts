import {
    Certificate,
    deleteCertificate,
    listCertificates
} from "../../actions/azure/azureAppGateway";
import { createCoreV1Api, createKubeConfig } from "../../actions/k8s-client/util";
import { error, info } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { Config } from "@binders/client/lib/config";
import { NetworkManagementClient } from "@azure/arm-network";
import {
    createClientSecretCredentialFromConfig
} from "../../actions/azure/clientSecretCredentials";
import { setupAksAccess } from "../../service/aks/access";

async function getK8sNamespaces(clusterName: string) {
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    const k8sApi = await createCoreV1Api(kc);
    const response = await k8sApi.listNamespace()
    return response.items.map(item => item.metadata.name);
}

async function getNetworkClient(config: Config, subscriptionId: string): Promise<NetworkManagementClient> {
    const credential = createClientSecretCredentialFromConfig(config)
    return new NetworkManagementClient(credential, subscriptionId);
}

function extractNamespaceFromCertName(certName: string): string | null {
    // Validate that the certName starts with "cert-" and ends with "-tls-staging-secret"
    if (!certName.startsWith("cert-") || !certName.endsWith("-tls-staging-secret")) {
        return null;
    }

    const withoutPrefix = certName.substring(5);
    const withoutSuffix = withoutPrefix.substring(0, withoutPrefix.length - 19);

    if (!withoutSuffix) {
        return null;
    }

    return withoutSuffix;
}

function shouldDeleteCertificate(cert: Certificate, namespaces: string[]): boolean {
    const namespace = extractNamespaceFromCertName(cert.name)
    info(`Extracted k8s namespace: ${namespace}`)
    return !namespaces.includes(namespace)
}

const SUBSCRIPTION_ID = "df893890-4da6-47bc-8a71-2ec64776511a";
const RESOURCE_GROUP = "MC_binder-stg-k8s-rg_binder-stg-cluster_westeurope";
const APP_GATEWAY_NAME = "binder-stg-app-gw";
const SCRIPT_NAME = "cleanup-azure-tls-certs"
const CLUSTER_NAME = "binder-stg-cluster"
const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible cleaning dangling Azure App Gateway tls certificates")
    .option("-s, --subscription <subscription>", "Subsciption where Azure App Gateway is deployed", SUBSCRIPTION_ID)
    .option("-c, --clusterName <clusterName>", "AKS cluster name", CLUSTER_NAME)
    .option("-r, --resourceGroup <resourceGroup>", "Resource Group where Azure App Gateway is deployed",RESOURCE_GROUP)
    .option("-a, --appGatewayName <appGatewayName>", "Azure App Gateway resource name", APP_GATEWAY_NAME)
program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    appGatewayName?: string;
    clusterName?: string;
    resourceGroup?: string;
    subscription?: string;
};

async function main() {
    try {

        const config = BindersConfig.get();
        await setupAksAccess(config, options.clusterName)
        const namespaces = await getK8sNamespaces(options.clusterName)
        const networkClient = await getNetworkClient(config, options.subscription);
        const certsToProcess = await listCertificates(
            networkClient,
            options.resourceGroup,
            options.appGatewayName
        );

        info(`Found ${certsToProcess.length} cert(s) to process.`);
        let deletedCount = 0;
        for (const cert of certsToProcess) {
            if (shouldDeleteCertificate(cert, namespaces)) {
                info(`Starting deleting ${cert.name} tls cert`)
                const success = await deleteCertificate(
                    networkClient,
                    options.resourceGroup,
                    options.appGatewayName,
                    cert.name
                );
                if (success) {
                    deletedCount++;
                }
            } else {
                info(`Skipping certificate: ${cert.name} (does not meet deletion criteria)`);
            }
        }

        if (deletedCount > 0) {
            info(`Successfully deleted ${deletedCount} out of ${certsToProcess.length} certificates.`);
        }
    } catch (err) {
        error("An error occurred:", err);
        process.exit(1);
    }
}

main().catch(err => {
    error("Unhandled error:", err);
    process.exit(1);
});