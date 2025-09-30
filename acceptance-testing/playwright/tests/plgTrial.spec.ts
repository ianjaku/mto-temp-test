import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { MailMessage } from "@binders/client/lib/clients/userservice/v1/contract";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { calculatePayloadSignature } from "@binders/binders-service-common/lib/tally";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";

const config = BindersConfig.get();
const clientFactory = new ClientFactory(config, PublicApiServiceClient, "v1");

// Note, this is expecting the mailer service to be mocked
// If running the test locally, set the environment variable BINDERS_MOCK_SERVICES to 'mailer' in devConfig.json
// ...
// "environmentVariables": {
//     ...
//     "BINDERS_MOCK_SERVICES": "mailer"
// }
// ...
pwTest("PLG Trial", async ({ createWindow, fixtures, seed, serviceLocations }) => {
    const plgEmail = createUniqueTestLogin();
    const plgPassword = createUniqueTestLogin();

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const { itemTree } = await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                type: "collection",
                title: "Template (Copy this for new accounts)",
                children: [
                    { type: "document", title: "Welcome", languageCode: "en", chunks: ["Welcome"], published: true },
                    { type: "document", title: "How-to", languageCode: "en", chunks: ["How-to"], published: false },
                ],
            }],
            roles: { Admin: [login] }
        },
    });
    const collection = itemTree.items.at(1)

    const request = tallyWebhookPayload({
        companyName: "ACME, Inc.",
        firstName: "PLG",
        lastName: "User",
        workEmail: plgEmail,
    });
    const tallySignature = calculatePayloadSignature(config, request);
    const publicApiClient = await clientFactory.createForFrontend();
    await expect(
        publicApiClient.tallyWebhookPlgSignup(request, {
            templateCollectionId: collection.id,
            trialAccountId: fixtures.getAccountId(),
            tallySignature,
        })
    ).resolves.toEqual("");

    const account = await fixtures.getAccount();
    const mails = await fixtures.users.getMockedEmails(plgEmail);
    expect(mails.length).toBe(1);
    const mail = mails[0];
    expect(mail.subject).toMatch(new RegExp(`You have been invited to join ${account.name} on manual.to`));

    const link = extractLink(mail, serviceLocations.reader.replace("dockerhost", "172.17.0.1"))
        .replace("172.17.0.1", "dockerhost");

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader(link);
    await reader.invite.expectDisplayNameValue("PLG User");
    await reader.invite.fillIn({ password: plgPassword });
    await reader.invite.clickSubmit();
    await reader.cookieBanner.declineCookies();
    await reader.browser.expectStoryByTitle("Welcome", true)
    await reader.browser.expectStoryByTitle("How-to", true)
    await reader.browser.openStoryByTitle("Welcome");
    await reader.document.editButton.assertIsVisible();
});

function extractLink(mail: MailMessage, serviceLocation: string) {
    const match = mail.html.match(new RegExp(`href="(${serviceLocation}[A-Za-z0-9.:/?=_-]+)`));
    if (!match) throw new Error(`No matching link to ${serviceLocation} found. Email text: ${mail.text}`);
    const link = match[1];
    expect(link.startsWith("http")).toBe(true);
    return link;
}

const tallyWebhookPayload = (params?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    workEmail?: string
}) => ({
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
                "value": params?.firstName
            },
            {
                "key": "question_pd6oly",
                "label": "Last name",
                "type": "INPUT_TEXT",
                "value": params?.lastName
            },
            {
                "key": "question_1kg414",
                "label": "Work email",
                "type": "INPUT_EMAIL",
                "value": params?.workEmail,
            },
            {
                "key": "question_7bgKG6",
                "label": "Company name",
                "type": "INPUT_TEXT",
                "value": params?.companyName
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

