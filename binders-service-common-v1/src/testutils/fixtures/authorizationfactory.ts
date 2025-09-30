import {
    AssigneeGroup,
    AssigneeType,
    PermissionName,
    ResourcePermission,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { UnCachedBackendAuthorizationServiceClient } from "../../authorization/backendclient";

export type TestUserRole = "Admin" | "Editor" | "Reviewer" | "Contributor" | "Reader";

export class TestAuthorizationFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    public async assignItemRole(
        itemId: string,
        userOrGroupIdId: string,
        roleName: TestUserRole
    ): Promise<void> {
        const client = await UnCachedBackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const roles = await client.allRolesForAccount(this.accountId);
        const role = roles.find(role => role.name === roleName);
        if (role == null) {
            throw new Error(`Role for name ${roleName} not found`);
        }

        await this.assignItemPermission(
            itemId,
            userOrGroupIdId,
            role.permissions
        );
    }

    public async grantPublicReadAccess(
        accountId: string,
        itemId: string
    ): Promise<void> {
        const client = await UnCachedBackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await client.grantPublicReadAccess(accountId, itemId);
    }

    public async revokePublicReadAccess(
        accountId: string,
        itemId: string
    ): Promise<void> {
        const client = await UnCachedBackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await client.revokePublicReadAccess(accountId, itemId);
    }

    public async getItemResourcePermissions(
        itemId: string,
        userId: string,
    ): Promise<PermissionName[]> {
        const client = await UnCachedBackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await client.findResourcePermissions(userId, ResourceType.DOCUMENT, itemId, this.accountId);
    }

    public async assignItemPermission(
        itemId: string,
        userOrGroupId: string,
        permissions: PermissionName[]
    ): Promise<void> {
        const rules: ResourcePermission[] = [
            {
                permissions: permissions.map(p => ({
                    name: p,
                })),
                resource: {
                    ids: [itemId],
                    type: ResourceType.DOCUMENT
                },
            }
        ]
        const assignees: AssigneeGroup[] = [
            {
                ids: [userOrGroupId],
                type: userOrGroupId.startsWith("gid-") ? AssigneeType.USERGROUP : AssigneeType.USER
            }
        ]
        const client = await UnCachedBackendAuthorizationServiceClient.fromConfig(
            this.config,
            "testing"
        );

        await client.createAcl(
            `Testing acl for user or group ${userOrGroupId} on ${itemId}`,
            `Testing acl for user or group ${userOrGroupId} on ${itemId}`,
            this.accountId,
            assignees,
            rules,
            "rol-some-madeup-role"
        );
    }

}
