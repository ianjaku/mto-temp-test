import { it, pwTest } from "../pwTest";
import {
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { FEATURE_ACCOUNT_ANALYTICS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pollForEvents } from "../helpers/events";


async function aggregateUserEvents(config, accountId) {
    const client = await BackendTrackingServiceClient.fromConfig(
        config,
        "acceptance-testing-analytics-test"
    );
    const options = {
        maxAttempts: 25,
        initialDelay: 1000,
        eventType: EventType.DOCUMENT_CLOSED,
        eventCount: 2
    };
    await pollForEvents(client, accountId, options)
    await client.aggregateUserEvents([accountId]);
}

pwTest("Subcollection Analytics", async ({ createTabs, fixtures, seed }) => {
    const accountAdminUser = createUniqueTestLogin();
    const contentAdminUser = createUniqueTestLogin();
    const groupName = createUniqueTestLogin();
    const aggregateCollection = "Parent collection";
    const adminRightsCollection = "Admin collection";
    const editorRightsCollection = "Editor collection";

    const { users } = await seed({
        features: [ FEATURE_ACCOUNT_ANALYTICS ],
        users: [
            { login: contentAdminUser, password: contentAdminUser }
        ],
        items: {
            type: "collection",
            title: aggregateCollection,
            roles: {
                Reader: [contentAdminUser]
            },
            children: [
                {
                    type: "collection",
                    title: adminRightsCollection,
                    roles: {
                        Admin: [contentAdminUser]
                    },
                },
                {
                    type: "collection",
                    title: editorRightsCollection,
                    roles: {
                        Editor: [contentAdminUser]
                    }
                }
            ]
        }
    });
    const accountId = fixtures.getAccountId();
    const group = await fixtures.groups.create(groupName);
    await fixtures.users.createAdmin({ login: accountAdminUser, password: accountAdminUser });
    const [user2] = users;
    await fixtures.groups.addUserToGroup(group.id, user2.id);

    const [contentAdminTab1, contentAdminTab2] = await createTabs(2);

    const documentTitle = "Document 1";
    const editor = await contentAdminTab1.openEditorAsUser(contentAdminUser, contentAdminUser);
    await editor.browse.clickItem(adminRightsCollection);
    await editor.browse.startCreateNewDocument();
    await editor.newDocumentModal.clickOk();
    await editor.modals.waitForModalToClose();
    await editor.composer.fillTitle(documentTitle);
    await editor.composer.expectChunkValue(0, documentTitle);
    await editor.composer.fillChunk(0, "This is chunk 1");
    await editor.composer.fillNewChunk("This is chunk 2");
    await editor.composer.waitForAutoSave();
    await editor.composer.publish(true);

    async function reader1() {
        const [accountAdminTab] = await createTabs(1);
        const readerAccountAdmin = await accountAdminTab.openReaderAsUser(accountAdminUser, accountAdminUser);
        await readerAccountAdmin.browser.openStoryByTitle(aggregateCollection);
        await readerAccountAdmin.browser.openStoryByTitle(adminRightsCollection);
        await readerAccountAdmin.browser.openStoryByTitle(documentTitle);
        await readerAccountAdmin.document.goToNextChunk();
        await readerAccountAdmin.document.goToTop();
        // Needs a minimum of 1 second or the user action will be filtered out
        await readerAccountAdmin.document.wait(2_000);
        await readerAccountAdmin.document.clickUpButton();
    }

    async function reader2() {
        const readerContentAdmin = await contentAdminTab2.openReaderAsUser(contentAdminUser, contentAdminUser);
        await readerContentAdmin.browser.openStoryByTitle(adminRightsCollection);
        await readerContentAdmin.browser.openStoryByTitle(documentTitle);
        await readerContentAdmin.document.goToNextChunk();
        await readerContentAdmin.document.goToTop();
        // Needs a minimum of 1 second or the user action will be filtered out
        await readerContentAdmin.document.wait(2_000);
        await readerContentAdmin.document.clickUpButton();
    }
    await Promise.all([reader1(), reader2()]);

    const config = BindersConfig.get();
    await aggregateUserEvents(config, accountId);

    await editor.leftNavigation.clickAnalytics();

    await it("Default filter works as expected", async () => {
        await editor.accountAnalytics.expectNumberOfActions(5);
    });

    await it("User filtering works as expected", async () => {
        const user1Filter = { users: [contentAdminUser] };
        await editor.accountAnalytics.setFilter(user1Filter);
        await editor.accountAnalytics.expectNumberOfActions(4);
    });

    await it("User group filtering works as expected", async () => {
        const groupFilter = { groups: [groupName] };
        await editor.accountAnalytics.setFilter(groupFilter);
        await editor.accountAnalytics.expectNumberOfActions(4);
    });

    await it("Editor access collections are not visible", async () => {
        await editor.accountAnalytics.expectNotPresentInContentFilter(editorRightsCollection);
    });

    await it("Complex filtering works as expected", async () => {
        await editor.accountAnalytics.setFilter({
            content: [adminRightsCollection],
            actions: ["Created Item", "Published document", "Read Document"],
            users: [contentAdminUser]
        });
        await editor.accountAnalytics.expectNumberOfActions(3);
    });
});