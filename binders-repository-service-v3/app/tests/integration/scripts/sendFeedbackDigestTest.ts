/* eslint-disable no-console */
import { buildEditorItemUrl, getEditorLocation } from "@binders/client/lib/util/domains";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { FEATURE_ANONYMOUS_RATING } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { sendFeedbackDigest } from "../../../src/scripts/sendFeedbackDigest/sendFeedbackDigest";
const config = BindersConfig.get();

const globalFixtures = new TestFixtures(config);

describe("sendFeedbackDigest", () => {
    test("Anonymous feedback", async() => {
        await globalFixtures.withFreshAccount(async fixtures => {
            const owner = await fixtures.users.create({ firstName: "Jane", lastName: "Smith" });
            const doc = await fixtures.items.createDocument(
                {
                    title: "Comment on me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            await fixtures.ownership.setOwner(doc.id, owner.id);
            await fixtures.enableFeatures([ FEATURE_ANONYMOUS_RATING ])
            const [pub] = await fixtures.items.publishDoc(doc.id, ["en"]);
            const feedbackParams = {
                isAnonymous: true,
                rating: 3,
                message: "Nice work",
            };
            await fixtures.feedbacks.createFeedback(pub, feedbackParams, null);
            const accountId = fixtures.getAccountId();
            const report = await sendFeedbackDigest(0, true, accountId);
            const snippets = [
                "Anonymous left a review on your document",
                "★★★☆☆",
                "Nice work"
            ];
            const mailHtml = report[owner.id].mailHtml;
            expect(mailHtml).toMatch(new RegExp(`.*${snippets.join(".*")}.*`));

        });
    })
    test("multiple commenters, single rating", async () => {
        await globalFixtures.withFreshAccount(async fixtures => {
            const owner = await fixtures.users.create({ firstName: "Jane", lastName: "Smith" });
            const user1 = await fixtures.users.create({ firstName: "Hakim", lastName: "Johnson" });
            const user2 = await fixtures.users.create({ firstName: "Maria", lastName: "Peterson" });
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user1.id, [PermissionName.VIEW]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user2.id, [PermissionName.VIEW]);
            const doc = await fixtures.items.createDocument(
                {
                    title: "Comment on me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            await fixtures.ownership.setOwner(doc.id, owner.id);
            const [pub] = await fixtures.items.publishDoc(doc.id, ["en"]);

            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, owner.id, [PermissionName.ADMIN]);

            const accountId = fixtures.getAccountId();
            const domain = fixtures.getDomain();
            await fixtures.readerComments.createReaderComment(doc, pub, 0, "Good stuff", user1.id);
            await fixtures.readerComments.createReaderComment(doc, pub, 0, "Unclear, your hand is in the way", user2.id);

            await fixtures.feedbacks.createFeedback(pub, { isAnonymous: false, rating: 4, message: "Almost perfect" }, user1.id);
            const report = await sendFeedbackDigest(0, true, accountId);
            expect(Object.keys(report)).toHaveLength(1);
            expect(report[owner.id]).toBeDefined();
            const mailHtml = report[owner.id].mailHtml;

            const devEditorLocation = config.getString("services.editor.externalLocation").get();
            const editorLink = buildEditorItemUrl("binder", domain, doc.id, getEditorLocation(domain, devEditorLocation));

            expect((mailHtml.match(/left a comment/g) || []).length).toBe(2);
            expect((mailHtml.match(/left a review/g) || []).length).toBe(1);

            const expectedSnippets = [
                "Hakim Johnson left a comment on your document",
                "Good stuff",
                editorLink.split("?")[0],
                "Open comment",
                "Maria Peterson left a comment on your document",
                "Unclear, your hand is in the way",
                editorLink.split("?")[0],
                "Open comment",
                "Hakim Johnson left a review on your document",
                "★★★★☆",
                "Almost perfect",
                editorLink.split("?")[0],
                "Open review",
            ];
            expect(mailHtml).toMatch(new RegExp(`.*${expectedSnippets.join(".*")}.*`));
        });
    });

    test("two owners, each gets their digest", async () => {
        await globalFixtures.withFreshAccount(async fixtures => {
            const owner1 = await fixtures.users.create({ firstName: "Jane", lastName: "Smith" });
            const owner2 = await fixtures.users.create({ firstName: "Alex", lastName: "McBeth" });
            const user1 = await fixtures.users.create({ firstName: "Hakim", lastName: "Johnson" });
            const user2 = await fixtures.users.create({ firstName: "Maria", lastName: "Peterson" });
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, owner1.id, [PermissionName.ADMIN]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, owner2.id, [PermissionName.ADMIN]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user1.id, [PermissionName.VIEW]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user2.id, [PermissionName.VIEW]);
            const doc1 = await fixtures.items.createDocument(
                {
                    title: "Jane owns me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            const doc2 = await fixtures.items.createDocument(
                {
                    title: "Alex owns me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            const doc3 = await fixtures.items.createDocument(
                {
                    title: "Nobody owns me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            await fixtures.ownership.setOwner(doc1.id, owner1.id);
            await fixtures.ownership.setOwner(doc2.id, owner2.id);
            const [pub1] = await fixtures.items.publishDoc(doc1.id, ["en"]);
            const [pub2] = await fixtures.items.publishDoc(doc2.id, ["en"]);
            const [pub3] = await fixtures.items.publishDoc(doc3.id, ["en"]);

            const accountId = fixtures.getAccountId();

            await fixtures.readerComments.createReaderComment(doc1, pub1, 0, "Jane, this is marvelous", user1.id);
            await fixtures.readerComments.createReaderComment(doc2, pub2, 0, "Way to go Alex", user2.id);
            await fixtures.readerComments.createReaderComment(doc3, pub3, 0, "This comment should not be reported", user2.id);
            const report = await sendFeedbackDigest(0, true, accountId);

            expect(Object.keys(report)).toHaveLength(2);
            expect(report[owner1.id]).toBeDefined();
            expect(report[owner2.id]).toBeDefined();
            expect(report[owner1.id].mailHtml).toContain("Hi Jane");
            expect(report[owner2.id].mailHtml).toContain("Hi Alex");

            expect(report[owner1.id].mailHtml.match(/left a comment/g)).toHaveLength(1);
            expect(report[owner1.id].mailHtml).toMatch(new RegExp("Hakim Johnson left a comment on your document.*Jane owns me.*Jane, this is marvelous"));

            expect(report[owner2.id].mailHtml.match(/left a comment/g)).toHaveLength(1);
            expect(report[owner2.id].mailHtml).toMatch(new RegExp("Maria Peterson left a comment on your document.*Alex owns me.*Way to go Alex"));
        });
    });

    test("single commenter left multiple comments, owner is a group", async () => {
        await globalFixtures.withFreshAccount(async fixtures => {
            const owner1 = await fixtures.users.create({ firstName: "Jane", lastName: "Smith" });
            const owner2 = await fixtures.users.create({ firstName: "Alex", lastName: "McBeth" });
            const ownersGroup = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(ownersGroup.id, owner1.id);
            await fixtures.groups.addUserToGroup(ownersGroup.id, owner2.id);
            const user1 = await fixtures.users.create({ firstName: "Hakim", lastName: "Johnson" });
            const user2 = await fixtures.users.create({ firstName: "Maria", lastName: "Peterson" });
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user1.id, [PermissionName.VIEW]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user2.id, [PermissionName.VIEW]);
            const doc = await fixtures.items.createDocument(
                {
                    title: "Comment on me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            await fixtures.ownership.setOwner(doc.id, ownersGroup.id);
            const [pub] = await fixtures.items.publishDoc(doc.id, ["en"]);

            const accountId = fixtures.getAccountId();

            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            await fixtures.authorization.assignItemPermission(rootCollection.id, ownersGroup.id, [PermissionName.EDIT]);

            await fixtures.readerComments.createReaderComment(doc, pub, 0, "Good stuff", user1.id);
            await fixtures.readerComments.createReaderComment(doc, pub, 1, "Also not bad", user1.id);
            const report = await sendFeedbackDigest(0, true, accountId);

            expect(Object.keys(report)).toHaveLength(2);
            expect(report[owner1.id]).toBeDefined();
            expect(report[owner2.id]).toBeDefined();
            expect(report[owner1.id].mailHtml).toContain("Hi Jane");
            expect(report[owner2.id].mailHtml).toContain("Hi Alex");
            expect(report[owner1.id].mailHtml.replace(/Jane/g, "")).toEqual(
                report[owner2.id].mailHtml.replace(/Alex/g, "")
            );
            expect(report[owner1.id].mailHtml.match(/Hakim Johnson left a comment/g)).toHaveLength(2);
        });
    });

    test("excluded owners comments", async () => {
        await globalFixtures.withFreshAccount(async fixtures => {
            const owner = await fixtures.users.create({ firstName: "Bob", lastName: "Doe" });
            const user1 = await fixtures.users.create({ firstName: "Alice", lastName: "Doe" });
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, owner.id, [PermissionName.VIEW]);
            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, user1.id, [PermissionName.VIEW]);
            const doc = await fixtures.items.createDocument(
                {
                    title: "Comment on me",
                    languageCode: ["en"],
                    chunkTexts: ["This is a test document", "The end"],
                },
                {
                    addToRoot: true,
                },
            );
            await fixtures.ownership.setOwner(doc.id, owner.id);
            const [pub] = await fixtures.items.publishDoc(doc.id, ["en"]);

            await fixtures.authorization.assignItemPermission((await fixtures.items.getOrCreateRootCollection()).id, owner.id, [PermissionName.ADMIN]);

            const accountId = fixtures.getAccountId();
            await fixtures.readerComments.createReaderComment(doc, pub, 0, "Good stuff", user1.id);
            await fixtures.readerComments.createReaderComment(doc, pub, 0, "Bad stuff", owner.id);

            await fixtures.feedbacks.createFeedback(pub, { isAnonymous: false, rating: 4, message: "Almost perfect" }, user1.id);
            await fixtures.feedbacks.createFeedback(pub, { isAnonymous: false, rating: 1, message: "Terrible" }, owner.id);
            const report = await sendFeedbackDigest(0, true, accountId);
            expect(Object.keys(report)).toHaveLength(1);
            expect(report[owner.id]).toBeDefined();
            const mailHtml = report[owner.id].mailHtml;


            expect((mailHtml.match(/left a comment/g) || []).length).toBe(1);
            expect((mailHtml.match(/left a review/g) || []).length).toBe(1);

            const expectedSnippets = [
                "Alice Doe left a comment on your document",
                "Good stuff",
                "Alice Doe left a review on your document",
                "★★★★☆",
                "Almost perfect",
            ];
            expect(mailHtml).toMatch(new RegExp(`.*${expectedSnippets.join(".*")}.*`));

            const unexpectedSnippets = [
                "Bob Doe left a comment on your document",
                "Bad stuff",
                "Bob Doe left a review on your document",
                "★☆☆☆☆",
                "Terrible",
            ];

            expect(mailHtml).not.toMatch(new RegExp(`.*${unexpectedSnippets.join(".*")}.*`));
        });
    });
});

