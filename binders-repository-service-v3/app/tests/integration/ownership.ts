import {
    Binder,
    DEFAULT_OWNERSHIP,
    DetailedItemOwnership,
    DocumentCollection,
    ItemConfigAccessType,
    ItemOwnership
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { extractTitle, userOrGroupAsOwner } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);
const userServiceClientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);
const accountServiceClientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("getOwnershipForItems", () => {
    it("should retrieve default ownership when not explicitly set", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();

            const document = await fixtures.items.createDocument({}, { addToRoot: true });

            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], fixtures.getAccountId());
            expectInheritedOwnership(detailedOwnership);
        });
    });

    it("should retrieve the inherited ownership when overridden in a parent", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();
            const user = await fixtures.users.create();

            const collection1 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection2 = await fixtures.items.createCollection();
            await fixtures.items.addCollToCollection(collection1.id, collection2.id);
            const document = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(collection2.id, document.id);

            await repositoryClient.setOwnershipForItem(collection1.id, overriddenOwnership(user.id), fixtures.getAccountId());

            const ancestorWithOwnership = {
                id: collection1.id,
                title: extractTitle(collection1),
                owners: [user].map(userOrGroupAsOwner),
            };
            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], fixtures.getAccountId());
            expectInheritedOwnership(detailedOwnership, [user], [ancestorWithOwnership]);
        });
    });

    it("should resolve both users and groups when fetching ownership", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();

            const user = await fixtures.users.create();
            const userInGroup = await fixtures.users.create();
            const anotherUserInGroup = await fixtures.users.create();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, userInGroup.id);
            await fixtures.groups.addUserToGroup(group.id, anotherUserInGroup.id);

            const document = await fixtures.items.createDocument({}, { addToRoot: true });
            await repositoryClient.setOwnershipForItem(
                document.id,
                overriddenOwnership(user.id, userInGroup.id, group.id),
                fixtures.getAccountId());

            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], fixtures.getAccountId());
            expectOverriddenOwnership(detailedOwnership, [user, userInGroup, group]);

            const [expandedGroupsOwnership] = await repositoryClient.getOwnershipForItems([document.id], fixtures.getAccountId(), true);
            expectOverriddenOwnership(expandedGroupsOwnership, [user, userInGroup, anotherUserInGroup]);
        });
    });

    it("should retrieve aggregate ownership for instances", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();
            const user1 = await fixtures.users.create();
            const user2 = await fixtures.users.create();

            /*
             * We're creating the following tree where c2 in an instance
             * root <- c1, c2, c3
             * c1 <- c2
             * c2 <- c4
             * c3 <- c4
             */
            const collection1 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection2 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection3 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection4 = await fixtures.items.createCollection();
            await fixtures.items.addCollToCollection(collection2.id, collection4.id);
            await fixtures.items.addCollToCollection(collection3.id, collection4.id);
            await fixtures.items.addCollToCollection(collection1.id, collection2.id);

            await repositoryClient.setOwnershipForItem(collection1.id, { type: "overridden", ids: [user1.id] }, fixtures.getAccountId());
            await repositoryClient.setOwnershipForItem(collection3.id, { type: "overridden", ids: [user2.id] }, fixtures.getAccountId());

            const ancestorWithOwnershipCollection1 = {
                id: collection1.id,
                title: extractTitle(collection1),
                owners: [user1].map(userOrGroupAsOwner),
            };
            const [instanceOwnership] = await repositoryClient.getOwnershipForItems([collection2.id], fixtures.getAccountId());
            expectInheritedOwnership(instanceOwnership, [user1], [ancestorWithOwnershipCollection1]);

            const ancestorWithOwnershipCollection3 = {
                id: collection3.id,
                title: extractTitle(collection3),
                owners: [user2].map(userOrGroupAsOwner),
            };
            const [inheritedInstanceOwnership] = await repositoryClient.getOwnershipForItems([collection4.id], fixtures.getAccountId());
            expectInheritedOwnership(inheritedInstanceOwnership, [user1, user2], [ancestorWithOwnershipCollection1, ancestorWithOwnershipCollection3]);
        });
    });

    it("should retrieve overridden ownership for instances of descendant of instances", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();
            const user = await fixtures.users.create();

            /*
             * We're creating the following tree where c2 in an instance
             * root <- c1, c2
             * c1 <- c2
             * c2 <- c3
             */
            const collection1 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection2 = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection3 = await fixtures.items.createCollection();
            await fixtures.items.addCollToCollection(collection2.id, collection3.id);
            await repositoryClient.addElementToCollection(collection1.id, "collection", collection2.id, fixtures.getAccountId());

            await repositoryClient.setOwnershipForItem(collection2.id, overriddenOwnership(user.id), fixtures.getAccountId());

            const [instanceOwnership] = await repositoryClient.getOwnershipForItems([collection2.id], fixtures.getAccountId());
            expectOverriddenOwnership(instanceOwnership, [user]);

            const [inheritedInstanceOwnership] = await repositoryClient.getOwnershipForItems([collection3.id], fixtures.getAccountId());
            expectInheritedOwnership(inheritedInstanceOwnership, [user]);
        });
    });
});

