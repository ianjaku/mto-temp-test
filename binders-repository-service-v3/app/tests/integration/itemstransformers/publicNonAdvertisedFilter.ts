import {
    AncestorBuilder,
    ElasticAncestorBuilder
} from "../../../src/repositoryservice/ancestors/ancestorBuilder";
import {
    Binder,
    BinderSearchResultOptions,
    CollectionFilter,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MockProxy, mock } from "jest-mock-extended";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../../src/repositoryservice/esquery/helper";
import {
    ElasticCollectionsRepository
} from "../../../src/repositoryservice/repositories/collectionrepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import {
    PublicNonAdvertisedFilterTransformer
} from "../../../src/repositoryservice/itemstransformers/publicNonAdvertisedFilter";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

describe("publicNonAdvertisedFilter ItemsTransformer", () => {

    let authorizationServiceClient: AuthorizationServiceClient;
    let ancestorBuilder: AncestorBuilder;
    let testAccountFixtures: TestAccountFixtures;
    let accountId: string;
    let rootCollection: DocumentCollection;
    let collection: DocumentCollection;
    let document: Binder;

    beforeAll(async () => {

        await globalFixtures.withFreshAccount(async fixtures => {
            authorizationServiceClient = await BackendAuthorizationServiceClient.fromConfig(config, "trial-integration-test", { skipCache: true });
            // eslint-disable-next-line prefer-const
            let [rootCol, col, doc] = await Promise.all([
                fixtures.items.getOrCreateRootCollection(),
                fixtures.items.createCollection({ title: "col" }),
                fixtures.items.createDocument({ title: "doc", languageCode: "en" }),
            ]);
            await fixtures.items.publishDoc(doc.id, ["en"]);
            rootCol = await fixtures.items.addCollToCollection(rootCol.id, col.id);
            col = await fixtures.items.addDocToCollection(col.id, doc.id);

            rootCollection = rootCol;
            collection = col;
            document = doc;

            const logger: MockProxy<Logger> = mock();

            jest.spyOn(ElasticCollectionsRepository.prototype, "findCollections").mockImplementation(async (
                filter: CollectionFilter,
                _searchOptions: BinderSearchResultOptions,
            ) => {
                if (filter.itemIds?.length === 1 && filter.itemIds[0] === doc.id) {
                    return [collection];
                }
                if (filter.itemIds?.length === 1 && filter.itemIds[0] === col.id) {
                    return [rootCollection];
                }
                if (filter.itemIds?.length === 1 && filter.itemIds[0] === rootCol.id) {
                    return [];
                }
                throw new Error(`No mocked value implemented for filter ${JSON.stringify(filter)}`);
            });

            const collectionRepo = new ElasticCollectionsRepository(
                config,
                logger,
                new DefaultESQueryBuilderHelper(config),
            );

            ancestorBuilder = new ElasticAncestorBuilder(collectionRepo);
            testAccountFixtures = fixtures;
            accountId = fixtures.getAccountId();
        });

    })
    it("Filters out public non-advertised items", async () => {

        const transformer = new PublicNonAdvertisedFilterTransformer(
            authorizationServiceClient,
            ancestorBuilder,
            accountId,
            undefined,
        );
        let retained = await transformer.items([document]);
        // vanilla setup; transformer retains doc
        expect(retained.length).toBe(1);

        await testAccountFixtures.authorization.grantPublicReadAccess(accountId, rootCollection.id);
        retained = await transformer.items([document]);
        // grandparent is public but not advertised; transformer filters out doc
        expect(retained.length).toBe(0);

        rootCollection = await testAccountFixtures.items.updateCollectionShowInOverview(rootCollection.id, true);
        retained = await transformer.items([document]);
        // grandparent is public+advertised; transformer retains doc
        expect(retained.length).toBe(1);

        rootCollection = await testAccountFixtures.items.updateCollectionShowInOverview(rootCollection.id, false);
        await testAccountFixtures.authorization.grantPublicReadAccess(accountId, collection.id);
        collection = await testAccountFixtures.items.updateCollectionShowInOverview(collection.id, true);
        retained = await transformer.items([document]);
        // grandparent is public (non-advertised), parent is public+advertised; transformer retains doc (MT-5346)
        expect(retained.length).toBe(1);

    });
});
