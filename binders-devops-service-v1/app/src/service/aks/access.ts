import { setup, setupAksContext, setupDev } from "../../actions/aks/setup";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { getSubscriptionForCluster } from "../../actions/aks/cluster";

const getObjects = (config: BindersConfig, keys: string[]) => {
    return keys.reduce( (reduced, key) => {
        const newObjectOption = config.getObject(key);
        if (newObjectOption.isNothing()) {
            return {
                objects: reduced.objects,
                missing: [ ...reduced.missing, key]
            };
        }
        return {
            objects: [...reduced.objects, newObjectOption.get()],
            missing: reduced.missing
        };
    }, {missing: [], objects: []});
};

const getAzureSecrets = (config: BindersConfig) => {
    const { missing, objects } = getObjects(config, [
        "azure.servicePrincipal.devops",
        "azure.subscription"
    ]);
    if (missing.length > 0) {
        throw new Error(`Missing configuration keys: ${missing.join(", ")}`);
    }
    const [devopsCredentials, azureSubscription] = objects;
    const secrets = {
        azureTenantId: azureSubscription.tenantId,
        azureSubscription: azureSubscription.id,
        servicePrincipal: devopsCredentials.login,
        servicePrincipalPassword: devopsCredentials.password
    };
    const missingValues = [];
    for (const k in secrets) {
        if (!secrets[k]) {
            missingValues.push(k);
        }
    }
    if (missingValues.length > 0) {
        throw new Error(`Missing config values: ${missingValues.join(", ")}`);
    }
    return secrets;
};


export const setupAccess = async (config: BindersConfig, clusterName: string): Promise<void> => {
    const { azureTenantId, servicePrincipal, servicePrincipalPassword } = getAzureSecrets(config);
    const subscription = getSubscriptionForCluster(clusterName);
    await setup(azureTenantId, subscription, clusterName, servicePrincipal, servicePrincipalPassword);
};

export const setupDevAccess = async (config: BindersConfig): Promise<void> => {
    const { azureTenantId, servicePrincipal, servicePrincipalPassword } = getAzureSecrets(config);
    await setupDev(azureTenantId, servicePrincipal, servicePrincipalPassword)
}

export const setupAksAccess = async (config: BindersConfig, clusterName: string): Promise<void> => {
    const { azureTenantId, servicePrincipal, servicePrincipalPassword } = getAzureSecrets(config);
    await setupAksContext(azureTenantId, clusterName, servicePrincipal, servicePrincipalPassword);
};