describe("setOwnershipForItem", () => {
    it("should override document ownership when no ownership is defined", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const document = await fixtures.items.createDocument({}, { addToRoot: true });
            const user = await fixtures.users.create();

            const repositoryClient = await clientFactory.createBackend();
            const ownership: ItemOwnership = overriddenOwnership(user.id);
            await repositoryClient.setOwnershipForItem(document.id, ownership, fixtures.getAccountId());

            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], fixtures.getAccountId());
            expectOverriddenOwnership(detailedOwnership, [user]);
        });
    });

    it("should override collection ownership when no ownership is defined", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();
            const collection = await fixtures.items.createCollection({}, { addToRoot: true });
            const user = await fixtures.users.create();

            const ownership: ItemOwnership = overriddenOwnership(user.id);
            await repositoryClient.setOwnershipForItem(collection.id, ownership, fixtures.getAccountId());

            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([collection.id], fixtures.getAccountId());
            expectOverriddenOwnership(detailedOwnership, [user]);
        });
    });

    it("should fail on invalid ownership properties", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend();
            const document = await fixtures.items.createDocument({}, { addToRoot: true });

            const nonExistentUserOwnership: ItemOwnership = overriddenOwnership("uid-6910fa75-d760-4201-8125-85d48e77f47d");
            await expect(() => repositoryClient.setOwnershipForItem(document.id, nonExistentUserOwnership, fixtures.getAccountId()))
                .rejects.toThrow("Invalid param");

            await expect(() => repositoryClient.setOwnershipForItem("OVKzMIwBonNHnME14fIw", DEFAULT_OWNERSHIP, fixtures.getAccountId()))
                .rejects.toThrow("This item (OVKzMIwBonNHnME14fIw) does not exist");
        });
    });
});

