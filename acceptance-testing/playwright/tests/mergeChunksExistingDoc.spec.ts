// import {
//     createUniqueTestLogin
// } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
// import { fixElasticBinderDocument } from "../helpers/elastic";
// import { join } from "path";
// import { pwTest } from "../pwTest";
// import { v4 } from "uuid";

// pwTest("Merge chunks existing document", async ({ createWindow, seed, fixtures }) => {
//     const login = createUniqueTestLogin();
//     const password = createUniqueTestLogin();

//     await seed({
//         users: [{ login, password, isAdmin: true }]
//     });

//     const path = join(__dirname, "../../files/seeds/binders/railways.json");
//     const accountId = fixtures.getAccountId();
//     const rootCollection = await fixtures.items.getOrCreateRootCollection();
//     const user = await fixtures.users.getUserByLogin(login);
//     const options = {
//         id: v4(),
//         ancestors: [rootCollection.id],
//         userId: user.id,
//         domainCollectionId: rootCollection.id,
//         accountId: accountId
//     }
//     const [indexName, fixedDoc] = await fixElasticBinderDocument(path, options);
//     await fixtures.items.restoreElasticDocument(indexName, options.id, fixedDoc);
//     await fixtures.items.addDocToCollection(rootCollection.id, options.id);

//     const editorWindow = await createWindow();
//     const editor = await editorWindow.openEditorAsUser(login, password);
//     await editor.browse.clickItem("Railways");
//     function doMerge(chunkIndex: number, totalChunks: number) {
//         return editor.composer.waitForAutoSave({
//             callback: async () => {
//                 await editor.composer.mergeChunkIntoAbove(chunkIndex, totalChunks);
//             }
//         })
//     }


//     await doMerge(11, 11);
//     await doMerge(10, 10);
//     await doMerge(9, 9);
//     await doMerge(8, 8);
//     await doMerge(7, 7);
//     await doMerge(6, 6);
//     await doMerge(4, 5);
//     await doMerge(3, 4);
//     await doMerge(2, 3);
//     await doMerge(1, 2);
//     await editor.composer.publish(true);

//     const window2 = await createWindow();
//     const reader = await window2.openReaderAsUser(login, password);
//     await reader.browser.openStoryByTitle("Railways");
//     await reader.document.assertChunkContent(1, /.*Required tools.*/);
//     await reader.document.assertChunkContent(2, /.*with your colleagues.*/);

// });