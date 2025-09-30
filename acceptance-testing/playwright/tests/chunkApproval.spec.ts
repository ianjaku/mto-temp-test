import { FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import ts from "@binders/client/lib/i18n/translations/en_US";

pwTest("Chunk Approval", async ({ createWindow, fixtures, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Chunk Approval",
                type: "document",
                published: true,
                roles: {
                    Reader: [login],
                },
                chunks: [
                    "First chunk",
                ]
            }],
            roles: {
                Editor: [login]
            }
        },
    });

    await fixtures.setFeatures([FEATURE_APPROVAL_FLOW]);

    const window = await createWindow();
    const editor = await window.openEditor("/login");

    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("Chunk Approval");

    await editor.composer.expectMissingApprovalsStatus();

    await editor.composer.approveChunk(0);
    await editor.composer.approveChunk(1);

    await editor.composer.waitForUpToDateMsg();
    await editor.composer.clearChunkApproval(0);
    await editor.composer.expectMissingApprovalsStatus();

    await editor.composer.fillNewChunk("");
    await editor.composer.deleteActiveChunk();
    await editor.composer.waitForChunksCount(2);
    await editor.composer.waitForChunkApprovalState(1, "approved");

    await editor.composer.approveAll();
    await editor.modals.chunkApproval.expectModalBodyTextToContain(
        ts.Edit_ChunkApproveAllConfirm.replace("{{count}}", "1")
    )
    await editor.modals.chunkApproval.confirm();

    await editor.composer.expectNoStatus();

    await editor.composer.fillChunk(0, "Changed text");
    await editor.composer.expectMissingApprovalsStatus();
    await editor.composer.approveChunk(1);
    await editor.composer.expectNoStatus();

    await editor.composer.rejectChunk(1);
    await editor.composer.expectMissingApprovalsStatus();
    await editor.composer.approveChunk(1);
    await editor.composer.expectNoStatus();

    await editor.composer.publish(true);
    await editor.composer.waitForUpToDateMsg();

    // Ensure setting primary language does not reset chunk approval or publish state
    await editor.rightPane.setPrimaryLanguage("English", true);
    await editor.composer.expectApproveAllButtonNotAvailable();
    await editor.composer.expectPublishButtonDisabled();

    // Ensure changing language does not reset chunk approval or publish state
    await editor.rightPane.publishing.openPane();
    await editor.rightPane.publishing.changePrimaryLanguage("Romanian");
    await editor.modals.clickOk();
    await editor.rightPane.publishing.closePane();
    await editor.composer.expectApproveAllButtonNotAvailable();
    await editor.composer.expectPublishButtonDisabled();
});
