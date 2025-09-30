import {
    Account,
    ManageMemberTrigger
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendImageServiceClient,
    BackendNotificationServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from  "../apiclient/backendclient";
import { BindersConfig } from "../bindersconfig/binders";
import UUID from "@binders/client/lib/util/uuid";
import { UnCachedBackendAuthorizationServiceClient } from "../authorization/backendclient";
import { log } from "../util/process";


const TEST_ACCOUNT_PREFIX = "test__";

export const createTestAccount = async (
    accountName: string
): Promise<Account> => {
    const config = BindersConfig.get();
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "testing");
    const uniqueSuffix = "__" + UUID.random().toString().slice(0, 15);
    return await accountClient.createAccount(
        TEST_ACCOUNT_PREFIX + accountName + uniqueSuffix,
        "standard",
        "2080-09-01",
        "2080-09-01",
        999
    );
}

export const deleteTestAccounts = async (
    partOfAccountName?: string,
    prefix = TEST_ACCOUNT_PREFIX
): Promise<void> => {
    const config = BindersConfig.get();
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "testing");
    const allAccounts = await accountClient.listAccounts();
    for (const acc of allAccounts) {
        if (!acc.name.startsWith(prefix)) continue;
        if (partOfAccountName && !acc.name.includes(partOfAccountName)) continue;
        log(`Deleting account ${acc.id} ${acc.name}`)
        await deleteAccount(acc.id);
    }
}

/**
 * This function is not perfect, it deletes most of an account but some remnants will remain.
 */
export const deleteAccount = async (accountId: string): Promise<void> => {
    const config = BindersConfig.get();
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "testing");
    const authClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(config, "testing");
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "testing");
    const userClient = await BackendUserServiceClient.fromConfig(config, "testing");
    const routingClient = await BackendRoutingServiceClient.fromConfig(config, "testing");
    const notificationClient = await BackendNotificationServiceClient.fromConfig(config, "testing", null);
    const imageClient = await BackendImageServiceClient.fromConfig(config, "testing");

    const account = await accountClient.getAccount(accountId);

    const groups = await userClient.getGroups(accountId);
    await Promise.all(
        groups.map(group => (
            userClient.removeGroup(accountId, group.id)
        ))
    );

    await Promise.all(
        account.members.map(async userId => {
            if (userId === "uid-testing") return;
            await accountClient.removeMember(accountId, userId, ManageMemberTrigger.INTEGRATION_TEST);
            const user = await userClient.getUser(userId);
            // Marking the e2e login as deleted makes it harder to query for it later on
            if (user?.login !== "e2e+123@manual.to") {
                await userClient.deleteUser(userId);
            }
        })
    );

    const domainFilters = await routingClient.getDomainFiltersForAccounts([accountId]);
    await Promise.all(
        domainFilters.map(({ domain }) => (
            routingClient.deleteDomainFilter(domain)
        ))
    );

    const binders = await repoClient.findBindersBackend({ accountId }, { maxResults: 9999 });

    await notificationClient.deleteAllForAccount(accountId);
    await repoClient.deleteAllForAccount(accountId);
    await authClient.deleteAllForAccount(accountId);

    await imageClient.hardDeleteVisuals({ binderIds: binders.map(b => b.id) });
    await accountClient.deleteAccount(accountId);
}
