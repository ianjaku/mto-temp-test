import { getAKSCluster } from "../../actions/aks/cluster";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { setup } from "../../actions/aks/setup";

function getAzureSubscription(isProduction: boolean): string {
    if (!isProduction) {
        log(`Using non-prod subscription ${process.env.NON_PROD_SUBSCRIPTION}`)
        return process.env.NON_PROD_SUBSCRIPTION
    }
    log(`Using prod subscription: ${process.env.PROD_SUBSCRIPTION}`)
    return process.env.PROD_SUBSCRIPTION
}


const getOptions = async () => {
    const isProduction = process.argv[2] === "production";
    log(`isProduction ${isProduction}`)
    const options = {
        servicePrincipal: process.env.PIPELINE_AZURE_SP_LOGIN,
        servicePrincipalPassword: process.env.PIPELINE_AZURE_SP_PASSWORD,
        azureTenantId: process.env.AZURE_TENANT_ID,
        azureSubscription: getAzureSubscription(isProduction),
        clusterName: getAKSCluster(isProduction)
    };
    log(`Using AKS cluster ${options.clusterName}`);
    const missing = [];
    for (const optionKey in options) {
        if (!options[optionKey]) {
            missing.push(optionKey);
        }
    }
    if (missing.length > 0) {
        log(`!!! Missing environment variable(s) for ${missing.join(", ")}`);
        process.exit(1);
    }
    return options;
};

main(async () => {
    const { azureTenantId, azureSubscription, clusterName, servicePrincipal, servicePrincipalPassword } = await getOptions();
    await setup(azureTenantId, azureSubscription, clusterName, servicePrincipal, servicePrincipalPassword);
});