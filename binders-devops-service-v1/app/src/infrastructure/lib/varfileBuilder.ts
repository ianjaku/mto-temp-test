import { GroupsClient, ServicePrincipalClient } from "../../lib/graph";
import { Env } from "../../lib/environment";
import { IDevopsConfig } from "../../lib/config";
import { dirname } from "path";
import { dumpJSON } from "../../lib/json";
import { loadTerraformOutput } from "../../lib/terraform";
import { realpathSync } from "fs";

const OWNER_IDENTITIES = {
    "dev": "external-devs",
    "staging": "development",
    "production": "development"
}
const APP_SERVICE_PRINCIPAL = {
    "dev": "bindersmedia-dev",
    "staging": "bindersmedia-staging",
    "production": "bindersmedia"
}

const currentDir = realpathSync(dirname(__filename));
const TF_VARS_FILEPATH = {
    "dev": `${currentDir}/../environments/dev/tfvars.json`,
    "staging": `${currentDir}/../environments/staging/tfvars.json`,
    "production": `${currentDir}/../environments/production/tfvars.json`
}

const K8S_TF_VARS_FILEPATH = {
    "staging": `${currentDir}/../k8s/staging/tfvars.json`,
    "production": `${currentDir}/../k8s/production/tfvars.json`
}

const MERGE_HANDLER_DISPLAY_NAME = "manualto-bitbucket-merge-handler"
const DEVOPS_PIPELINE_SERVICE_PRINCIPAL = "devops-pipeline"

export interface VarfileContent {
    app_sp_identity: string
    owner_identity_id: string
    kv_owner_identities: string[]
    kv_read_identities: string[]
    kv_secret: string
    devops_secret: string,
    devops_pipeline_service_principle_id: string,
    container_registry_id: string
}

export class TerraformVarfileBuilder {
    private environment: Env
    private groupsClient: GroupsClient
    private servicePrincipalClient: ServicePrincipalClient
    constructor(env: Env, groups: GroupsClient, sp: ServicePrincipalClient) {
        this.environment = env
        this.groupsClient = groups
        this.servicePrincipalClient = sp
    }

    async build(bindersSecrets: unknown, devopsSecrets: IDevopsConfig): Promise<VarfileContent> {
        const devopsServicePrincipalId = await this.getDevopsPipelineIdentity()
        const [appIdentity, ownerIdentity, kvOwnerIdentities] = await Promise.all([
            this.getApplicationServicePrincipalIdentity(),
            this.getOwnerIdentity(),
            this.getKeyVaultOwnerIdentities()
        ])
        const { elasticBindersPassword, elasticLogeventsPassword, grafanaAdminPassword, mongoMetricsPassword } = devopsSecrets
        const tfVarsContent = {
            app_sp_identity: appIdentity,
            owner_identity_id: ownerIdentity,
            kv_owner_identities: kvOwnerIdentities,
            kv_read_identities: [appIdentity],
            kv_secret: JSON.stringify(bindersSecrets),
            devops_secret: JSON.stringify(devopsSecrets),
            devops_pipeline_service_principle_id: devopsServicePrincipalId,
            container_registry_id: "/subscriptions/0370c56f-76ae-4423-8da8-c391ad332bf4/resourceGroups/docker-registry/providers/Microsoft.ContainerRegistry/registries/binders",
            elastic_binders_password: elasticBindersPassword,
            elastic_logevents_password: elasticLogeventsPassword,
            grafana_admin_password: grafanaAdminPassword,
            mongo_password: mongoMetricsPassword
        }

        if (this.environment === "production") {
            tfVarsContent["log_analytics_workspace_id"] = await this.getLogAnalyticsWorkspaceId()
        }

        await dumpJSON(tfVarsContent, TF_VARS_FILEPATH[this.environment], true)
        if (this.environment === "production" || this.environment === "staging") {
            await dumpJSON(tfVarsContent, K8S_TF_VARS_FILEPATH[this.environment], true)
        }
        return tfVarsContent
    }

    private async getOwnerIdentity(env?: Env): Promise<string> {
        const ownerIdentity = OWNER_IDENTITIES[env ? env : this.environment]
        const group = await this.groupsClient.getGroup(ownerIdentity)
        return group?.id
    }

    private async getLogAnalyticsWorkspaceId(): Promise<string> {
        const output = await loadTerraformOutput(this.environment)
        return output.logAnalyticsWorkspaceId.value
    }

    private async getKeyVaultOwnerIdentities(): Promise<string[]> {
        const mergeHandlerIdentity = (await this.servicePrincipalClient.getServicePrincipal(MERGE_HANDLER_DISPLAY_NAME))?.id
        const devopsPipelineObjectId = await this.getDevopsPipelineIdentity()

        if (!mergeHandlerIdentity) {
            throw new Error("Missing merge handler identity")
        }

        if (!devopsPipelineObjectId) {
            throw new Error("Missing devops pipeline identity")
        }

        const envOwnerIdentity = await this.getOwnerIdentity()
        if (this.environment === "staging" || this.environment === "production") {
            return [envOwnerIdentity, mergeHandlerIdentity, devopsPipelineObjectId]
        }

        return [envOwnerIdentity, await this.getOwnerIdentity("production"), mergeHandlerIdentity, devopsPipelineObjectId] //
    }

    private async getDevopsPipelineIdentity(): Promise<string> {
        return (await this.servicePrincipalClient.getServicePrincipal(DEVOPS_PIPELINE_SERVICE_PRINCIPAL))?.id
    }

    private async getApplicationServicePrincipalIdentity(): Promise<string> {
        const appServicePrincipalDispalyName = APP_SERVICE_PRINCIPAL[this.environment]
        return (await this.servicePrincipalClient.getServicePrincipal(appServicePrincipalDispalyName))?.id
    }
}