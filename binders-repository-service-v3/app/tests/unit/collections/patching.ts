import * as patches from "../../../src/repositoryservice/patching/collections";

import {
    CollectionTitle,
    DocumentCollection,
    IThumbnail
} from "@binders/client/lib/clients/repositoryservice/v3/contract";

const ACCOUNT_ID = "aid-123";
const COLLECTION_TITLE_LANGUAGE = "en";
const COLLECTION_TITLE_TEXT = "Collection title";
const COLLECTION_DOMAIN_COLLECTION_ID = "AV2KUKtPgRcJXleWPkq_";

const COLLECTION_START_TITLE: CollectionTitle = {
    title: COLLECTION_TITLE_TEXT,
    languageCode: COLLECTION_TITLE_LANGUAGE
};
const COLLECTION_THUMBNAIL_URL = "http://fake.to/Thumbnail";
const COLLECTION_START_THUMBNAIL: IThumbnail = {
    medium: COLLECTION_THUMBNAIL_URL,
    fitBehaviour: "fit",
    bgColor: "transparent"
};

const createNewTestCollection: () => DocumentCollection = () => {
    return patches.createNewCollection(
        ACCOUNT_ID,
        COLLECTION_START_TITLE,
        COLLECTION_START_THUMBNAIL,
        false,
        COLLECTION_DOMAIN_COLLECTION_ID,
    );
};

const TEST_BINDER_DESCENDANT = { kind: "binder", key: "b1" };
const TEST_COLLECTION_DESCENDANT = { kind: "collection", key: "c2" };
const TEST_COLLECTION_ELEMENTS = [
    TEST_BINDER_DESCENDANT,
    TEST_COLLECTION_DESCENDANT
];

