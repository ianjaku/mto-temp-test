import {
    Binder,
    FeedbackParams,
    IBinderFeedback
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_ANONYMOUS_RATING,
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    isBinder,
    isDocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/validation";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientExportApiResponseFormat } from "@binders/client/lib/clients/client";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import parse from "csv-parse/lib/es5/sync";


const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

const FEEDBACK_1 = {
    isAnonymous: false,
    message: "Hello",
    rating: 4,
};
const FEEDBACK_2 = {
    isAnonymous: true,
    message: "World",
    rating: 2,
};

describe("getMostRecentPublicationUserFeedback", () => {
    it("should return feedback based on most recent publication", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const binder = await fixtures.items.createDocument({ languageCode: [ "en" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const [ firstPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);

            await fixtures.items.updateBinderText(binder, "en", "Second");
            const [ secondPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);
            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), secondPublication.id, FEEDBACK_1);

            await fixtures.items.updateBinderText(binder, "en", "Third");
            const [ thirdPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);
            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), thirdPublication.id, FEEDBACK_2);

            await fixtures.items.updateBinderText(binder, "en", "Fourth");
            const [ fourthPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);

            const firstPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(firstPublication.id);
            expect(firstPublicationFeedback).toBeNull();

            const secondPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(secondPublication.id);
            expectFeedbacks([ secondPublicationFeedback ], [ FEEDBACK_1 ]);

            const thirdPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(thirdPublication.id);
            expectFeedbacks([ thirdPublicationFeedback ], [ FEEDBACK_2 ]);

            const fourthPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(fourthPublication.id);
            expectFeedbacks([ fourthPublicationFeedback ], [ FEEDBACK_2 ]);
        });
    });

    it("should return feedback based on language", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const publish = async (binder: Binder, language: string) => {
                await fixtures.items.updateBinderText(binder, language, new Date().toISOString());
                const publications = await fixtures.items.publishDoc(binder.id, [ language ]);
                return publications.find(publication => publication.language.iso639_1 === language && publication.isActive);
            };

            const binder = await fixtures.items.createDocument({ languageCode: [ "en", "ro" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const firstRoPublication = await publish(binder, "ro");
            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), firstRoPublication.id, FEEDBACK_1);

            const firstEnPublication = await publish(binder, "en");

            const secondEnPublication = await publish(binder, "en");
            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), secondEnPublication.id, FEEDBACK_2);

            const firstRoPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(firstRoPublication.id);
            expectFeedbacks([ firstRoPublicationFeedback ], [ FEEDBACK_1 ]);

            const firstEnPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(firstEnPublication.id);
            expect(firstEnPublicationFeedback).toBeNull();

            const secondEnPublicationFeedback = await repositoryClient.getMostRecentPublicationUserFeedback(secondEnPublication.id);
            expectFeedbacks([ secondEnPublicationFeedback ], [ FEEDBACK_2 ]);
        });
    });
});

describe("createOrUpdateFeedback", () => {
    it("should fail on invalid feedback", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const binder = await fixtures.items.createDocument({ languageCode: [ "en" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const [ publication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);

            await expect(() =>
                repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), publication.id, { message: "" } as FeedbackParams)
            ).rejects.toThrow("Invalid or missing value for isAnonymous");

            await expect(() =>
                repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), publication.id, { isAnonymous: true } as FeedbackParams)
            ).rejects.toThrow("Neither the rating nor the message have values");

            await expect(() =>
                repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), publication.id, { isAnonymous: true, rating: 6 } as FeedbackParams)
            ).rejects.toThrow("Value 6 is outside [1, 5] interval");
        });
    });

    xit("should updated the feedback when publication is the same", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const binder = await fixtures.items.createDocument({ languageCode: [ "en" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const [ publication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);

            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), publication.id, FEEDBACK_1);
            const firstBinderFeedbacksResult = await repositoryClient.getBinderFeedbacks(binder.id);
            expectFeedbacks(firstBinderFeedbacksResult, [FEEDBACK_1]);

            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), publication.id, FEEDBACK_2);
            const secondBinderFeedbacksResult = await repositoryClient.getBinderFeedbacks(binder.id);
            expectFeedbacks(secondBinderFeedbacksResult, [FEEDBACK_2]);
        });
    });

    it("should create a new feedback when publication is different", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const binder = await fixtures.items.createDocument({ languageCode: [ "en" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const [ firstPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);

            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), firstPublication.id, FEEDBACK_1);
            await fixtures.items.updateBinderText(binder, "en", "asdf");
            const [ secondPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);
            await repositoryClient.createOrUpdateFeedback(fixtures.getAccountId(), secondPublication.id, FEEDBACK_2);

            const binderFeedbacks = await repositoryClient.getBinderFeedbacks(binder.id);
            expectFeedbacks(binderFeedbacks, [FEEDBACK_1, FEEDBACK_2]);
        });
    });
});

