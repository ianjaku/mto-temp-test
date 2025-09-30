import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { calculatePayloadSignature } from "@binders/binders-service-common/lib/tally";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(config, PublicApiServiceClient, "v1");

describe("tallyWebhookPlgSignup", () => {
    let client: PublicApiServiceClient;

    beforeAll(async () => {
        client = await clientFactory.createForFrontend()
    })

    it("rejects requests with invalid account ID", async () => {
        const request = successfulRequest();
        const tallySignature = calculatePayloadSignature(config, request);
        await expect(
            client.tallyWebhookPlgSignup(request, {
                templateCollectionId: "foo",
                trialAccountId: "bar",
                tallySignature,
            })
        ).rejects.toThrow(/Not a valid account id.*/)
    });

    it("rejects requests with invalid collection ID", async () => {
        const request = successfulRequest();
        const tallySignature = calculatePayloadSignature(config, request);
        return globalFixtures.withFreshAccount(async fixtures => {
            await expect(
                client.tallyWebhookPlgSignup(request, {
                    templateCollectionId: "foo",
                    trialAccountId: fixtures.getAccountId(),
                    tallySignature,
                })
            ).rejects.toThrow(/Bootstrap failed/)
        });
    });

    it("rejects valid request with invalid signature", async () => {
        const request = successfulRequest();
        const tallySignature = calculatePayloadSignature(config, request);
        const anotherRequest = successfulRequest();
        return globalFixtures.withFreshAccount(async fixtures => {
            const collection = await fixtures.items.createCollection({ title: "Template Collection" })
            await fixtures.items.createDocument({ title: "Welcome", chunkTexts: ["Hello"], languageCode: "en" })
            await expect(
                client.tallyWebhookPlgSignup(anotherRequest, {
                    templateCollectionId: collection.id,
                    trialAccountId: fixtures.getAccountId(),
                    tallySignature,
                })
            ).rejects.toThrow(/authorization issue/);
        });
    });

    it("accepts valid request", async () => {
        const request = successfulRequest();
        const tallySignature = calculatePayloadSignature(config, request);
        return globalFixtures.withFreshAccount(async fixtures => {
            const collection = await fixtures.items.createCollection({ title: "Template Collection" })
            await expect(
                client.tallyWebhookPlgSignup(request, {
                    templateCollectionId: collection.id,
                    trialAccountId: fixtures.getAccountId(),
                    tallySignature,
                })
            ).resolves.toEqual("");
        });
    });

});

const successfulRequest = () => ({
    "eventId": "d1365ddb-a0cb-483b-8ee0-ce33509f08ce",
    "createdAt": "2025-02-20T13:32:58.704Z",
    "data": {
        "responseId": "e18fc3cd-ed2b-431f-996a-4b2a87926695",
        "submissionId": "mZjPkB",
        "respondentId": "w7XW2n",
        "formId": "wM7dMX",
        "formName": "Try out Manual.to",
        "createdAt": "2020-01-01T00:00:00.000Z",
        "fields": [
            {
                "key": "question_LzqKQz",
                "label": "First name",
                "type": "INPUT_TEXT",
                "value": "Foo"
            },
            {
                "key": "question_pd6oly",
                "label": "Last name",
                "type": "INPUT_TEXT",
                "value": "Bar"
            },
            {
                "key": "question_1kg414",
                "label": "Work email",
                "type": "INPUT_EMAIL",
                "value": createUniqueTestLogin(),
            },
            {
                "key": "question_7bgKG6",
                "label": "Company name",
                "type": "INPUT_TEXT",
                "value": "Acme, Inc."
            },
            {
                "key": "question_b9EeP0",
                "label": "LinkedIn profile link",
                "type": "INPUT_TEXT",
                "value": ""
            }
        ]
    }
})

