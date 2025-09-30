import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { FEATURE_DUPLICATE_ACLS } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";


const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

describe("Duplicate", () => {
    it("duplicates all resource acls to the new document", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            await fixtures.enableFeatures([FEATURE_DUPLICATE_ACLS]);
            const nonGroupUser = await fixtures.users.create();
            const groupUser = await fixtures.users.create();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, groupUser.id);
            const rootColl = await fixtures.items.getOrCreateRootCollection();
            const doc = await fixtures.items.createDocument(
                {
                    title: "Some title",
                    languageCode: ["en"],
                    chunkTexts: ["one"]
                }, {
                    publish: true,
                    addToRoot: true,
                }
            );
            await fixtures.authorization.assignItemRole(doc.id, group.id, "Reader");
            await fixtures.authorization.assignItemRole(doc.id, nonGroupUser.id, "Reader");

            const client = await clientFactory.createBackend();
            const duplicatedDoc = await client.duplicateBinder(doc, rootColl.id, fixtures.getAccountId(), fixtures.getAccountId());

            const nonGroupUserPermissions = await fixtures.authorization.getItemResourcePermissions(duplicatedDoc.id, nonGroupUser.id);
            expect(nonGroupUserPermissions).toContain(PermissionName.VIEW);

            const groupUserPermissions = await fixtures.authorization.getItemResourcePermissions(duplicatedDoc.id, groupUser.id);
            expect(groupUserPermissions).toContain(PermissionName.VIEW);
        });
    });
});
