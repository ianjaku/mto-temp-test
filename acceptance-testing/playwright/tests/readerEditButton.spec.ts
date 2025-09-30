import { QUERY_PARAM_DOMAIN } from "@binders/client/lib/react/hooks/useQueryParams";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { getAllPathsToRootCollection } from "@binders/client/lib/ancestors/helpers";
import { pwTest } from "../pwTest";

pwTest("Reader Edit Button", async ({ createWindow, fixtures, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({});

    const user = await fixtures.users.create({ login, password });

    const chunkTexts = [
        "First chunk",
        "Second chunk",
    ]

    const editableBinder = await fixtures.items.createDocument(
        {
            title: "Editable document",
            languageCode: "en",
            chunkTexts
        },
        {
            publish: true,
            addToRoot: true
        }
    );

    const rootCollection = await fixtures.items.getOrCreateRootCollection();

    const binderId = editableBinder.id
    const ancestors = await fixtures.items.getBinderAncestorIds(binderId);
    const allPaths = getAllPathsToRootCollection(binderId, ancestors);

    await fixtures.authorization.assignItemRole(rootCollection.id, user.id, "Reader");

    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle("Editable document");
    await reader.document.editButton.assertIsHidden();

    await reader.browser.goToHome();
    await fixtures.authorization.assignItemRole(rootCollection.id, user.id, "Editor");

    await reader.browser.openStoryByTitle("Editable document");
    await reader.document.editButton.assertIsVisible();

    const url = await reader.document.editButton.url();

    expect(allPaths).toHaveLength(1)
    const binderPath = allPaths.at(0).join("/");
    expect(url.endsWith(`/documents/${binderPath}?${QUERY_PARAM_DOMAIN}=${fixtures.getDomain()}`))
});
