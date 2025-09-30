import { AuthorizationServiceContract, PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";

export interface AccountPermissionFlags {
    amIAdmin: boolean;
    canIEdit: boolean;
}

export async function getAccountsPermissionFlags(
    accountIds: string[],
    userId: string,
    azService: AuthorizationServiceContract,
): Promise<{ [accountId: string]: AccountPermissionFlags }> {

    const editorAccounts = await azService.getAccountsForEditor(userId);

    return accountIds.reduce<{ [accountId: string]: AccountPermissionFlags }>((reduced, accountId) => {
        const accountPermissions = editorAccounts.find(ea => ea.accountId === accountId);
        const amIAdmin = !!(accountPermissions && accountPermissions.permissions.find(p => {
            return p.permission === PermissionName.EDIT && p.resourceType === ResourceType.ACCOUNT;
        }) !== undefined);
        const canIEdit = !!(accountPermissions && accountPermissions.permissions.find(p => {
            return p.permission === PermissionName.EDIT && p.resourceType === ResourceType.DOCUMENT;
        }) !== undefined);
        reduced[accountId] = { amIAdmin, canIEdit };
        return reduced;
    }, {})


}