describe("ownership management", () => {
    it("should clear ownership on duplication for both documents and collections", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const repositoryClient = await clientFactory.createBackend();
            const targetCollectionForDuplicated = await fixtures.items.createCollection({}, { addToRoot: true });
            const document = await fixtures.items.createDocument({}, { addToRoot: true });
            const collection = await fixtures.items.createCollection({}, { addToRoot: true });

            await repositoryClient.setOwnershipForItem(document.id, overriddenOwnership(), accountId);
            await repositoryClient.setOwnershipForItem(collection.id, overriddenOwnership(), accountId);

            const duplicatedDocument = await repositoryClient.duplicateBinder(document, targetCollectionForDuplicated.id, accountId, accountId);
            const duplicatedCollection = await repositoryClient.duplicateCollection(collection.id, targetCollectionForDuplicated.id, "", accountId, accountId);

            const [duplicatedDocumentOwnership] = await repositoryClient.getOwnershipForItems([duplicatedDocument.id], accountId);
            const [duplicatedCollectionOwnership] = await repositoryClient.getOwnershipForItems([duplicatedCollection.id], accountId);

            expectInheritedOwnership(duplicatedDocumentOwnership);
            expectInheritedOwnership(duplicatedCollectionOwnership);
        });
    });

    it("should clear ownership on duplication for both documents and collections between accounts", async () => {
        const repositoryClient = await clientFactory.createBackend();
        let accountIdToMoveItemsFrom: string;
        let documentToDuplicate: Binder;
        let collectionToDuplicate: DocumentCollection;
        let documentInsideCollectionToDuplicate: Binder;

        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountIdToMoveItemsFrom = fixtures.getAccountId();
            const user = await fixtures.users.create();
            documentToDuplicate = await fixtures.items.createDocument({}, { addToRoot: true });
            collectionToDuplicate = await fixtures.items.createCollection({}, { addToRoot: true });
            documentInsideCollectionToDuplicate = await fixtures.items.createDocument({}, { addToCollId: collectionToDuplicate.id });

            const overridden = overriddenOwnership(user.id);
            await repositoryClient.setOwnershipForItem(documentToDuplicate.id, overridden, accountIdToMoveItemsFrom);
            await repositoryClient.setOwnershipForItem(collectionToDuplicate.id, overridden, accountIdToMoveItemsFrom);
            await repositoryClient.setOwnershipForItem(documentInsideCollectionToDuplicate.id, overridden, accountIdToMoveItemsFrom);
        });

        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();

            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const domain = fixtures.getDomain();

            const newDoc = await repositoryClient.duplicateBinder(documentToDuplicate, rootCollection.id, accountIdToMoveItemsFrom, accountId);
            const newCol = await repositoryClient.duplicateCollection(collectionToDuplicate.id, rootCollection.id, domain, accountIdToMoveItemsFrom, accountId);

            const [docOwnership] = await repositoryClient.getOwnershipForItems([newDoc.id], accountId);
            expectInheritedOwnership(docOwnership);

            const [colOwnership] = await repositoryClient.getOwnershipForItems([newCol.id], accountId);
            expectInheritedOwnership(colOwnership);

            const [newDocInsideNewCol] = await repositoryClient.getCollectionsElements([newCol.id], true);
            const [subDocOwnership] = await repositoryClient.getOwnershipForItems([newDocInsideNewCol.key], accountId);
            expectInheritedOwnership(subDocOwnership);
        });
    });

    it("should change ownership to inherited when moving docs & collections", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const repositoryClient = await clientFactory.createBackend();
            const collection1Owner = await fixtures.users.create();
            const collection2Owner = await fixtures.users.create();
            const collection4Owner = await fixtures.users.create();
            const document2Owner = await fixtures.users.create();
            const document4Owner = await fixtures.users.create();

            /*
             * The following struct will be defined in order to test ownership changes on move
             * root <- col1, col2
             * col2 <- doc1, doc2, col3, col4
             * col3 <- doc3, doc4
             *
             * the test will attempt to move all the children of col2 in col1, so
             * co1 <- doc1, doc2, col3, col4
             */

            /* has overridden ownership */
            const rootCollection1 = await fixtures.items.createCollection({}, { addToRoot: true });
            /* has overridden ownership */
            const rootCollection2 = await fixtures.items.createCollection({}, { addToRoot: true });
            /* has inherited ownership */
            const document1InCollection2 = await fixtures.items.createDocument({}, { addToCollId: rootCollection2.id });
            /* has overridden ownership */
            const document2InCollection2 = await fixtures.items.createDocument({}, { addToCollId: rootCollection2.id });
            /* has inherited ownership */
            const collection3InCollection2 = await fixtures.items.createCollection({}, { addToCollId: rootCollection2.id });
            /* has inherited ownership */
            const document3InCollection3 = await fixtures.items.createDocument({}, { addToCollId: collection3InCollection2.id });
            /* has overridden ownership */
            const document4InCollection3 = await fixtures.items.createDocument({}, { addToCollId: collection3InCollection2.id });
            /* has overridden ownership */
            const collection4InCollection2 = await fixtures.items.createCollection({}, { addToCollId: rootCollection2.id });

            await repositoryClient.setOwnershipForItem(rootCollection1.id, overriddenOwnership(collection1Owner.id), accountId);
            await repositoryClient.setOwnershipForItem(rootCollection2.id, overriddenOwnership(collection2Owner.id), accountId);
            await repositoryClient.setOwnershipForItem(document2InCollection2.id, overriddenOwnership(document2Owner.id), accountId);
            await repositoryClient.setOwnershipForItem(document4InCollection3.id, overriddenOwnership(document4Owner.id), accountId);
            await repositoryClient.setOwnershipForItem(collection4InCollection2.id, overriddenOwnership(collection4Owner.id), accountId);

            const moveItem = async (itemId: string, fromId: string, toId: string, itemType: string) => {
                await repositoryClient.addElementToCollection(toId, itemType, itemId, accountId);
                await repositoryClient.removeElementFromCollection(fromId, itemType, itemId, accountId, true);
            };

            await moveItem(document1InCollection2.id, rootCollection2.id, rootCollection1.id, "document");
            await moveItem(document2InCollection2.id, rootCollection2.id, rootCollection1.id, "document");
            await moveItem(collection3InCollection2.id, rootCollection2.id, rootCollection1.id, "collection");
            await moveItem(collection4InCollection2.id, rootCollection2.id, rootCollection1.id, "collection");

            const ancestorWithOwnership = {
                id: rootCollection1.id,
                title: extractTitle(rootCollection1),
                owners: [collection1Owner].map(userOrGroupAsOwner),
            };
            for (const itemId of [document1InCollection2.id, collection3InCollection2.id, document3InCollection3.id]) {
                const [newInheritedOwnership] = await repositoryClient.getOwnershipForItems([itemId], accountId);
                expectInheritedOwnership(newInheritedOwnership, [collection1Owner], [ancestorWithOwnership]);
            }

            const [doc2Ownership] = await repositoryClient.getOwnershipForItems([document2InCollection2.id], accountId);
            expectOverriddenOwnership(doc2Ownership, [document2Owner]);

            const [col4Ownership] = await repositoryClient.getOwnershipForItems([collection4InCollection2.id], accountId);
            expectOverriddenOwnership(col4Ownership, [collection4Owner]);

            const [doc4Ownership] = await repositoryClient.getOwnershipForItems([document4InCollection3.id], accountId);
            expectOverriddenOwnership(doc4Ownership, [document4Owner]);
        });
    });

    it("should remove users and groups from ownership", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const repositoryClient = await clientFactory.createBackend();
            const doc1 = await fixtures.items.createDocument({}, { addToRoot: true });
            const doc2 = await fixtures.items.createDocument({}, { addToRoot: true });
            const col1 = await fixtures.items.createCollection({}, { addToRoot: true });
            const col2 = await fixtures.items.createCollection({}, { addToRoot: true });

            const user = await fixtures.users.create();
            const toRemoveUser = await fixtures.users.create();
            const toRemoveUser2 = await fixtures.users.create();
            const toRemoveGroup = await fixtures.groups.create();

            await repositoryClient.setOwnershipForItem(doc1.id, overriddenOwnership(user.id, toRemoveUser.id, toRemoveUser2.id, toRemoveGroup.id), accountId);
            await repositoryClient.setOwnershipForItem(doc2.id, overriddenOwnership(toRemoveUser.id, toRemoveGroup.id), accountId);
            await repositoryClient.setOwnershipForItem(col1.id, overriddenOwnership(user.id, toRemoveUser.id, toRemoveUser2.id, toRemoveGroup.id), accountId);
            await repositoryClient.setOwnershipForItem(col2.id, overriddenOwnership(toRemoveUser.id, toRemoveGroup.id), accountId);

            const accountClient = await accountServiceClientFactory.createBackend();
            await accountClient.removeMember(accountId, toRemoveUser.id, ManageMemberTrigger.INTEGRATION_TEST);
            await accountClient.removeMembers(accountId, [toRemoveUser2.id], ManageMemberTrigger.INTEGRATION_TEST);

            const userClient = await userServiceClientFactory.createBackend();
            await userClient.removeGroup(accountId, toRemoveGroup.id);

            // Doc 1 & Col 1 ownerships are still overridden with one owner
            const [doc1Ownership] = await repositoryClient.getOwnershipForItems([doc1.id], accountId);
            expectOverriddenOwnership(doc1Ownership, [user]);
            const [col1Ownership] = await repositoryClient.getOwnershipForItems([col1.id], accountId);
            expectOverriddenOwnership(col1Ownership, [user]);

            // Doc 2 & Col 2 ownerships are turned into inherited (no owners remained)
            const [doc2Ownership] = await repositoryClient.getOwnershipForItems([doc2.id], accountId);
            expectInheritedOwnership(doc2Ownership);
            const [col2Ownership] = await repositoryClient.getOwnershipForItems([col2.id], accountId);
            expectInheritedOwnership(col2Ownership);
        });
    });
});

