import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { log } from "../../lib/logging";

export const DEVELOPERS_AD_GROUP = "development"
export const DEVOPS_AD_GROUP = "devops"
export const EXTERNAL_READERS = "external-readers"
export const K8S_ADMIN_AD_GROUP = "kubernetes-admins"

const removeWhitespaces = (str: string): string => str.replace(/\s+/g, "")

export async function getAzureResouceId(args: string[]): Promise<string> {
    try {
        const result = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
        return removeWhitespaces(result?.output)
    } catch (error) {
        log(error)
        return null
    }
}

export async function getAdGroupId(name: string): Promise<string> {
    const args = ["ad", "group", "show", "--group", name, "--query", "id", "--output", "tsv"]
    return getAzureResouceId(args)
}

export async function createAdGroup(name: string): Promise<string> {
    const args = ["ad", "group", "create", "--display-name", name, "--mail-nickname", name, "--query", "id", "--output", "tsv"]
    return getAzureResouceId(args)
}

export async function maybeCreateAdGroup(name: string): Promise<string> {
    const id = await getAdGroupId(name)
    return id === null ? createAdGroup(name) : id
}

export async function getK8sClusterObjectId(name: string, resourceGroup: string): Promise<string> {
    const args = ["aks", "show", "--name", name, "--resource-group", resourceGroup, "--query", "id", "--output", "tsv"]
    return getAzureResouceId(args)
}

export async function createRoleAssignment(group: string, scope: string): Promise<void> {
    const role = "Azure Kubernetes Service Cluster User Role"
    const args = ["role", "assignment", "create", "--assignee", group, "--role", role, "--scope", scope]
    try {
        await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    } catch (error) {
        log(error)
        return null
    }
}