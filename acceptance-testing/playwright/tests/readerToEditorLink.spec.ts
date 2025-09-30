import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";

pwTest("Reader link to editor", async ({ createTabs, seed, serviceLocations }) => {

    const docContributorLogin = createUniqueTestLogin();
    const colContributorLogin = createUniqueTestLogin();
    const docReaderLogin = createUniqueTestLogin();
    const colReaderLogin = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const users = [
        { login: docContributorLogin, password },
        { login: colContributorLogin, password },
        { login: docReaderLogin, password },
        { login: colReaderLogin, password },
    ]
    const docContributor = users[0];
    const colContributor = users[1];
    const docReader = users[2];
    const colReader = users[3];

    await seed({
        users,
        items: {
            title: "Root Collection",
            type: "collection",
            children: [
                {
                    title: "Child collection",
                    type: "collection",
                    roles: {
                        Contributor: [ colContributorLogin ],
                        Reader: [ colReaderLogin ]
                    },
                    children: [
                        {
                            title: "Inner document",
                            type: "document",
                            roles: {
                                Contributor: [ docContributorLogin ],
                                Reader: [ docReaderLogin ]
                            },
                            published: true
                        },
                    ]
                },
            ]
        }
    });

    const [ tab1, tab2, tab3, tab4 ] = await createTabs(4);

    // Contributor on the document level
    const reader1 = await tab1.openReaderAsUser(docContributor.login, docContributor.password);
    await reader1.browser.expectStoryByTitle("Inner document");
    const url1 = await reader1.topBar.goToEditor();
    expect(url1).toEqual(`${serviceLocations.editor}/browse`);
    await reader1.browser.openStoryByTitle("Inner document");
    const editorDocumentUrl1 = await reader1.document.editButton.url();
    expect(editorDocumentUrl1).toMatch(new RegExp(`${serviceLocations.editor}/documents/.*`));
    const editorDocumentUrl3 = await reader1.document.editButton.click();
    expect(editorDocumentUrl3).toMatch(new RegExp(`${serviceLocations.editor}/documents/.*`));

    // Contributor on the collection level
    const reader2 = await tab2.openReaderAsUser(colContributor.login, colContributor.password);
    await reader2.browser.expectStoryByTitle("Inner document");
    const url2 = await reader2.topBar.goToEditor();
    expect(url2).toMatch(new RegExp(`${serviceLocations.editor}/browse/.*`));
    await reader2.browser.openStoryByTitle("Inner document");
    const editorDocumentUrl2 = await reader2.document.editButton.url();
    expect(editorDocumentUrl2).toMatch(new RegExp(`${serviceLocations.editor}/documents/.*`));
    const editorDocumentUrl4 = await reader2.document.editButton.click();
    expect(editorDocumentUrl4).toMatch(new RegExp(`${serviceLocations.editor}/documents/.*`));

    // Reader on the document level
    const reader3 = await tab3.openReaderAsUser(docReader.login, docReader.password);
    await reader3.browser.expectStoryByTitle("Inner document");
    await reader3.topBar.expectNoLinkToEditor();
    await reader3.browser.openStoryByTitle("Inner document");
    await reader3.document.editButton.assertIsHidden();

    // Reader on the collection level
    const reader4 = await tab4.openReaderAsUser(colReader.login, colReader.password);
    await reader4.browser.expectStoryByTitle("Inner document");
    await reader4.topBar.expectNoLinkToEditor();
    await reader4.browser.openStoryByTitle("Inner document");
    await reader4.document.editButton.assertIsHidden();

})
