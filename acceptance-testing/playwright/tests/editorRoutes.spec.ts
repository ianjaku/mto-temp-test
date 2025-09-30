import { it, pwTest } from "../pwTest";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

const DOC_TITLE = "Example document";
const FIRST_CHUNK_CONTENT = "Some content"

pwTest("Editor routes", async ({ createTabs, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const { itemTree } = await seed({
        features: [FEATURE_PUBLICCONTENT],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    title: DOC_TITLE,
                    type: "document",
                    published: true,
                    languageCode: ["en", "ro"],
                    chunks: [FIRST_CHUNK_CONTENT, "Second chunk"],
                },
            ],
            roles: { Admin: [login] },
        },
    });

    const binderId = itemTree.items.at(1).id;

    const [editorTab1, editorTab2, editorTab3, editorTab4] = await createTabs(4);
    const editor1 = await editorTab1.openEditor("/login");
    await editor1.login.loginWithEmailAndPass(login, password);
    await editor1.cookieBanner.declineCookies();

    await it("opens a document through route without collection ID", async () => {
        const editor2 = await editorTab2.openEditor(`/documents/${binderId}`)
        await editor2.composer.expectChunkValue(0, FIRST_CHUNK_CONTENT);
    });

    await it("opens a document in a secondary language by its code", async () => {
        const editor3 = await editorTab3.openEditor(`/documents/${binderId}?langCode=ro`)
        await editor3.composer.expectChunkValue(0, "");
    });

    await it("opens a document with missing language code defaults to main", async () => {
        const editor4 = await editorTab4.openEditor(`/documents/${binderId}?langCode=es`)
        await editor4.composer.expectChunkValue(0, FIRST_CHUNK_CONTENT);
    });
});