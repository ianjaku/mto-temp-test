import { it, pwTest } from "../pwTest";
import { FEATURE_DOCUMENT_OWNER } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Document ownership setting", async ({ createTabs, fixtures, seed }, testInfo) => {
    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }
    const login1 = createUniqueTestLogin();
    const login2 = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const COL_TITLE_1 = "Collection 1";
    const COL_TITLE_2 = "Collection 2";
    const DOC_TITLE_1 = "Document 1";
    const DOC_TITLE_2 = "Document 2";

    await seed({
        features: [FEATURE_DOCUMENT_OWNER ],
        users: [
            { login: login1, password },
            { login: login2, password }
        ],
        items: {
            type: "collection",
            title: COL_TITLE_1,
            children: [{
                type: "collection",
                title: COL_TITLE_2,
                children: [{
                    title: DOC_TITLE_1,
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: [
                        "First chunk",
                        "Second chunk",
                    ]
                }, {
                    title: DOC_TITLE_2,
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: [
                        "First chunk",
                        "Second chunk",
                    ],
                }],
                roles: {
                    Editor: [login2]
                }
            }],
            roles: {
                Editor: [login1]
            }
        },
    });

    const user1 = await fixtures.users.getUserByLogin(login1);
    const group = await fixtures.groups.create()
    await fixtures.groups.addUserToGroup(group.id, user1.id);

    const [editorUser1Tab, editorUser2Tab, readerUser2Tab] = await createTabs(3);
    const editor = await editorUser1Tab.openEditorAsUser(login1, password);

    await it("Sets ownership on the collection to the group", async () => {
        await editor.browse.clickItemContextMenu(COL_TITLE_1);
        await editor.browse.clickItemInContextMenu("Ownership");
        await editor.modals.documentOwnership.switchToGroups();
        await editor.modals.documentOwnership.searchGroup(group.name);
        await editor.modals.documentOwnership.clickAutocompleteItem(group.name);
        await editor.modals.documentOwnership.save();
    });

    await it("Sets ownership on the document to the user and validates limited access to parent collection", async () => {
        const editor2 = await editorUser2Tab.openEditorAsUser(login2, password);
        await editor2.browse.clickItem(COL_TITLE_2);
        await editor2.browse.clickItem(DOC_TITLE_2);
        await editor2.composer.clickOwnershipButton();
        await editor2.modals.documentOwnership.expectRestrictedAccessToParentSettings();
        await editor2.modals.documentOwnership.clickOverride();
        await editor2.modals.documentOwnership.searchUser(login2);
        await editor2.modals.documentOwnership.clickAutocompleteItem(login2);
        await editor2.modals.documentOwnership.save();
    });

    await it("Validated the reader sees the configured owners", async () => {
        const reader = await readerUser2Tab.openReaderAsUser(login2, password);
        await reader.browser.openStoryByTitle(DOC_TITLE_1);
        await reader.document.showOwners();
        await reader.document.assertOwner(login1);
        await reader.document.clickUpButton();
        await reader.browser.openStoryByTitle(DOC_TITLE_2);
        await reader.document.showOwners();
        await reader.document.assertOwner(login2);
    })
});
