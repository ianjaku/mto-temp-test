import { DEFAULT_ACCOUNT_USER_SPEC, DEFAULT_ITEM_HIERARCHY } from "./constants";
import { ServiceLocations, TestData } from "./contract";
import { ensureAccountAndUsers, ensureFeatures } from "./ensureAccount";
import { loadAccountUserSpec, loadConfigJSON, loadItemHierarchy } from "./helpers";
import { BackendCredentialServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import ensureHierarchy from "./ensureHierarchy";
import { v4 } from "uuid";

export const UNIQ_SUFFIX_LENGTH = 6;

export async function seedData(
    hierarchyName = DEFAULT_ITEM_HIERARCHY,
    accountUserSpecName = DEFAULT_ACCOUNT_USER_SPEC,
): Promise<TestData> {
    const uniqueSuffix = `${v4()}`.substr(0, UNIQ_SUFFIX_LENGTH);
    const itemHierarchy = loadItemHierarchy(hierarchyName, uniqueSuffix);
    const accountUserSpec = loadAccountUserSpec(accountUserSpecName, uniqueSuffix);
    const { accountId, domain, users, groups } = await ensureAccountAndUsers(accountUserSpec);
    await ensureHierarchy(accountId, domain, itemHierarchy);
    await ensureFeatures(accountId, accountUserSpec.account.features);
    const admin = accountUserSpec.account.members.find(m => m.isAdmin);
    const noAdminUsers = accountUserSpec.account.members.filter(m => !m.isAdmin);

    const config = BindersConfig.get();
    const credentialServiceClient = await BackendCredentialServiceClient.fromConfig(config, "acceptance-testing-setup");

    return {
        locations: loadConfigJSON<ServiceLocations>("serviceLocations"),
        seedData: {
            itemHierarchy,
            rootCollection: accountUserSpec.account.name,
            domain,
            accountId,
            users,
            groups,
        },
        credentials: {
            login: admin.login,
            password: admin.password,
            domain: accountUserSpec.account.domain,
            noAdminUsers,
        },
        clients: {
            credentials: credentialServiceClient,
        }
    };
}
