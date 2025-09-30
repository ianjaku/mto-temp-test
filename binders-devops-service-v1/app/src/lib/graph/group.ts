import { ClientSecretCredential } from "@azure/identity";
import { GraphApiClient } from "@binders/binders-service-common/lib/graph/graphApiClient";
import { Group } from "@microsoft/microsoft-graph-types";


export class GroupsClient extends GraphApiClient {
    constructor(credential: ClientSecretCredential) {
        super(credential)
    }
    async listGroups(): Promise<Group[]> {

        const groups = await this.client.api("/groups")
            .get();
        if (groups?.value && groups.value.length > 0) {
            return groups.value
        }

        return null
    }

    async getGroup(displayName: string): Promise<Group> {
        const groups = await this.listGroups()
        return groups.find(group => group.displayName === displayName)
    }
}