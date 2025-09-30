import { FEATURE_DOWNLOAD_PDF_FROM_READER, FEATURE_PDF_EXPORT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { it, pwTest } from "../pwTest";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";

pwTest("PDF export", async ({ createTabs, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        features: [FEATURE_PDF_EXPORT, FEATURE_DOWNLOAD_PDF_FROM_READER],
        users: [
            { login, password }
        ],
        items: {
            title: "Example document",
            type: "document",
            published: true,
            roles: {
                Editor: [login],
            },
            languageCode: "en",
            chunks: [
                "First chunk",
                "Second chunk",
                "Third chunk",
                "Fourth chunk"
            ],
        }
    });
    const [editorTab, readerTab] = await createTabs(2);

    await it("Exports the PDF from editor", async () => {
        const editor = await editorTab.openEditor();
        await editor.login.loginWithEmailAndPass(login, password);
        await editor.cookieBanner.declineCookies();

        await editor.browse.clickItem("Example document");

        await editor.rightPane.publishing.openPane();
        const download = await editor.rightPane.publishing.exportPdf("Example document");
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
        const path = await download.path();
        expect(path).toBeTruthy();

        await editorTab.close();
    });

    await it("Exports the PDF from reader", async () => {
        const reader = await readerTab.openReader();
        await reader.browser.openStoryByTitle("Example document");

        const download = await reader.topBar.exportPdf();
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
        const path = await download.path();
        expect(path).toBeTruthy();

        await editorTab.close();
    })
});
