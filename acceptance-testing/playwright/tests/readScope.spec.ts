import { DocumentType } from "@binders/client/lib/clients/model";
import { FEATURE_READ_SCOPES } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("make sure reader scope is working as expected", async ({ createTabs, fixtures, seed }) => {


    const userLogin = createUniqueTestLogin();
    const userPassword = createUniqueTestLogin();

    await seed({
        features: [ FEATURE_READ_SCOPES ]
    });
    const outerCollection = await fixtures.items.createCollection({
        title: "Outer collection",
        languageCode: "en"
    }, {
        addToRoot: true
    });

    const semLink = {
        binderId: outerCollection.id,
        languageCode: "en",
        documentType: DocumentType.COLLECTION,
        semanticId: "test/collection",
        domain: fixtures.getDomain()
    }
    await fixtures.routing.setSemanticLink(semLink, outerCollection.id)
    const middleCollection = await fixtures.items.createCollection({
        title: "Middle collection",
        languageCode: "en",
    }, {
        addToCollId: outerCollection.id
    });
    const innerCollection = await fixtures.items.createCollection({
        title: "Inner collection",
        languageCode: "en",
    }, {
        addToCollId: middleCollection.id
    });
    const innerDoc1 = await fixtures.items.createDocument({
        title: "Inner document 1",
        languageCode: "en",
    }, {
        addToCollId: innerCollection.id,
        publish: true
    });
    const innerDoc2 = await fixtures.items.createDocument({
        title: "Inner document 2",
        languageCode: "en",
    }, {
        addToCollId: innerCollection.id,
        publish: true
    });
    const user = await fixtures.users.create({
        login: userLogin,
        password: userPassword
    });
    await fixtures.authorization.assignItemRole(innerDoc1.id, user.id, "Reader");
    await fixtures.authorization.assignItemRole(innerDoc2.id, user.id, "Reader");
    const [tab1, tab2] = await createTabs(2);
    const reader1 = await tab1.openReaderAsUser(userLogin, userPassword);
    await reader1.browser.expectStoryByTitle("Inner document 1");

    const reader2 = await tab2.openReader("/test/collection");
    await reader2.browser.expectStoryByTitle("Inner document 1");
    await reader2.browser.expectStoryByTitle("Inner document 2");
});