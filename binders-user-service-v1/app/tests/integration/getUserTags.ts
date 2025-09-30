import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const userClientFactory = new ClientFactory(config, UserServiceClient, "v1");

describe("getUserTags", () => {

    it("returns an empty array when the user has no tags", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await userClientFactory.createBackend();

            const tags = await client.getUserTags(user.id);

            expect(tags.length).toBe(0);
        });
    });

    it("returns all user tags when no filter is specified", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, {
                name: "myTag",
                context: "myContext",
                type: "string",
                value: "Some random value"
            })
            const client = await userClientFactory.createBackend();

            const tags = await client.getUserTags(user.id);

            expect(tags.length).toBe(1);
            expect(tags[0].value).toBe("Some random value");
        });
    });

    it("returns only tags matching the filter", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, {
                name: "myTag",
                context: "myContext",
                type: "string",
                value: "Some random value"
            });
            await fixtures.users.addTag(user.id, {
                name: "myTag2",
                context: "myContext2",
                type: "string2",
                value: "Some random value2"
            });
            const client = await userClientFactory.createBackend();

            const tags = await client.getUserTags(user.id, { name: "myTag", context: "myContext" });

            expect(tags.length).toBe(1);
            expect(tags[0].value).toBe("Some random value");
        });
    });

    it("ignores filter unwanted filter options", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, {
                name: "myTag",
                context: "myContext",
                type: "string",
                value: "Some random value"
            });
            const client = await userClientFactory.createBackend();

            const tags = await client.getUserTags(user.id, { name: "myTag", context: "myContext", value: "test" } as unknown);

            expect(tags.length).toBe(1);
            expect(tags[0].value).toBe("Some random value");
        });
    });
    
});
