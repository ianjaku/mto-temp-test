import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";



pwTest("Check if the user online property is set correctly", async ({ createWindow, seed }, testInfo) => {

    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }

    const login1 = createUniqueTestLogin();
    const login2 = createUniqueTestLogin();

    const documentTitle = "Document 1";

    await seed({
        users: [
            { login: login1, password: login1, isAdmin: true },
            { login: login2, password: login2 }
        ],
        items: {
            type: "collection",
            title: "Collection 1",
            roles: {
                Reader: [login2]
            },
            children: [
                {
                    type: "document",
                    title: documentTitle,
                    published: true,
                    chunks: [ "Chunk 1" ],
                }
            ]
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditorAsUser(login1, login1);
    await editor.leftNavigation.clickUsers();
    const userDetails = await editor.users.getUserDetails(login2);
    expect(userDetails.lastOnline).toBeUndefined();
    await editorWindow.close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReaderAsUser(login2, login2);
    await reader.browser.openStoryByTitle(documentTitle);
    await readerWindow.close();

    const editorWindow2 = await createWindow();
    const editor2 = await editorWindow2.openEditorAsUser(login1, login1, true);
    await editor2.leftNavigation.clickUsers();
    const userDetails2 = await editor2.users.getUserDetails(login2);
    expect(userDetails2.lastOnline instanceof Date).toBe(true);
    await editorWindow2.close();
});