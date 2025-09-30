import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";
import sleep from "@binders/binders-service-common/lib/util/sleep";

pwTest("Duplication", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const rootCollectionTitle = "Root collection";
    const testCollectionTitle = "Test document";
    const collectionBaseName = "collection to duplicate";
    const collectionDupName = "duplicated collection";
    const documentBaseName = "document to duplicate";
    const documentDupName = "duplicated document";


    await seed({
        users: [
            { login, password }
        ],
        items: {
            type: "collection",
            title: rootCollectionTitle,
            roles: {
                Editor: [login]
            },
            children: [
                {
                    type: "collection",
                    title: testCollectionTitle,
                }
            ]

        }
    });
    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem(rootCollectionTitle);
    await editor.browse.clickItem(testCollectionTitle);
    await editor.browse.assertInEmptyCollection();

    await editor.browse.startCreateNewCollection();
    await editor.newCollectionModal.fillName(collectionBaseName);
    await editor.newCollectionModal.clickOk();
    await editor.modals.waitForModalToClose();

    await editor.browse.assertInEmptyCollection();

    await editor.browse.startCreateNewDocument();
    await editor.newDocumentModal.clickOk();
    await editor.modals.waitForModalToClose();

    await editor.composer.fillTitle(documentBaseName);
    await editor.composer.uploadFileToChunk(1, realpathSync("files/media/portrait.jpg"), 1);
    await editor.composer.publish(true);

    await editor.breadcrumbs.clickBreadcrumb(collectionBaseName);

    await editor.browse.clickItemContextMenu(documentBaseName);
    await editor.browse.clickItemInContextMenu("Duplicate");

    await editor.translocationModal.clickOk();

    await editor.browse.clickUnpublishedItem(documentBaseName);
    await editor.composer.fillTitle(documentDupName);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle(testCollectionTitle);
    await reader.browser.openStoryByTitle(collectionBaseName);
    await reader.browser.openStoryByTitle(documentDupName);

    await reader.document.assertChunkContent(1, documentDupName);

    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen1.png",
        {
            maxDiffPixelRatio: 0.02
        }
    );

    await editor.breadcrumbs.clickBreadcrumb(testCollectionTitle);

    await editor.browse.clickItemContextMenu(collectionBaseName);
    await editor.browse.clickItemInContextMenu("Duplicate");

    await editor.translocationModal.treeNavigator.toParent();
    await editor.translocationModal.clickOk();
    await editor.modals.waitForModalToClose();

    await editor.browse.clickItemContextMenu(collectionBaseName);
    await editor.browse.clickItemInContextMenu("Edit");
    await editor.collectionEditModal.fillNameOnIndex(0, collectionDupName);
    await editor.collectionEditModal.clickDone();
    await editor.browse.assertLoadedItem(collectionDupName);
    await sleep(1000);

    await editor.browse.clickItem(collectionDupName);
    await editor.browse.clickUnpublishedItem(documentDupName);
    await editor.composer.publish(true);

    const readerWindow2 = await createWindow();
    const reader2 = await readerWindow2.openReader();
    await reader2.login.loginWithEmailAndPass(login, password);
    await reader2.browser.openStoryByTitle(collectionDupName);
    await reader2.browser.openStoryByTitle(documentDupName);
    await reader2.document.assertChunkContent(1, documentDupName);
    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen2.png",
        {
            maxDiffPixelRatio: 0.03
        }
    );
})