describe("check authorization for ownership endpoints", () => {
    it("should allow to set ownership for a contributor", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.create();
            const document = await fixtures.items.createDocument();
            await fixtures.authorization.assignItemRole(document.id, user.id, "Contributor");
            const repositoryClient = await clientFactory.createForFrontend(user.id);
            const ownership: ItemOwnership = { type: "overridden", ids: [user.id] };
            await repositoryClient.setOwnershipForItem(document.id, ownership, accountId);
            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], accountId);
            expectOverriddenOwnership(detailedOwnership, [user]);
        });
    });
    it("should not allow to set ownership for a contributor", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.create();
            const document = await fixtures.items.createDocument();
            await fixtures.authorization.assignItemRole(document.id, user.id, "Reader");
            const repositoryClient = await clientFactory.createForFrontend(user.id);
            const [detailedOwnership] = await repositoryClient.getOwnershipForItems([document.id], accountId);
            expectInheritedOwnership(detailedOwnership);
            await expect(
                () => repositoryClient.setOwnershipForItem(document.id, overriddenOwnership(user.id), accountId)
            ).rejects.toThrow("authorization issue");
        });
    });
});

const overriddenOwnership = (...ids: string[]): ItemOwnership => ({ type: "overridden", ids });

const expectInheritedOwnership = (
    ownership: DetailedItemOwnership,
    usersAndGroups: (User | Usergroup)[] = [],
    ancestorsWithOwnership?: { id: string, title: string }[],
) =>
    expectOwnershipOfType("inherited", ownership, usersAndGroups, ancestorsWithOwnership);

const expectOverriddenOwnership = (
    ownership: DetailedItemOwnership,
    usersAndGroups: (User | Usergroup)[] = [],
    ancestorsWithOwnership?: { id: string, title: string }[],
) =>
    expectOwnershipOfType("overridden", ownership, usersAndGroups, ancestorsWithOwnership);

const expectOwnershipOfType = (
    ownershipType: DetailedItemOwnership["type"],
    ownership: DetailedItemOwnership,
    usersAndGroups: (User | Usergroup)[],
    ancestorsWithOwnership?: { id: string, title: string }[],
) => {
    const expectedOwners = usersAndGroups.map(userOrGroupAsOwner);
    const ancestorsInfo = ancestorsWithOwnership ?
        {
            ancestorsWithOwnership: expect.arrayContaining(ancestorsWithOwnership.map(ancestorWithOwnership => ({
                isCollection: true,
                owners: [],
                ...ancestorWithOwnership,
                access: ItemConfigAccessType.EDITABLE,
            }))),
        } :
        {};
    expect(ownership).toMatchObject(expect.objectContaining({
        type: ownershipType,
        owners: expect.arrayContaining(expectedOwners),
        ...ancestorsInfo
    }));
    expect(ownership.owners.length).toEqual(expectedOwners.length);
}
