import {
    IUserAction,
    UserActionType
} from  "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    TrackingServiceClient,
    "v1"
);

describe("multiInsertUserActions", () => {
    it("Only adds duplicate user actions once", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.createAdmin();

            const action: IUserAction<null> = {
                accountId: fixtures.getAccountId(),
                userId: user.id,
                userActionType: UserActionType.CHECKLIST_COMPLETED,
                start: new Date(),
                end: new Date(),
                data: null,
            };
            await client.multiInsertUserAction([action, action], fixtures.getAccountId())

            await new Promise(resolve => setTimeout(resolve, 1000));
            const result = await client.findUserActions({
                accountId: fixtures.getAccountId(),
            });
            expect(result.userActions.length).toBe(1);
        });
    });

    it("doesn't add duplicate user actions when they are sent in separate requests", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.createAdmin();
            const action: IUserAction<null> = {
                accountId: fixtures.getAccountId(),
                userId: user.id,
                userActionType: UserActionType.CHECKLIST_COMPLETED,
                start: new Date(),
                end: new Date(),
                data: null,
            };
            await client.multiInsertUserAction([action], fixtures.getAccountId())
            await client.multiInsertUserAction([action], fixtures.getAccountId())

            await new Promise(resolve => setTimeout(resolve, 1000));
            const actions = await client.findUserActions({
                accountId: fixtures.getAccountId(),
            });
            expect(actions.userActions.length).toBe(1);
        });
    });
});
