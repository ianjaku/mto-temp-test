import { it, pwTest } from "../pwTest";
import { DocumentType } from "@binders/client/lib/clients/model";
import { FEATURE_LIVE_TRANSLATION_ON_READER } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { QUERY_PARAM_MTLC } from "@binders/client/lib/react/hooks/useQueryParams";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import translation from "@binders/client/lib/i18n/translations/en_US";

const DOC_TITLE = "Document to share";
const DOC_SEMANTIC_ID = "shareme";
const FIRST_CHUNK_TEXT = "Hello world";
const FIRST_CHUNK_TEXT_NL = "Hallo mensen"

pwTest("Reader sharing", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const { fixtures, itemTree } = await seed({
        users: [
            { login, password: "nothanks" }
        ],
        items: {
            title: DOC_TITLE,
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                FIRST_CHUNK_TEXT,
            ]
        },
        features: [FEATURE_LIVE_TRANSLATION_ON_READER]
    });

    const binderId = itemTree.items[0].id;

    await fixtures.routing.setSemanticLink(
        {
            binderId,
            languageCode: "en",
            documentType: DocumentType.DOCUMENT,
            semanticId: DOC_SEMANTIC_ID,
            domain: fixtures.getDomain(),
        },
        binderId,
    );

    const readerWindow = await createWindow();
    const tempWindow = await createWindow();
    const reader = await readerWindow.openReader("/login");
    await readerWindow.overrideLaunchDarklyFlag(LDFlags.READER_SHARE_MODAL, true);

    await reader.login.loginWithEmailAndPass(login, "nothanks");
    await reader.browser.openStoryByTitle(DOC_TITLE);
    await reader.cookieBanner.declineCookies();

    await it("shows QR code & access note", async () => {
        await reader.document.readerSharing.openModal();
        await reader.document.readerSharing.assertQrCode();
        await reader.document.readerSharing.closeModal();
    })

    await it("shows restricted access note", async () => {
        await reader.document.readerSharing.openModal();
        await reader.document.readerSharing.assertAccessNote("restricted");
        await reader.document.readerSharing.closeModal();
    })

    await it("shows public access note", async () => {
        await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), binderId);
        await reader.document.readerSharing.openModal();
        await reader.document.readerSharing.assertAccessNote("public");
        await reader.document.readerSharing.closeModal();
    })

    let originalLanguageLink = "";
    let mtLanguageLink = "";

    await it("copies link to clipboard", async () => {
        await reader.document.readerSharing.openModal();
        originalLanguageLink = await reader.document.readerSharing.copyLink(tempWindow.getPage(), DOC_SEMANTIC_ID, 10);
        await reader.document.readerSharing.closeModal();
        const url = new URL(originalLanguageLink)
        expect(url.searchParams.get(QUERY_PARAM_MTLC)).toBeNull();
    })

    await it("copies link with machine translated language code to clipboard", async () => {
        await reader.document.machineTranslateTo("Dutch", "NL");
        await reader.document.readerSharing.openModal();
        mtLanguageLink = await reader.document.readerSharing.copyLink(tempWindow.getPage(), DOC_SEMANTIC_ID, 10);
        await reader.document.readerSharing.closeModal();
        const url = new URL(mtLanguageLink)
        expect(url.searchParams.get(QUERY_PARAM_MTLC)).toEqual("nl");
    })

    await it("opens the correct document via share link", async () => {
        await readerWindow.page.goto(originalLanguageLink);
        await reader.document.assertChunkContent(1, FIRST_CHUNK_TEXT);
    });

    await it(`opens the correct document with original disclaimer via share link with machine translated language without LD flag ${LDFlags.READER_SHARE_MT_DOCUMENTS} `, async () => {
        await readerWindow.overrideLaunchDarklyFlag(LDFlags.READER_SHARE_MT_DOCUMENTS, false);
        await readerWindow.page.goto(mtLanguageLink);
        await reader.ribbons.expectInfoRibbon(translation.DocManagement_MachineTranslationWarning);
    });

    await it(`opens the correct document with chunk disclaimers via share link with machine translated language with LD flag ${LDFlags.READER_SHARE_MT_DOCUMENTS}`, async () => {
        await readerWindow.overrideLaunchDarklyFlag(LDFlags.READER_SHARE_MT_DOCUMENTS, true);
        await readerWindow.page.goto(mtLanguageLink);
        await reader.document.assertChunkDisclaimedContent(1, FIRST_CHUNK_TEXT_NL)
    });

});

