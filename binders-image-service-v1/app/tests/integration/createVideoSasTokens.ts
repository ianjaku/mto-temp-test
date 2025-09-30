import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const imageClientFactory = new ClientFactory(
    config,
    ImageServiceClient,
    "v1"
);

describe("createVideoSasTokens", () => {


    // This test is disable because the implementation of createVideoSasTokens
    // needs a visual in mongoDB to work.
    // it("creates SAS tokens for video upload", async () => {
    //     return await globalFixtures.withAnyAccount(async () => {
    //         const client = await imageClientFactory.createBackend();
    //         const response = await client.createVideoSasTokens(["vid-test-id"]);
    //         expect(Object.keys(response).length).toBe(1);
    //         expect(response["vid-test-id"]).toBeDefined();
    //     });
    // });

    it("Returns a 401 when the user does not have view access", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const binder = await fixtures.items.createDocument();
            // Uploading an image is faster than a video. This test tests auth, which is the same for both.
            const visualId = await fixtures.images.uploadVisual(
                binder.id,
                [__dirname, "assets/testimage.jpg"],
                { visualUsage: VisualUsage.BinderChunk }
            );
            const user = await fixtures.users.create();
            const client = await imageClientFactory.createForFrontend(user.id);
            expect(
                client.createVideoSasTokens([visualId], fixtures.getAccountId())
            ).rejects.toThrow("401");
        });
    });

    it("Returns a SAS token when the user has view access", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const binder = await fixtures.items.createDocument();
            // Uploading an image is faster than a video. This test tests auth, which is the same for both.
            const visualId = await fixtures.images.uploadVisual(
                binder.id,
                [__dirname, "assets/testimage.jpg"],
                { visualUsage: VisualUsage.BinderChunk }
            );
            const user = await fixtures.users.create();
            await fixtures.authorization.assignItemPermission(binder.id, user.id, [PermissionName.VIEW]);
            const client = await imageClientFactory.createForFrontend(user.id);
            const response = await client.createVideoSasTokens([visualId], fixtures.getAccountId());
            expect(Object.keys(response).length).toBe(1);
            expect(response[visualId]).toBeDefined();
        });
    });

    it("Returns a SAS token on public manuals and not logged in", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const binder = await fixtures.items.createDocument();
            // Uploading an image is faster than a video. This test tests auth, which is the same for both.
            const visualId = await fixtures.images.uploadVisual(
                binder.id,
                [__dirname, "assets/testimage.jpg"],
                { visualUsage: VisualUsage.BinderChunk }
            );
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), binder.id);
            const client = await imageClientFactory.createForFrontend();
            const response = await client.createVideoSasTokens([visualId], fixtures.getAccountId());
            expect(Object.keys(response).length).toBe(1);
            expect(response[visualId]).toBeDefined();
        });
    });

});
