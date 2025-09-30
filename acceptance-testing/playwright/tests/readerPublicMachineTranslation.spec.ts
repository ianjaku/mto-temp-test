import {
    FEATURE_LIVE_TRANSLATION_ON_READER,
    FEATURE_PUBLICCONTENT
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Public user machine translation", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const { itemTree } = await seed({
        features: [ FEATURE_PUBLICCONTENT, FEATURE_LIVE_TRANSLATION_ON_READER ],
        users: [{ login, password }],
        items: {
            title: "Public document",
            type: "document",
            published: true,
            languageCode: "en",
            chunks: ["Hello"],
            roles: {
                Admin: [login]
            }
        },
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditorAsUser(login, password);

    await editor.browse.clickItemContextMenu("Public document");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.toggleShowOnLandingPage();
    await editor.accessModal.clickDone();
    await editorWindow.close();

    const binderId = itemTree.items.at(-1).id;
    const readerWindow = await createWindow();
    await readerWindow.overrideLaunchDarklyFlag(LDFlags.READER_SHARE_MT_DOCUMENTS, true);
    const reader = await readerWindow.openReader(`/launch/${binderId}`);
    await reader.document.machineTranslateTo("Dutch", "NL");
    await reader.document.assertChunkDisclaimedContent(1, "Hallo")
});
