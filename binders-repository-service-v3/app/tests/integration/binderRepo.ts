import { AssigneeType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { EDITOR_ROLE_ID } from "@binders/binders-service-common/lib/authorization/role";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import {
    UnCachedBackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";

const config = BindersConfig.get();

const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);
const routingClientFactory = new ClientFactory(
    config,
    RoutingServiceClient,
    "v1"
);

describe("duplicateCollection", () => {
    it("should create another collection", () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            let collection = await fixtures.items.createCollection({ title: "en title", languageCode: "en" }, { addToRoot: true });
            collection = await fixtures.items.addTitleToCollection(collection, "ro title", "ro");

            const duplicatedCollection = await fixtures.items.duplicateCollection(collection.id, rootCollection.id, rootCollection.id, fixtures.getAccountId(), fixtures.getAccountId());
            expect(duplicatedCollection).toBeDefined();
            expect(duplicatedCollection.accountId).toBe(fixtures.getAccountId());
            expect(duplicatedCollection.titles.length).toBe(collection.titles.length);

            const routingClient = await routingClientFactory.createBackend();
            const collectionSemanticLinks = await routingClient.findSemanticLinks(duplicatedCollection.id);
            expect(collectionSemanticLinks.length).toBe(2);
        });
    });
});

describe("findItems", () => {
    it("should not be accessible by users", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const admin = await fixtures.users.createAdmin();
            const repoClient = await clientFactory.createForFrontend(admin.id);
            await expect(repoClient.findItems({ binderId: rootCollection.id }, { maxResults: 1000 }))
                .rejects.toThrow(/.*authentication issue.*/);
        });
    });
});

describe("findItemsForEditor", () => {
    it("should be accessible by an editor", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const authClient = await UnCachedBackendAuthorizationServiceClient.fromConfig(config, "testing");
            const acl = await authClient.addDocumentAcl(
                rootCollection.accountId,
                rootCollection.id,
                EDITOR_ROLE_ID);
            const user = await fixtures.users.create();
            await authClient.addAclAssignee(acl.id, rootCollection.accountId, AssigneeType.USER, user.id);
            const repoClient = await clientFactory.createForFrontend(user.id);

            const items = await repoClient.findItemsForEditor(
                { binderId: rootCollection.id, accountId: rootCollection.accountId },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId);

            expect(items.length).toEqual(1);
        });
    });

    it("should enforce either an account Id, either a domain in filter", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const admin = await fixtures.users.createAdmin();
            const repoClient = await clientFactory.createForFrontend(admin.id);

            await expect(repoClient.findItemsForEditor(
                { binderId: rootCollection.id },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId)
            ).rejects.toThrow(/.*Filter param is missing a key for either accountId, either domain.*/);
        });
    });

    it("should fail when requesting user has no view permissions on found items", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const user = await fixtures.users.create();
            const repoClient = await clientFactory.createForFrontend(user.id);

            await expect(repoClient.findItemsForEditor(
                { binderId: rootCollection.id },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId)
            ).rejects.toThrow(/.*authorization issue.*/);
        });
    });

    it("should fail with the publicRepoClient", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const repoClient = await clientFactory.createForFrontend();

            await expect(repoClient.findItemsForEditor(
                { binderId: rootCollection.id },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId)
            ).rejects.toThrow(/.*authentication issue.*/);
        });
    });
});

