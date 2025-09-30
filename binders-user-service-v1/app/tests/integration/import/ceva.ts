import { CevaTestUser, CevaUser } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    FEATURE_CEVA,
    FEATURE_GROUP_OWNERS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import {
    TestUserFactory
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { randomBytes } from "crypto";

const config = BindersConfig.get();

const globalFixtures = new TestFixtures(config);
const userClientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

const accountClientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

const TEST_DPT1 = "Test Department 1";
const TEST_DPT2 = "Test Department 2";
const TEST_ORG1 = "Test Org 1";
const TEST_ORG2 = "Test Org 2";
const TEST_SERVICE1 = "Test Service 1";
const TEST_SERVICE2 = "Test Service 2";

function getTestUsers(): CevaTestUser[] {
    const tagPrefix = randomBytes(6).toString("hex");
    return [
        {
            department: TEST_DPT1,
            employeeId: "123456",
            firstName: "John",
            lastName: "Doe",
            organization: TEST_ORG1,
            service: TEST_SERVICE1,
            tagPrefix
        },
        {
            department: TEST_DPT2,
            employeeId: "789012",
            firstName: "Jane",
            lastName: "Doe",
            organization: TEST_ORG2,
            service: TEST_SERVICE2,
            tagPrefix
        }
    ];
}

function isGroupMember(user: User, group: UsergroupDetails) {
    const { members } = group;
    return members.some(m => m.id === user.id);
}

function assertUserTag(user: User, tagName: string, tagValue: string, prefix: string) {
    const fullTagName = `${prefix}${tagName}`;
    const tag = user.userTags?.find(t => t.name === fullTagName);
    expect(tag).toBeDefined();
    expect(tag.value).toEqual(tagValue);
}

async function withTestAccount(callback: (fixtures: TestAccountFixtures) => Promise<void>) {
    return globalFixtures.withFreshAccount(async (fixtures) => {
        await fixtures.enableFeatures(
            [FEATURE_CEVA, FEATURE_GROUP_OWNERS]
        );
        await callback(fixtures);
    });
}

describe("basic ceva import", () => {
    it("should only be allowed when the feature flag is on", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const userClient = await userClientFactory.createBackend();
            await expect(userClient.importCevaUsers([], accountId, true)).rejects.toThrow();
        });
    });

    it("should import a list of ceva users", () => {
        const cevaUsers: CevaTestUser[] = getTestUsers();
        return withTestAccount(async (fixtures) => {
            const userClient = await userClientFactory.createBackend();
            const accountClient = await accountClientFactory.createBackend();
            const accountId = fixtures.getAccountId();
            await userClient.createGroup(accountId, TEST_SERVICE1);
            await userClient.createGroup(accountId, TEST_SERVICE2);
            await userClient.createGroup(accountId, TEST_ORG1);
            await userClient.createGroup(accountId, TEST_ORG2);

            await userClient.importCevaUsers(cevaUsers, accountId, true);

            // Assert account memberships
            const { members } = await accountClient.getAccount(accountId);
            expect(members.length).toBe(3);
            const users = await userClient.getUsers(members);
            const cevaJohn = cevaUsers.find(u => u.firstName === "John");
            const john = users.find(u => u.firstName === "John");
            const cevaJane = cevaUsers.find(u => u.firstName === "Jane");
            const jane = users.find(u => u.firstName === "Jane");

            // Assert group memberships
            const groups = await userClient.getGroups(accountId);
            const groupsWithDetails = await userClient.multiGetGroupMembers(accountId, groups.map(g => g.id));
            const org1 = groupsWithDetails.find(g => g.group.name === TEST_ORG1);
            const org2 = groupsWithDetails.find(g => g.group.name === TEST_ORG2);
            const service1 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE1);
            const service2 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE2);
            expect(isGroupMember(john, org1)).toBe(true);
            expect(isGroupMember(john, org2)).toBe(false);
            expect(isGroupMember(john, service1)).toBe(true);
            expect(isGroupMember(john, service2)).toBe(false);
            expect(isGroupMember(jane, org1)).toBe(false);
            expect(isGroupMember(jane, org2)).toBe(true);
            expect(isGroupMember(jane, service1)).toBe(false);
            expect(isGroupMember(jane, service2)).toBe(true);

            // Assert tags
            const [user1WithTags, user2WithTags] = await userClient.findUserDetailsForIds([
                john.id,
                jane.id
            ]);
            const [johnWithTags, janeWithTags] = user1WithTags.firstName === "John" ?
                [user1WithTags, user2WithTags] :
                [user2WithTags, user1WithTags];
            expect(johnWithTags.userTags.length).toBe(4);
            assertUserTag(johnWithTags, "organization", cevaJohn.organization, cevaJohn.tagPrefix);
            assertUserTag(johnWithTags, "employeeId", cevaJohn.employeeId, cevaJohn.tagPrefix);
            assertUserTag(johnWithTags, "service", cevaJohn.service, cevaJohn.tagPrefix);
            assertUserTag(janeWithTags, "organization", cevaJane.organization, cevaJane.tagPrefix);
            assertUserTag(janeWithTags, "employeeId", cevaJane.employeeId, cevaJane.tagPrefix);
            assertUserTag(janeWithTags, "service", cevaJane.service, cevaJane.tagPrefix);

        });
    });
    it("group owners should only import into their groups", async () => {
        const cevaUsers: CevaUser[] = getTestUsers();
        return withTestAccount(async (fixtures) => {
            const userClientBackend = await userClientFactory.createBackend();

            const accountId = fixtures.getAccountId();
            const testUserFactory = new TestUserFactory(config, accountId);
            const groupOwner = await testUserFactory.create(
                {
                    firstName: "Group",
                    lastName: "Owner",
                }
            )
            const service1Group = await userClientBackend.createGroup(accountId, TEST_SERVICE1);
            await userClientBackend.updateGroupOwners(accountId, service1Group.id, [groupOwner.id]);
            await userClientBackend.createGroup(accountId, TEST_SERVICE2);
            await userClientBackend.createGroup(accountId, TEST_ORG1);
            await userClientBackend.createGroup(accountId, TEST_ORG2);

            const userClientFrontend = await userClientFactory.createForFrontend(groupOwner.id);
            await userClientFrontend.importCevaUsers(cevaUsers, accountId, true);

            const accountClient = await accountClientFactory.createBackend();

            // Assert account memberships
            const { members } = await accountClient.getAccount(accountId);
            expect(members.length).toBe(3);
            const users = await userClientBackend.getUsers(members);
            const john = users.find(u => u.firstName === "John");
            const groups = await userClientBackend.getGroups(accountId);
            const groupsWithDetails = await userClientBackend.multiGetGroupMembers(accountId, groups.map(g => g.id));
            const org1 = groupsWithDetails.find(g => g.group.name === TEST_ORG1);
            const org2 = groupsWithDetails.find(g => g.group.name === TEST_ORG2);
            const service1 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE1);
            const service2 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE2);
            expect(isGroupMember(john, org1)).toBe(false);
            expect(isGroupMember(john, org2)).toBe(false);
            expect(isGroupMember(john, service1)).toBe(true);
            expect(isGroupMember(john, service2)).toBe(false);
        });
    })
});

