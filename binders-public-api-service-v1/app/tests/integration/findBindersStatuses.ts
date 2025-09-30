/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    ApprovedStatus,
    BinderApprovalStatus
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { ResponseFormat } from "@binders/binders-service-common/lib/middleware/response/response";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { withProtocol } from "@binders/client/lib/util/uri";
import { zipObj } from "ramda";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    PublicApiServiceClient,
    "v1"
);
const routingClientFactory = new ClientFactory(
    config,
    RoutingServiceClient,
    "v1"
);
const repoClientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

describe("findBindersStatuses", () => {

    describe("empty state", () => {
        it("returns nothing when there are no binders", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const user = await fixtures.users.createAdmin();
                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());
                const result = await client.findBindersStatuses();
                expect(result.length).toBe(0);
            });
        });
    })

    describe("permissions", () => {
        it("returns only binders the user has access to", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const doc1 = await fixtures.items.createDocument({}, { addToRoot: true });
                await fixtures.items.createDocument({}, { addToRoot: true });
                const user = await fixtures.users.create();
                await fixtures.authorization.assignItemPermission(doc1.id, user.id, [PermissionName.VIEW]);

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].id).toBe(doc1.id);
            });
        });
    })

    describe("pagination", () => {
        it("only returns binders that were created after minCreationDate", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const user = await fixtures.users.createAdmin();
                await fixtures.items.createDocument({}, { addToRoot: true });
                const startDate = new Date();
                const doc = await fixtures.items.createDocument({}, { addToRoot: true });

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses({
                    minCreationDate: startDate.toISOString()
                });

                expect(result.length).toBe(1);
                expect(result[0].id).toBe(doc.id);
            });
        });

        it("only returns [maxResults] binders", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.items.createDocument({}, { addToRoot: true });
                await fixtures.items.createDocument({}, { addToRoot: true });
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses({
                    maxResults: 1
                });

                expect(result.length).toBe(1);
            });
        });

        it("only returns [maxResults] binders, and only returns binders starting from [minCreationDate]", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.items.createDocument(
                    { title: "Doc before minCreationDate" },
                    { addToRoot: true }
                );
                const doc2 = await fixtures.items.createDocument(
                    { title: "Doc at minCreationDate" },
                    { addToRoot: true }
                );
                const doc3 = await fixtures.items.createDocument(
                    { title: "Doc after minCreationDate but maxResults: 1 will make it not be returned" },
                    { addToRoot: true }
                );

                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses({
                    maxResults: 1,
                    minCreationDate: new Date(doc2.created).toISOString()
                });

                expect(result.length).toBe(1);
                expect([doc2.id, doc3.id]).toContain(result[0].id);
            });
        });
    })

    describe("parent collections", () => {
        it("returns all ids of parent collections", () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const doc = await fixtures.items.createDocument({}, { addToRoot: false });
                const parent = await fixtures.items.createCollection({}, { addToRoot: false });
                const grandparent = await fixtures.items.createCollection({}, { addToRoot: true });
                const rootColl = await fixtures.items.getOrCreateRootCollection();
                await fixtures.items.addCollToCollection(grandparent.id, parent.id);
                await fixtures.items.addDocToCollection(parent.id, doc.id);
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0]["parentTitle1"]).toEqual(extractTitle(rootColl));
                expect(result[0]["parentTitle2"]).toEqual(extractTitle(grandparent));
                expect(result[0]["parentTitle3"]).toEqual(extractTitle(parent));
                expect(result[0]["title"]).toEqual(extractTitle(doc));
            });
        });
    });

    describe("approval status", () => {
        it("returns undefined, when the account does not have approval enabled", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.items.createDocument({}, { addToRoot: true });
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBeUndefined();
            });
        });

        it("returns EMPTY, when no chunks have been approved or rejected", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_APPROVAL_FLOW]);
                await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true });
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBe(BinderApprovalStatus.EMPTY);
            });
        });

        it("returns APPROVED, when all chunks have been approved", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_APPROVAL_FLOW]);
                const doc = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true });
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[0].uuid,
                    "en",
                    ApprovedStatus.APPROVED
                );
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBe(BinderApprovalStatus.APPROVED);
            });
        });

        it("returns REJECTED, when any chunk has been rejected", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_APPROVAL_FLOW]);
                const doc = await fixtures.items.createDocument({ languageCode: "en", chunkTexts: ["one", "two"] }, { addToRoot: true });
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[0].uuid,
                    "en",
                    ApprovedStatus.REJECTED
                );
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[1].uuid,
                    "en",
                    ApprovedStatus.APPROVED
                );
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBe(BinderApprovalStatus.REJECTED);
            });
        });

        it("returns INCOMPLETE, when another language is incomplete", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_APPROVAL_FLOW]);
                const doc = await fixtures.items.createDocument({
                    languageCode: ["en", "nl"],
                    chunkTexts: ["one"]
                }, { addToRoot: true });
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[0].uuid,
                    "en",
                    ApprovedStatus.APPROVED
                );
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBe(BinderApprovalStatus.INCOMPLETE);
            });
        });

        it("returns APPROVED, when multiple languages are fully approved", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_APPROVAL_FLOW]);
                const doc = await fixtures.items.createDocument({
                    languageCode: ["en", "nl"],
                    chunkTexts: ["one"],
                    languageChunks: {
                        nl: ["een"],
                    }
                }, { addToRoot: true, fetchFullDoc: true });
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[0].uuid,
                    "en",
                    ApprovedStatus.APPROVED
                );
                await fixtures.items.setChunkApprovalStatus(
                    doc,
                    doc.binderLog.current[0].uuid,
                    "nl",
                    ApprovedStatus.APPROVED
                );
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].approvalStatus).toBe(BinderApprovalStatus.APPROVED);
            });
        });
    });

    describe("openThreadCount", () => {
        it("returns 0 when there are no comment threads on a binder", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true });
                const user = await fixtures.users.createAdmin();

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].openThreadCount).toBe(0);
            });
        })

        it("returns 1 when there is a single open comment thread", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const doc = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true });
                const user = await fixtures.users.createAdmin();
                await fixtures.items.insertComment(doc.id, doc.binderLog.current[0].uuid, "en", "comment", user.id);

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].openThreadCount).toBe(1);
            });
        });

        it("returns 0 when there is a single resolved thread", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                const doc = await fixtures.items.createDocument({ languageCode: "en" }, { addToRoot: true });
                const user = await fixtures.users.createAdmin();
                const threads = await fixtures.items.insertComment(doc.id, doc.binderLog.current[0].uuid, "en", "comment", user.id);
                await fixtures.items.resolveComment(doc.id, threads[0].id, user.id);

                const repoClient = await repoClientFactory.createBackend();
                await repoClient.calculateBindersStatuses(fixtures.getAccountId());

                const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
                const result = await client.findBindersStatuses();

                expect(result.length).toBe(1);
                expect(result[0].openThreadCount).toBe(0);
            });

        });
    });

    it("returns isPublic for every returned item", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const privDoc = await fixtures.items.createDocument({}, { addToRoot: true, public: false });
            const pubDoc = await fixtures.items.createDocument({}, { addToRoot: true, public: true });
            const user = await fixtures.users.createAdmin();

            const repoClient = await repoClientFactory.createBackend();
            await repoClient.calculateBindersStatuses(fixtures.getAccountId());

            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            const result = await client.findBindersStatuses();

            expect(result.length).toBe(2);
            expect(result.find(r => r.isPublic)?.id).toEqual(pubDoc.id);
            expect(result.find(r => !r.isPublic)?.id).toEqual(privDoc.id);
        });
    });

    it("returns isPublic for child items of public collections", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const coll = await fixtures.items.createCollection({}, { addToRoot: true, public: true });
            const doc = await fixtures.items.createDocument({}, { addToRoot: false, public: false });
            await fixtures.items.addDocToCollection(coll.id, doc.id);
            const user = await fixtures.users.createAdmin();

            const repoClient = await repoClientFactory.createBackend();
            await repoClient.calculateBindersStatuses(fixtures.getAccountId());

            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            const result = await client.findBindersStatuses();

            expect(result.length).toBe(1);
            expect(result[0].isPublic).toBe(true);
        });
    })

    it("will be returned as a csv when format=csv is passed as a query parameter", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const doc = await fixtures.items.createDocument(
                { title: "test-title" },
                { addToRoot: true, fetchFullDoc: true }
            );
            const user = await fixtures.users.createAdmin();

            const repoClient = await repoClientFactory.createBackend();
            await repoClient.calculateBindersStatuses(fixtures.getAccountId());

            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId(), { format: ResponseFormat.CSV });
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const editorLocation = await getEditorLocation(fixtures);

            const result = await client.findBindersStatuses({ format: "csv" }) as unknown as string;

            expect(typeof result).toBe("string");
            const lines = result.split("\n");
            expect(lines.length).toBe(2);
            const headers = lines[0].split(",");
            const values = lines[1].split(",");
            const actual = zipObj(headers, values);
            const expected = objectMap({
                id: doc.id,
                isPublic: false,
                openThreadCount: 0,
                title: "test-title",
                chunkCount: 1,
                hasDraft: false,
                lastPublicationDate: undefined,
                created: doc.created,
                draftLanguages: "'xx'",
                editorLink: `${editorLocation}/documents/${doc.id}`,
                publishedLanguages: "",
                parentTitle1: extractTitle(rootCollection),
                accountId: fixtures.getAccountId(),
                binderCreationDate: doc.created,
            }, toCsvValue);
            expect(actual).toEqual(expected);
        });
    });

});

const toCsvValue = (val: unknown): string => (val == null) ? "" : `"${val}"`;

async function getEditorLocation(fixtures: TestAccountFixtures) {
    const routingService = await routingClientFactory.createBackend();
    const filters = await routingService.getDomainFiltersForAccounts([fixtures.getAccountId()]);
    const domain = filters[0].domain;
    return withProtocol(domain.replace(".manual.to", ".editor.manual.to"));
}

const objectMap = (obj: Record<string, unknown>, f: (u: unknown) => string): Record<string, string> => {
    return zipObj(
        Object.keys(obj),
        Object.keys(obj).map(key => f(obj[key])));
}
