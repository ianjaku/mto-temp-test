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
import { pwTest } from "../pwTest";


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

pwTest("Account Analytics", async ({ createTabs, fixtures, seed }) => {

    const login1 = createUniqueTestLogin();
    const login2 = createUniqueTestLogin();
    const groupName = createUniqueTestLogin();
    const collectionName1 = createUniqueTestLogin();
    const collectionName2 = createUniqueTestLogin();
    const collectionName3 = createUniqueTestLogin();

    const { users } = await seed({
        features: [ FEATURE_ACCOUNT_ANALYTICS ],
        users: [
            { login: login2, password: login2 }
        ],
        items: {
            type: "collection",
            title: collectionName1,
            roles: {
                Reader: [login2]
            },
            children: [
                {
                    type: "collection",
                    title: collectionName2,
                },
                {
                    type: "collection",
                    title: collectionName3,
                    roles: {
                        Editor: [login2]
                    }
                }
            ]
        }
    });
    const accountId = fixtures.getAccountId();
    const rootCollectionName = (await fixtures.getAccount()).name;
    const group = await fixtures.groups.create(groupName);
    await fixtures.users.createAdmin({ login: login1, password: login1 });
    const [user2] = users;

    await fixtures.groups.addUserToGroup(group.id, user2.id);


    const [user1Tab1, user1Tab2] = await createTabs(2);

    const documentTitle = "Document 1";
    const editor = await user1Tab1.openEditorAsUser(login1, login1);
    await editor.browse.clickItem(collectionName1);
    await editor.browse.clickItem(collectionName2);
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
        const readerUser1 = await user1Tab2.openReaderAsUser(login1, login1);
        await readerUser1.browser.openStoryByTitle(collectionName1);
        await readerUser1.browser.openStoryByTitle(collectionName2);
        await readerUser1.browser.openStoryByTitle(documentTitle);
        await readerUser1.document.goToNextChunk();
        await readerUser1.document.goToTop();
        // Needs a minimum of 1 second or the user action will be filtered out
        await readerUser1.document.wait(2_000);
        await readerUser1.document.clickUpButton();
    }

    async function reader2() {
        const [user2Tab1] = await createTabs(1);
        const readerUser2 = await user2Tab1.openReaderAsUser(login2, login2);
        await readerUser2.browser.openStoryByTitle(collectionName2);
        await readerUser2.browser.openStoryByTitle(documentTitle);
        await readerUser2.document.goToNextChunk();
        await readerUser2.document.goToTop();
        // Needs a minimum of 1 second or the user action will be filtered out
        await readerUser2.document.wait(2_000);
        await readerUser2.document.clickUpButton();
    }
    await Promise.all([reader1(), reader2()]);

    const config = BindersConfig.get();
    await aggregateUserEvents(config, accountId);

    await editor.leftNavigation.clickAnalytics();

    await editor.accountAnalytics.expectNumberOfActions(5);

    // Check actions for user 1
    const user1Filter = { users: [login1] };
    await editor.accountAnalytics.setFilter(user1Filter);
    await editor.accountAnalytics.expectNumberOfActions(4);

    // Check actions for group
    const groupFilter = { groups: [groupName] };
    await editor.accountAnalytics.setFilter(groupFilter);
    await editor.accountAnalytics.expectNumberOfActions(1);


    // Filter on collections
    const collection2Filter = {
        content: [rootCollectionName, collectionName1, collectionName2]
    }
    await editor.accountAnalytics.setFilter(collection2Filter);
    await editor.accountAnalytics.expectNumberOfActions(5);

    const collection3Filter = {
        content: [rootCollectionName, collectionName1, collectionName3]
    }
    await editor.accountAnalytics.setFilter(collection3Filter);
    await editor.accountAnalytics.expectNumberOfActions(0);

    const actionsFilter = { actions: ["Created Item", "Published document"]}
    await editor.accountAnalytics.setFilter(actionsFilter);
    await editor.accountAnalytics.expectNumberOfActions(2);

    const combinedFilter1 = {
        content: [rootCollectionName, collectionName1, collectionName2],
        actions: ["Created Item", "Published document", "Read Document"],
        users: [login1]
    }
    await editor.accountAnalytics.setFilter(combinedFilter1);
    await editor.accountAnalytics.expectNumberOfActions(3);
});