describe("append ceva users", () => {
    it("should add the user & keep existing users", () => {
        const cevaUsers: CevaTestUser[] = getTestUsers();
        return withTestAccount(async (fixtures) => {
            const userClient = await userClientFactory.createBackend();
            const accountClient = await accountClientFactory.createBackend();
            const userClientBackend = await userClientFactory.createBackend();

            const accountId = fixtures.getAccountId();
            await userClient.createGroup(accountId, TEST_SERVICE1);
            await userClient.createGroup(accountId, TEST_SERVICE2);
            await userClient.createGroup(accountId, TEST_ORG1);
            await userClient.createGroup(accountId, TEST_ORG2);

            await userClient.importCevaUsers(cevaUsers, accountId, true);

            const { members } = await accountClient.getAccount(accountId);
            expect(members.length).toBe(3);

            const newCevaUser = {
                department: TEST_DPT1,
                employeeId: "new_employee_id",
                firstName: "Foo",
                lastName: "Bar",
                organization: TEST_ORG1,
                service: TEST_SERVICE1,
                tagPrefix: "",
            };

            await userClient.importCevaUsers([newCevaUser], accountId, false);

            const { members: newMembers } = await accountClient.getAccount(accountId);
            expect(newMembers.length).toBe(4);

            const users = await userClientBackend.getUsers(newMembers);
            const john = users.find(u => u.firstName === "John");
            const foo = users.find(u => u.firstName === "Foo");
            const groups = await userClientBackend.getGroups(accountId);
            const groupsWithDetails = await userClientBackend.multiGetGroupMembers(accountId, groups.map(g => g.id));
            const org1 = groupsWithDetails.find(g => g.group.name === TEST_ORG1);
            const org2 = groupsWithDetails.find(g => g.group.name === TEST_ORG2);
            const srv1 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE1);
            const srv2 = groupsWithDetails.find(g => g.group.name === TEST_SERVICE2);
            expect(isGroupMember(foo, org1)).toBe(true);
            expect(isGroupMember(foo, org2)).toBe(false);
            expect(isGroupMember(foo, srv1)).toBe(true);
            expect(isGroupMember(foo, srv2)).toBe(false);
            expect(isGroupMember(john, srv1)).toBe(true);
            expect(isGroupMember(john, org1)).toBe(true);
        });
    });
});
