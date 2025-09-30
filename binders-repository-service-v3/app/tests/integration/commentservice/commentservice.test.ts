import {
    Binder,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CommentServiceClient } from "@binders/client/lib/clients/commentservice/v1/client";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { FEATURE_READER_COMMENTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const commentClientFactory = new ClientFactory(
    config,
    CommentServiceClient,
    "v1"
);
const repoClientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);
const userClientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

const DEFAULT_COMMENT_TEXT = "some comment";

describe("Reader comments", () => {

    describe("createReaderComment", () => {

        it("createReaderComment creates a thread and comment", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const user = await fixtures.users.createAdmin();
                const doc = await fixtures.items.createDocument({ title: "Some title", languageCode: ["en"], chunkTexts: ["one"] }, { publish: true, addToRoot: true });
                const client = await commentClientFactory.createForFrontend(user.id);
                const repoClient = await repoClientFactory.createBackend();
                const commentBackendClient = await commentClientFactory.createBackend();
                const [publication] = await repoClient.findPublications(doc.id, { languageCodes: ["en"] }, { binderSearchResultOptions: { maxResults: 1 } });
                const chunkId = (publication as Publication).binderLog.current[0].uuid;

                const commentId = await client.createReaderComment(publication.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);
                expect(commentId).toBeDefined();

                const threads = await commentBackendClient.getCommentThreads(doc.id);
                expect(threads.length).toBe(1);
                expect(threads[0].comments.length).toBe(1);
                expect(threads[0].comments[0].body).toBe(DEFAULT_COMMENT_TEXT);
            });
        });

        it("createReaderComment returns unauthorized when no read access", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const doc = await fixtures.items.createDocument({ title: "Some title", languageCode: ["en"], chunkTexts: ["one"] }, { publish: true, addToRoot: true });
                const repoBackendClient = await repoClientFactory.createBackend();
                const [publication] = await repoBackendClient.findPublications(doc.id, { languageCodes: ["en"] }, { binderSearchResultOptions: { maxResults: 1 } });
                const chunkId = (publication as Publication).binderLog.current[0].uuid;

                const user = await fixtures.users.create();
                const client = await commentClientFactory.createForFrontend(user.id);
                await expect(
                    client.createReaderComment(publication.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT)
                ).rejects.toThrow("authorization issue");
            });
        });

        it("uses the target user as the author, and the device user for authorization", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                // Create document
                const doc = await fixtures.items.createDocument({ title: "Some title", languageCode: ["en"], chunkTexts: ["one"] }, { addToRoot: true });
                const chunkId = doc.binderLog.current[0].uuid;
                const [publicationSummary] = await fixtures.items.publishDoc(doc.id, ["en"]);

                // Create device and target & give access to device
                const deviceUser = await fixtures.users.create({ type: UserType.Device });
                const targetUser = await fixtures.users.create();
                await fixtures.authorization.assignItemRole(doc.id, deviceUser.id, "Reader");
                const backendUserClient = await userClientFactory.createBackend();
                await backendUserClient.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [targetUser.id]);

                // Create and fetch comments
                const client = await commentClientFactory.createAsDeviceTarget(deviceUser.id, targetUser.id, fixtures.getAccountId());
                await client.createReaderComment(publicationSummary.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);
                const comments = await client.getReaderComments(doc.id, fixtures.getAccountId());

                // Verify that the comment was created by the target user, and not by the device user
                expect(comments.length).toBe(1);
                expect(comments[0].authorId).toBe(targetUser.id);
            });
        })
    });

    describe("getReaderComments", () => {
        it("returns a 401 when no authentication option is provided", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const client = await commentClientFactory.createForFrontend();
                const binder = await fixtures.items.createDocument();
                await expect(
                    client.getReaderComments(binder.id, fixtures.getAccountId())
                ).rejects.toThrow("401");
            });
        });

        it("returns a 401 when the user does not have read access to the document", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.create();
                const client = await commentClientFactory.createForFrontend(user.id);
                const binder = await fixtures.items.createDocument();
                await expect(
                    client.getReaderComments(binder.id, fixtures.getAccountId())
                ).rejects.toThrow("401");
            });
        });

        it("returns an empty list when the user has no reader comments", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.create();
                const client = await commentClientFactory.createForFrontend(user.id);
                const binder = await fixtures.items.createDocument();
                await fixtures.authorization.assignItemRole(binder.id, user.id, "Reader");

                const comments = await client.getReaderComments(binder.id, fixtures.getAccountId());

                expect(comments.length).toBe(0);
            });
        });

        it("returns a list of reader comments the user has created", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.create();
                const client = await commentClientFactory.createForFrontend(user.id);
                const binder = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true, publish: true });
                await fixtures.authorization.assignItemRole(binder.id, user.id, "Reader");
                const publication = await fixtures.items.getPublicationForBinder(binder.id, "en");
                const chunkId = (publication as Publication).binderLog.current[0].uuid;
                await client.createReaderComment(publication.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);

                const comments = await client.getReaderComments(binder.id, fixtures.getAccountId());

                expect(comments.length).toBe(1);
                expect(comments[0].body).toBe(DEFAULT_COMMENT_TEXT);
            });
        });

        it("does not return reader comments other users created", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const binder = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true, publish: true });
                const user = await fixtures.users.create();
                const otherUser = await fixtures.users.create();
                const client = await commentClientFactory.createForFrontend(user.id);
                const otherUserClient = await commentClientFactory.createForFrontend(otherUser.id);
                await fixtures.authorization.assignItemRole(binder.id, user.id, "Reader");
                await fixtures.authorization.assignItemRole(binder.id, otherUser.id, "Reader");
                const publication = await fixtures.items.getPublicationForBinder(binder.id, "en");
                const chunkId = (publication as Publication).binderLog.current[0].uuid;
                await otherUserClient.createReaderComment(publication.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);

                const comments = await client.getReaderComments(binder.id, fixtures.getAccountId());

                expect(comments.length).toBe(0);
            });
        });

        it("does not return editor comments", async () => {
            return globalFixtures.withAnyAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.create();
                const binder = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true, publish: true });
                const publication = await fixtures.items.getPublicationForBinder(binder.id, "en");
                const chunkId = (publication as Publication).binderLog.current[0].uuid;
                await fixtures.authorization.assignItemRole(binder.id, user.id, "Editor");
                const client = await commentClientFactory.createForFrontend(user.id);

                await client.insertBinderComment(
                    binder.id,
                    chunkId,
                    "en",
                    {
                        userId: user.id,
                        body: "text"
                    },
                    fixtures.getAccountId()
                );
                const comments = await client.getReaderComments(binder.id, fixtures.getAccountId());

                expect(comments.length).toBe(0);
            });
        });
    });

    describe("updateReaderComment", () => {

        it("updates a comment's body", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.createAdmin();
                const repoBackendClient = await repoClientFactory.createBackend();
                const commentBackendClient = await commentClientFactory.createBackend();
                const client = await commentClientFactory.createForFrontend(user.id);
                const { thread, commentId, doc } = await createPublicationWithComment(fixtures, repoBackendClient, commentBackendClient, client);
                expect(commentId).toBeDefined();
                expect(thread.comments[0].isEdited).toBe(false);

                await client.updateReaderComment(thread.id, commentId, { text: "some other comment" }, fixtures.getAccountId());

                const threads = await commentBackendClient.getCommentThreads(doc.id);
                expect(threads.length).toBe(1);
                expect(threads[0].comments.length).toBe(1);
                expect(threads[0].comments[0].body).toBe("some other comment");
                expect(threads[0].comments[0].isEdited).toBe(true);
            });
        });

        it("returns unauthorized when trying to modify someone else's comment", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.createAdmin();
                const otherUser = await fixtures.users.createAdmin();
                const repoBackendClient = await repoClientFactory.createBackend();
                const commentBackendClient = await commentClientFactory.createBackend();
                const client = await commentClientFactory.createForFrontend(user.id);
                const { thread, commentId } = await createPublicationWithComment(fixtures, repoBackendClient, commentBackendClient, client);

                const otherClient = await commentClientFactory.createForFrontend(otherUser.id);
                await expect(
                    otherClient.updateReaderComment(thread.id, commentId, { text: "some other comment" }, fixtures.getAccountId())
                ).rejects.toThrow("Not allowed to change");
            });
        });

        it("returns unauthorized when trying to edit missing comment or thread", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
                const user = await fixtures.users.createAdmin();
                const repoBackendClient = await repoClientFactory.createBackend();
                const commentBackendClient = await commentClientFactory.createBackend();
                const client = await commentClientFactory.createForFrontend(user.id);
                const { thread, commentId } = await createPublicationWithComment(fixtures, repoBackendClient, commentBackendClient, client);

                await expect(
                    client.updateReaderComment(thread.id, "asdf", { text: "some other comment" }, fixtures.getAccountId())
                ).rejects.toThrow("Not allowed to change");

                await expect(
                    client.updateReaderComment("asdf", commentId, { text: "some other comment" }, fixtures.getAccountId())
                ).rejects.toThrow("Not allowed to change");
            });
        });

        it("returns unauthorized when reader comment flag is not enabled", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const user = await fixtures.users.createAdmin();
                const repoBackendClient = await repoClientFactory.createBackend();
                const commentBackendClient = await commentClientFactory.createBackend();
                const client = await commentClientFactory.createForFrontend(user.id);
                const { thread, commentId } = await createPublicationWithComment(fixtures, repoBackendClient, commentBackendClient, client);

                await expect(
                    client.updateReaderComment(thread.id, commentId, { text: "some other comment" }, fixtures.getAccountId())
                ).rejects.toThrow("authorization issue");
            });
        });
    });

    it("uses the target user to change and delete the comment, and the device user for auth", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
            // Create document
            const doc = await fixtures.items.createDocument({ title: "Some title", languageCode: ["en"], chunkTexts: ["one"] }, { addToRoot: true });
            const chunkId = doc.binderLog.current[0].uuid;
            const [publicationSummary] = await fixtures.items.publishDoc(doc.id, ["en"]);

            // Create device and target & give access to device
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create();
            await fixtures.authorization.assignItemRole(doc.id, deviceUser.id, "Reader");
            const backendUserClient = await userClientFactory.createBackend();
            await backendUserClient.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [targetUser.id]);

            // Create and fetch comments
            const client = await commentClientFactory.createAsDeviceTarget(deviceUser.id, targetUser.id, fixtures.getAccountId());
            await client.createReaderComment(publicationSummary.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);
            const [comment] = await client.getReaderComments(doc.id, fixtures.getAccountId());
            await client.updateReaderComment(comment.threadId, comment.commentId, { text: "updated" }, fixtures.getAccountId());

            // Verify that the comment was created by the target user, and not by the device user
            const [updatedComment] = await client.getReaderComments(doc.id, fixtures.getAccountId());
            expect(updatedComment.body).toBe("updated");
            expect(updatedComment.authorId).toBe(targetUser.id);

            // Delete the comment and verify that it's gone
            await client.deleteOwnComment(comment.commentId, comment.threadId, fixtures.getAccountId());
            const commentsAfterDeletion = await client.getReaderComments(doc.id, fixtures.getAccountId());
            expect(commentsAfterDeletion).toHaveLength(0);
        });
    })
});

async function createPublicationWithComment(
    fixtures: TestAccountFixtures,
    repoBackendClient: BinderRepositoryServiceClient,
    commentBackendClient: CommentServiceClient,
    commentClient: CommentServiceClient,
): Promise<{ thread: ExtendedCommentThread, commentId: string, doc: Binder }> {
    const doc = await fixtures.items.createDocument({ title: "Some title", languageCode: ["en"], chunkTexts: ["one"] }, { publish: true, addToRoot: true });
    const [publication] = await repoBackendClient.findPublications(doc.id, { languageCodes: ["en"] }, { binderSearchResultOptions: { maxResults: 1 } });
    const chunkId = (publication as Publication).binderLog.current[0].uuid;
    const commentId = await commentClient.createReaderComment(publication.id, chunkId, fixtures.getAccountId(), DEFAULT_COMMENT_TEXT);
    const [thread] = await commentBackendClient.getCommentThreads(doc.id);
    return { thread, commentId, doc };
}

