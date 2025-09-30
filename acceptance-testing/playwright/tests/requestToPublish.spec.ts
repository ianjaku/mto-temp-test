import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_NOTIFICATIONS
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    NotificationKind,
    NotifierKind
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";


pwTest("Request to publish", async ({ createWindow, seed, fixtures }) => {

    const login = createUniqueTestLogin();
    await seed({
        features: [FEATURE_APPROVAL_FLOW, FEATURE_NOTIFICATIONS],
        users: [
            {
                login: login,
                password: "nothanks"
            }
        ],
        items: {
            type: "document",
            title: "Document",
            languageCode: "en",
            chunks: ["chunk 1"],
            roles: {
                Reviewer: [login]
            }
        }
    });

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await editor.login.loginWithEmailAndPass(login, "nothanks");
    await editor.cookieBanner.acceptCookies();

    await editor.browse.clickItem("Document");

    await editor.composer.approveChunk(0);
    await editor.composer.approveChunk(1);

    await editor.composer.expectRequestToPublishButtonDisabled();
    
    const adminUser = await fixtures.users.createAdmin({ displayName: "John Dough" });
    const rootColl = await fixtures.items.getOrCreateRootCollection();
    // We add a review request target to make sure we still get the request to publish button
    // even though we have a review request target (covers: https://bindersmedia.atlassian.net/browse/MT-4283)
    await fixtures.notificationTargets.create({
        targetId: adminUser.id,
        itemId: rootColl.id,
        notificationKind: NotificationKind.REVIEW_REQUEST,
        notifierKind: NotifierKind.USER_EMAIL
    });
    await fixtures.notificationTargets.create({
        targetId: adminUser.id,
        itemId: rootColl.id,
        notificationKind: NotificationKind.PUBLISH_REQUEST,
        notifierKind: NotifierKind.USER_EMAIL
    });

    await window.openEditor();
    await editor.browse.clickItem("Document");
    await editor.hubspotWidget.maybeClose();
    await editor.composer.clickRequestToPublishButton();

    await editor.flashMessage.expectSuccessFlashMessage("Request sent to John Dough");
});
