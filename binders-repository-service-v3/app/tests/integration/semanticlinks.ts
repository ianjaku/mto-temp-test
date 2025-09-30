import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { DocumentType } from "@binders/client/lib/clients/model";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const routingClientFactory = new ClientFactory(
    config,
    RoutingServiceClient,
    "v1"
);

describe("Semantic links", () => {
    it("must work with semantic links that contain slashes", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const binder = await fixtures.items.createDocument({}, {addToRoot: true});
            const domain = "test-domain.manual.to";
            const semanticId = `something/else/${Date.now()}`;
            const semanticLink: ISemanticLink = {
                id: undefined,
                binderId: binder.id,
                languageCode: "en",
                documentType: DocumentType.DOCUMENT,
                semanticId,
                domain,
            };

            const routingClient = await routingClientFactory.createBackend();
            const result = await routingClient.setSemanticLink(semanticLink, binder.id);
            expect(result.semanticLink).toBeDefined();

            const semanticLinks = await routingClient.getSemanticLinkById(domain, semanticId);
            expect(semanticLinks.length).toBe(1);
            expect(semanticLinks[0]).toMatchObject({
                semanticId,
                domain
            });
        });
    });
});
