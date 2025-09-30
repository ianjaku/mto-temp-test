import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AuditLogType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    PublicApiServiceClient,
    "v1"
);

const accountClientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

const trackingClientFactory = new ClientFactory(
    config,
    TrackingServiceClient,
    "v1"
);

describe("auditMemberManagement", () => {
    it("generates an audit log when a member is added", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const admin = await fixtures.users.createAdmin();
            const accountId = fixtures.getAccountId();
            const publicApiClient = await clientFactory.createForPublicApi(admin.id, accountId);
            const newUser = await createUser(publicApiClient, accountId);

            const accountClient = await accountClientFactory.createBackend();
            await accountClient.addMember(accountId, newUser.userId, ManageMemberTrigger.INTEGRATION_TEST, undefined, admin.id);

            const trackingClient = await trackingClientFactory.createBackend();
            const logs = await getFilteredLogs(trackingClient, accountId, [newUser.userId], AuditLogType.ACCOUNT_MEMBER_ADDED);

            expect(logs).toEqual([
                expect.objectContaining({
                    logType: AuditLogType.ACCOUNT_MEMBER_ADDED,
                    accountId: accountId,
                    userId: admin.id,
                    data: {
                        userId: newUser.userId,
                        manageMemberTrigger: ManageMemberTrigger.INTEGRATION_TEST
                    }
                })]);
        });
    });

    it("generates an audit log when multiple members are added", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const admin = await fixtures.users.createAdmin();
            const accountId = fixtures.getAccountId();
            const publicApiClient = await clientFactory.createForPublicApi(admin.id, accountId);
            const newUser1 = await createUser(publicApiClient, accountId);
            const newUser2 = await createUser(publicApiClient, accountId);
            const newUserIds = [newUser1.userId, newUser2.userId];

            const accountClient = await accountClientFactory.createBackend();
            await accountClient.addMembers(accountId, newUserIds, ManageMemberTrigger.INTEGRATION_TEST, admin.id);

            const trackingClient = await trackingClientFactory.createBackend();
            const logs = await getFilteredLogs(trackingClient, accountId, newUserIds, AuditLogType.ACCOUNT_MEMBER_ADDED);

            expect(logs).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        logType: AuditLogType.ACCOUNT_MEMBER_ADDED,
                        accountId: accountId,
                        userId: admin.id,
                        data: {
                            userId: newUser1.userId,
                            manageMemberTrigger: ManageMemberTrigger.INTEGRATION_TEST
                        }
                    }),
                    expect.objectContaining({
                        logType: AuditLogType.ACCOUNT_MEMBER_ADDED,
                        accountId: accountId,
                        userId: admin.id,
                        data: {
                            userId: newUser2.userId,
                            manageMemberTrigger: ManageMemberTrigger.INTEGRATION_TEST
                        }
                    })
                ])
            );
        });
    });

    it("generates an audit log when a member is removed", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const admin = await fixtures.users.createAdmin();
            const accountId = fixtures.getAccountId();
            const publicApiClient = await clientFactory.createForPublicApi(admin.id, accountId);
            const newUser = await createUser(publicApiClient, accountId);
            await publicApiClient.deleteUser(accountId, newUser.userId);

            const accountClient = await accountClientFactory.createBackend();
            await accountClient.removeMember(accountId, newUser.userId, ManageMemberTrigger.INTEGRATION_TEST);

            const trackingClient = await trackingClientFactory.createBackend();
            const logs = await getFilteredLogs(trackingClient, accountId, [newUser.userId], AuditLogType.ACCOUNT_MEMBER_REMOVED);

            expect(logs).toEqual([
                expect.objectContaining({
                    logType: AuditLogType.ACCOUNT_MEMBER_REMOVED,
                    accountId: accountId,
                    data: {
                        userId: newUser.userId,
                        manageMemberTrigger: ManageMemberTrigger.INTEGRATION_TEST
                    }
                })]);
        });
    });
});

function createUser(publicApiClient: PublicApiServiceClient, accountId: string) {
    return publicApiClient.createUser(
        accountId,
        `newuser${`${Math.random()}`.substring(2)}@some-account.io`,
        "new user",
    );
}

async function getFilteredLogs(trackingClient: TrackingServiceClient, accountId: string, userIds: string[], auditLogType: AuditLogType) {
    return await trackingClient.findAuditLogs(accountId, auditLogType)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(logs => logs.filter((log: any) => userIds.includes(log.data.userId)))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(logs => logs.filter((log: any) => log.data.manageMemberTrigger === ManageMemberTrigger.INTEGRATION_TEST));
}
