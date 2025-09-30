import {
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { bootstrapTrialEnvironment } from "../../src/accountservice/trial/bootstrapTrialEnv";
import { create } from "@binders/client/lib/binders/custom/class";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1",
);

describe("Bootstrap trial accounts", () => {

    let repoServiceClient: BinderRepositoryServiceClient;
    let accountServiceClient: AccountServiceClient;
    let authorizationServiceClient: AuthorizationServiceClient;
    let routingServiceClient: RoutingServiceClient;
    let userServiceClient: UserServiceClient;

    beforeAll(async () => {
        accountServiceClient = await clientFactory.createBackend();
        repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "trial-integration-test");
        authorizationServiceClient = await BackendAuthorizationServiceClient.fromConfig(config, "trial-integration-test", { skipCache: true });
        routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "trial-integration-test");
        userServiceClient = await BackendUserServiceClient.fromConfig(config, "trial-integration-test");
    });

    const withBootstrappedTestEnv = async (callback: (userCollectionId: string) => Promise<void>) => {

        await globalFixtures.withFreshAccount(async (fixtures) => {
            const templateCollection = await fixtures.items.createCollection({ title: "template", languageCode: "en" });
            const templateDocumentRaw = await fixtures.items.createDocument({
                title: "Welcome",
                languageCode: "en",
                chunkTexts: ["Dummy chunk"],
            });
            await fixtures.items.updateBinderText(templateDocumentRaw, "en", "Initial document"); // provides lastModifiedDate and lastModifiedBy in meta
            await fixtures.items.getOrCreateRootCollection();
            await fixtures.items.addDocToCollection(templateCollection.id, templateDocumentRaw.id);
            await fixtures.items.addCollToRootCollection(templateCollection.id);

            const result = await bootstrapTrialEnvironment(
                {
                    accountServiceClient,
                    repoServiceClient,
                    authorizationServiceClient,
                    routingServiceClient,
                    userServiceClient
                },
                {
                    trialAccountId: fixtures.getAccountId(),
                    templateCollectionId: templateCollection.id,
                    companyName: "User Inc.",
                    login: createUniqueTestLogin(),
                    firstName: "John",
                    lastName: "Doe",
                },
            );
            await callback(result.userCollection.id);
        });
    };

    it("succeeds in bootstrapping a test environment", async () => {
        await withBootstrappedTestEnv(async (userCollectionId) => {
            // collection was duplicated with correct name
            const userCollection = await repoServiceClient.getCollection(userCollectionId);
            expect(userCollection.titles.some(t => t.title === "User Inc.")).toBe(true);

            // a published welcome document is in it
            const welcomeDocElement = userCollection.elements.pop();
            const [welcomeDocRaw, publications] = await Promise.all([
                repoServiceClient.getBinder(welcomeDocElement.key),
                repoServiceClient.findPublicationsBackend({ binderId: welcomeDocElement.key }, { maxResults: 1 }),
            ]);

            expect(publications).toHaveLength(1);
            expect(publications[0].language.storyTitle).toBe("Welcome");

            // the document has no authors nor last edited info
            const welcomeDoc = create(welcomeDocRaw);
            expect(welcomeDoc.getAuthorIds()).toHaveLength(0);
            const metaModulesWithLastModifiedFound = welcomeDoc.getModules().meta.some(metaModule =>
                metaModule.lastModifiedDate ||
                metaModule.lastModifiedBy
            );
            expect(metaModulesWithLastModifiedFound).toBe(false);
            expect(welcomeDoc.getLastModified()).toBeUndefined();
            expect(welcomeDoc.getLastModifiedBy()).toBeUndefined();

            // user is member of trial account
            const { hits } = await userServiceClient.searchUsers({}, {}, [userCollection.accountId]);
            const johnDoe = hits.find(u => u.lastName === "Doe");
            expect(johnDoe).toBeDefined();

            // user has edit permissions on the collection and nowhere else
            const userAccess = await userServiceClient.listUserAccess(userCollection.accountId, johnDoe.id);
            expect(userAccess.length).toEqual(1);
            expect(userAccess[0].role === "Editor");

        });
    });
});
