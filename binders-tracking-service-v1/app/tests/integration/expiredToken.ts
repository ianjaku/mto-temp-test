import { buildLogTokenSignConfig, signJWT } from "@binders/binders-service-common/lib/tokens/jwt";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const trackingClientFactory = new ClientFactory(
    config,
    TrackingServiceClient,
    "v1"
);

describe("Logging an event with expired token", () => {
    it("does not fail", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const user = await fixtures.users.create();
            const logTokenSignConfig = buildLogTokenSignConfig(config);

            logTokenSignConfig.options.expiresIn = "-1s";
            const expiredToken = await signJWT({ userId: user.id, purpose: "log-token" }, logTokenSignConfig)

            const data = {
                events: [
                    {
                        timestamp: Date.now(),
                        eventType: 500,
                        accountId: fixtures.getAccountId(),
                        userId: user.id,
                        authToken: expiredToken,
                    }
                ],
                userId: user.id,
            };

            const client = await trackingClientFactory.createForFrontend();

            const response = await client.log(data.events)
            expect(response).toBe(true);

            const backendClient = await trackingClientFactory.createBackend();
            const result = await backendClient.findEvents(fixtures.getAccountId(), {});
            expect(result.length).toBe(1);
        });
    });
});