describe("exportBinderFeedbacks", () => {
    it("should export all feedbacks in csv format", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const accountProvider = () => fixtures.getAccountId();
            const repositoryClient = await clientFactory.createBackend(() => fixtures.getAccountId());

            const user1 = await fixtures.users.createAdmin();
            const user1RepoClient = await clientFactory.createForFrontend(user1.id, accountProvider);
            const user2 = await fixtures.users.createAdmin();
            const user2RepoClient = await clientFactory.createForFrontend(user2.id, accountProvider);

            const binder = await fixtures.items.createDocument({ languageCode: [ "en" ], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            const [ firstPublication ] = await fixtures.items.publishDoc(binder.id, [ "en" ]);
            await user1RepoClient.createOrUpdateFeedback(fixtures.getAccountId(), firstPublication.id, FEEDBACK_1);
            await user2RepoClient.createOrUpdateFeedback(fixtures.getAccountId(), firstPublication.id, FEEDBACK_2);

            const expectedFeedbacks = await repositoryClient.getBinderFeedbacks(binder.id);
            const csv = await repositoryClient.exportBinderFeedbacks(binder.id, ClientExportApiResponseFormat.CSV);
            const records = parse(csv, { delimiter: ",", columns: true });
            expect(records.length).toEqual(expectedFeedbacks.length);
            expect(records).toEqual(expect.arrayContaining(
                expectedFeedbacks.map(fb => expect.objectContaining({
                    Id: fb.id,
                    BinderId: fb.binderId,
                    PublicationId: fb.publicationId,
                    UserLogin: fb.isAnonymous ? "" : fb.userLogin,
                    UserName: fb.isAnonymous ? "" : fb.userName,
                    Message: fb.message ?? "",
                    Rating: `${ fb.rating ?? "" }`,
                    CreatedDate: fb.created.toISOString(),
                    UpdatedDate: fb.updated.toISOString(),
                }))
            ))
        });
    });
});

describe("feedbackConfig in getReaderItemContext", () => {
    test("no feedback config when feature flag is off", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const rootCol = await fixtures.items.getOrCreateRootCollection();
            await fixtures.authorization.assignItemPermission(rootCol.id, user.id, [PermissionName.VIEW]);
            const repositoryClientUser = await clientFactory.createForFrontend(user.id, () => fixtures.getAccountId());
            const readerItemContext = await repositoryClientUser.getReaderItemContext(rootCol.id);
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).not.toBeDefined();
        });
    });

    test("no feedback config when skipReaderFeedbackConfig flag is provided", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
            const rootCol = await fixtures.items.getOrCreateRootCollection();
            const repositoryClientUser = await clientFactory.createBackend(() => fixtures.getAccountId());
            const readerItemContext = await repositoryClientUser.getReaderItemContext(rootCol.id, undefined, { skipReaderFeedbackConfig: true });
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).not.toBeDefined();
        });
    });

    test("comments not allowed, feedback allowed when public and anonymous rating set", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_READER_COMMENTING, FEATURE_READER_RATING, FEATURE_ANONYMOUS_RATING]);
            const rootCol = await fixtures.items.getOrCreateRootCollection();
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), rootCol.id);
            const repositoryClientUser = await clientFactory.createForFrontend(undefined, () => fixtures.getAccountId());
            const readerItemContext = await repositoryClientUser.getReaderItemContext(rootCol.id);
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).toBe(false);
            expect(readerItemContext.feedbackConfig.readerRatingEnabled).toBe(true);
        });
    });

    test("feedback config enabled when feature flag is on but unset on item level", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
            const rootCol = await fixtures.items.getOrCreateRootCollection();
            const user = await fixtures.users.create();
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), rootCol.id);
            const repositoryClientUser = await clientFactory.createForFrontend(user.id, () => fixtures.getAccountId());
            const readerItemContext = await repositoryClientUser.getReaderItemContext(rootCol.id);
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).toBe(true);
        });
    });

    test("feedback config depends on closest ancestor", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_READER_COMMENTING]);
            const user = await fixtures.users.create();
            const { root, items } = await fixtures.items.createItemTree({
                type: "collection",
                title: "root",
                roles: {
                    Editor: [user.login]
                },
                children: [{
                    type: "collection",
                    title: "direct-parent",
                    children: [{
                        type: "document",
                        title: "doc",
                        published: true,
                    }]
                }]
            });

            const doc = items.find(i => isBinder(i) && i.languages[0].storyTitle === "doc");
            const directParent = items.find(i => isDocumentCollection(i) && i.titles.some(t => t.title === "direct-parent"));

            const repositoryClientBackend = await clientFactory.createBackend(() => fixtures.getAccountId());
            await repositoryClientBackend.updateReaderFeedbackConfig(root.id, { readerCommentsEnabled: true });

            let readerItemContext = await repositoryClientBackend.getReaderItemContext(doc.id);
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).toBe(true);

            await repositoryClientBackend.updateReaderFeedbackConfig(directParent.id, { readerCommentsEnabled: false });

            readerItemContext = await repositoryClientBackend.getReaderItemContext(doc.id);
            expect(readerItemContext.feedbackConfig.readerCommentsEnabled).toBe(false);

        });
    });
});



const expectFeedbacks = (actualFeedback: IBinderFeedback[], expectedFeedbacks: FeedbackParams[]) => {
    expect(actualFeedback.length).toEqual(expectedFeedbacks.length);
    expect(actualFeedback).toEqual(expect.arrayContaining(
        expectedFeedbacks.map(fb => expect.objectContaining({ ...fb }))
    ));
};
