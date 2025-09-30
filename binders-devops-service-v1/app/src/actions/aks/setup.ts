/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildAzCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { getAksCredentials, getSubscriptionForCluster } from "./cluster";
import { log } from "../../lib/logging";

/*
az login --service-principal -u $AZURE_SERVICEPRINCIPAL -p $AZURE_PASSWORD --tenant $AZURE_AD_TENANT
az account set --subscription $AZURE_SUBSCRIPTION
az aks install-cli
az aks get-credentials -g myResourceGroup -n myClusterName
*/

const runAzCommand = async (args) => {
    await buildAndRunCommand(() =>  buildAzCommand(args));
};

export const doAzureLogin = async (login, password, tenant) => {
    try {
        await runAzCommand([
            "login", "--service-principal",
            "-u", login,
            "-p", password,
            "--tenant", tenant
        ]);
        console.log("SUCCESSFULL AZ LOGIN");
    } catch (ex) {
        console.error("FAILED TO DO AZ LOGIN");
        console.error(ex);
    }
};

export const doACRLogin = async () => {
    // tslint:disable:no-console
    try {
        await runAzCommand([
            "acr", "login", "--name", "binders", "--expose-token"
        ]);
        console.log("SUCCESSFULL ACR LOGIN");
    } catch (ex) {
        console.error("FAILED TO DO ACR LOGIN");
        console.error(ex);
    }
    // tslint:enable:no-console
};

// const setupACRLogin = async () => {
//     await doACRLogin();
//     setInterval(
//         doACRLogin,
//         3600 * 1000
//     );
// };


export const setAzureSubscription = (subscription) => {
    return runAzCommand(["account", "set", "--subscription", subscription]);
};

export const installAKSCli = () => runAzCommand(["aks", "install-cli"]);

export const setup = async (
    azureTenantId, azureSubscription, clusterName, servicePrincipal, servicePrincipalPassword,
) => {
    log("Logging into azure");
    await doAzureLogin(servicePrincipal, servicePrincipalPassword, azureTenantId);
    log(`Updating azure subscription to ${azureSubscription}`);
    await setAzureSubscription(azureSubscription);
    // log("Logging into the ACR");
    // await setupACRLogin();
    log(`Fetching the kubectl config for ${clusterName}`);
    await runGetKubeCtlConfig(clusterName, true);
};

export const setupDev = async (azureTenantId: string, servicePrincipal: string, servicePrincipalPassword: string) => {
    log("Logging into azure");
    await doAzureLogin(servicePrincipal, servicePrincipalPassword, azureTenantId);
}

export const setupAksContext = async (azureTenantId, clusterName, servicePrincipal, servicePrincipalPassword) => {
    log("Logging into azure");
    await doAzureLogin(servicePrincipal, servicePrincipalPassword, azureTenantId);
    const azureSubscription = getSubscriptionForCluster(clusterName)
    log("Updating azure subscription");
    await setAzureSubscription(azureSubscription);
    await getAksCredentials(clusterName)
    log("Fetching the kubectl config");
    await runGetKubeCtlConfig(clusterName, true);

}