describe("patch methods for collections", () => {
    it("should create a new collection", () => {
        const startCollection = createNewTestCollection();
        expect(startCollection.accountId).toEqual(ACCOUNT_ID);
        expect(startCollection.titles.length).toEqual(1);
        expect(startCollection.titles[0].languageCode).toEqual(COLLECTION_TITLE_LANGUAGE);
        expect(startCollection.titles[0].title).toEqual(COLLECTION_TITLE_TEXT);
        expect(startCollection.elements.length).toEqual(0);
        expect(startCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(startCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should update the title", () => {
        const startCollection = createNewTestCollection();
        const newTitle = "new title";
        const updatedCollection = patches.setTitle(startCollection, COLLECTION_TITLE_LANGUAGE, newTitle);
        expect(updatedCollection.titles.length).toEqual(1);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.titles[0].languageCode).toEqual(COLLECTION_TITLE_LANGUAGE);
        expect(updatedCollection.titles[0].title).toEqual(newTitle);
        expect(updatedCollection.elements.length).toEqual(0);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should add a new title", () => {
        const startCollection = createNewTestCollection();
        const newLanguage = "nl";
        const newTitle = "new title";
        const updatedCollection = patches.setTitle(startCollection, newLanguage, newTitle);
        expect(updatedCollection.titles.length).toEqual(2);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.titles[0].languageCode).toEqual(COLLECTION_TITLE_LANGUAGE);
        expect(updatedCollection.titles[0].title).toEqual(COLLECTION_TITLE_TEXT);
        expect(updatedCollection.titles[1].languageCode).toEqual(newLanguage);
        expect(updatedCollection.titles[1].title).toEqual(newTitle);
        expect(updatedCollection.elements.length).toEqual(0);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should update the thumbnail", () => {
        const startCollection = createNewTestCollection();
        const newThumbnailURL = "http://new.thumb/";
        const updatedCollection = patches.updateThumbnail(startCollection, {medium: newThumbnailURL, fitBehaviour: "fit", bgColor: "transparent"});
        expect(updatedCollection.titles.length).toEqual(1);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.titles[0].languageCode).toEqual(COLLECTION_TITLE_LANGUAGE);
        expect(updatedCollection.titles[0].title).toEqual(COLLECTION_TITLE_TEXT);
        expect(updatedCollection.elements.length).toEqual(0);
        expect(updatedCollection.thumbnail.medium).toEqual(newThumbnailURL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should add new elements", () => {
        const updatedCollection = TEST_COLLECTION_ELEMENTS.reduce(
            (reduced, element) => patches.addCollectionElement(reduced, element.kind, element.key),
            createNewTestCollection());
        expect(updatedCollection.titles).toMatchObject([
            expect.objectContaining({ ...COLLECTION_START_TITLE })
        ]);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.elements).toMatchObject(
            expect.arrayContaining([
                expect.objectContaining({ ...TEST_BINDER_DESCENDANT }),
                expect.objectContaining({ ...TEST_COLLECTION_DESCENDANT }),
            ]));
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should remove elements on soft delete", () => {
        const fullCollection = TEST_COLLECTION_ELEMENTS.reduce(
            (reduced, element) => patches.addCollectionElement(reduced, element.kind, element.key),
            createNewTestCollection());
        const updatedCollection = patches.removeCollectionElement(fullCollection, "binder", "b1");
        expect(updatedCollection.titles).toMatchObject([
            expect.objectContaining({ ...COLLECTION_START_TITLE })
        ]);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.elements).toMatchObject([
            expect.objectContaining({ ...TEST_COLLECTION_DESCENDANT }),
        ]);
        expect(updatedCollection.deletedElements).toMatchObject([
            expect.objectContaining({ ...TEST_BINDER_DESCENDANT }),
        ]);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should remove elements on hard delete", () => {
        const fullCollection = TEST_COLLECTION_ELEMENTS.reduce(
            (reduced, element) => patches.addCollectionElement(reduced, element.kind, element.key),
            createNewTestCollection());
        const updatedCollection = patches.removeCollectionElement(fullCollection, "binder", "b1", true);
        expect(updatedCollection.titles).toMatchObject([
            expect.objectContaining({ ...COLLECTION_START_TITLE }),
        ]);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.elements).toMatchObject([
            expect.objectContaining({ ...TEST_COLLECTION_DESCENDANT }),
        ]);
        expect(updatedCollection.deletedElements.length).toEqual(0);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should leave elements soft deleted", () => {
        const fullCollection = TEST_COLLECTION_ELEMENTS.reduce(
            (reduced, element) => patches.addCollectionElement(reduced, element.kind, element.key),
            createNewTestCollection());
        const intermediateUpdatedCollection = patches.removeCollectionElement(fullCollection, "binder", "b1");
        const updatedCollection = patches.removeCollectionElement(intermediateUpdatedCollection, "binder", "b1");
        expect(updatedCollection.titles).toMatchObject([
            expect.objectContaining({ ...COLLECTION_START_TITLE })
        ]);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.elements).toMatchObject([
            expect.objectContaining({ ...TEST_COLLECTION_DESCENDANT }),
        ]);
        expect(updatedCollection.deletedElements).toMatchObject([
            expect.objectContaining({ ...TEST_BINDER_DESCENDANT }),
        ]);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
    it("should rearrange elements", () => {
        const startCollection = TEST_COLLECTION_ELEMENTS.reduce(
            (reduced, element) => patches.addCollectionElement(reduced, element.kind, element.key),
            createNewTestCollection());
        const updatedCollection = patches.changeCollectionElementPosition(startCollection, "binder", "b1", 1);
        expect(updatedCollection.titles).toMatchObject([
            expect.objectContaining({ ...COLLECTION_START_TITLE })
        ]);
        expect(updatedCollection.accountId).toEqual(ACCOUNT_ID);
        expect(updatedCollection.elements).toMatchObject([
            expect.objectContaining({ ...TEST_COLLECTION_DESCENDANT }),
            expect.objectContaining({ ...TEST_BINDER_DESCENDANT }),
        ]);
        expect(updatedCollection.thumbnail.medium).toEqual(COLLECTION_THUMBNAIL_URL);
        expect(updatedCollection.domainCollectionId).toEqual(COLLECTION_DOMAIN_COLLECTION_ID);
    });
});