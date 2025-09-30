import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("No unreachable chunk", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [
            { login, password }
        ],
        items: {
            title: "No unreachable chunk",
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                "First chunk",
                "Second chunk",
            ]
        }
    });
    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, password);
    await window.getPage().setViewportSize({ width: 350, height: 1000 }); // comically long screen

    await reader.browser.openStoryByTitle("No unreachable chunk");
    await reader.document.expectChunkToBeActive(0);

});