describe("findItemsForReader", () => {
    it("should enforce either an account Id, either a domain in filter", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const admin = await fixtures.users.createAdmin();
            const repoClient = await clientFactory.createForFrontend(admin.id);

            await expect(repoClient.findItemsForReader(
                { binderId: rootCollection.id },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId)
            ).rejects.toThrow(/.*Filter param is missing a key for either accountId, either domain.*/);
        });
    });

    it("only published documents should be accessible to a reader or public", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();

            const unpublishedDoc = await fixtures.items.createDocument(
                { }, { publish: false, addToRoot: true }
            );
            const publishedDoc = await fixtures.items.createDocument(
                { }, { publish: true, addToRoot: true, public: true }
            );
            await refreshCaches(fixtures.getAccountId());

            const user = await fixtures.users.create();
            const repoClient = await clientFactory.createForFrontend(user.id);

            const readerVisibleItems = await withRetries(
                () => repoClient.findItemsForReader(
                    { binderIds: [unpublishedDoc.id, publishedDoc.id], accountId: rootCollection.accountId },
                    { binderSearchResultOptions: { maxResults: 1000 }},
                    rootCollection.accountId),
                (result) => !!result?.length)
            expect(readerVisibleItems.map(i => i.id))
                .toEqual(expect.arrayContaining([publishedDoc.id]));

            const publicClient = await clientFactory.createForFrontend();
            const publiclyVisibleItems = await publicClient.findItemsForReader(
                { binderIds: [publishedDoc.id, unpublishedDoc.id], accountId: rootCollection.accountId },
                { binderSearchResultOptions: { maxResults: 1000 }},
                rootCollection.accountId);
            expect(publiclyVisibleItems.map(i => i.id))
                .toEqual(expect.arrayContaining([publishedDoc.id]));
        });
    });
});

describe("findCollections", () => {
    it("should NOT be accessible with client jwt token", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const admin = await fixtures.users.createAdmin();
            const repoClient = await clientFactory.createForFrontend(admin.id);
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            await expect(repoClient.findCollections(
                { ids: [rootCollection.id] },
                { maxResults: 1 })
            ).rejects.toThrow(/.*authentication issue.*/);
        });
    });
});

describe("findCollectionsForEditor", () => {

    it("should enforce either an account Id, either a domain in filter", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const admin = await fixtures.users.createAdmin();
            const repoClient = await clientFactory.createForFrontend(admin.id);

            await expect(repoClient.findCollectionsFromClient(
                { ids: [rootCollection.id] },
                { maxResults: 1 })
            ).rejects.toThrow(/.*Filter param is missing a key for either accountId, either domain.*/);
        });
    });

    it("should only find public items for public users", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const privateCollection = await fixtures.items.createCollection({}, { addToRoot: true, public: false });
            const publicCollection = await fixtures.items.createCollection({}, { addToRoot: true, public: true });
            const repoClient = await clientFactory.createForFrontend();

            const bindersMediaRootColItems = await repoClient.findCollectionsFromClient(
                { ids: [publicCollection.id, privateCollection.id], accountId: fixtures.getAccountId() },
                { maxResults: 1000 },
            );

            expect(bindersMediaRootColItems.map(i => i.id))
                .toContainEqual(publicCollection.id);
        });
    });
});

describe("findReaderItemsWithInfo", () => {
    it("should enforce domain key in filter", () => {
        return globalFixtures.withAnyAccount(async () => {
            const repoClient = await clientFactory.createForFrontend();
            await expect(repoClient.findReaderItemsWithInfo(
                { summary: true },
                { binderSearchResultOptions: { maxResults: 10 }})
            ).rejects.toThrow(/.*filter doesn't include domain key.*/);
        });
    });
    it("should find results with correct input", async () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const repoClient = await clientFactory.createForFrontend();
            await new Promise(r => setTimeout(r, 5000));
            const result = await repoClient.findReaderItemsWithInfo(
                { summary: true, domain: fixtures.getDomain() },
                { binderSearchResultOptions: { maxResults: 1000 } }
            );
            expect(result.items.map(i => i.id))
                .toHaveLength(0);
        });
    });
});

async function refreshCaches(accountId: string) {
    const repoClient = await clientFactory.createBackend();
    await repoClient.countAllPublicDocuments(accountId);
}

async function withRetries<T>(fetch: () => Promise<T>, validate: (r: T) => boolean): Promise<T> {
    for (let i = 0; i < 10; i++) {
        const result = await fetch();
        if (validate(result)) {
            return result;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Reached timeout");
}
