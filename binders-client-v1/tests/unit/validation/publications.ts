import { validatePublication } from "../../../src/clients/repositoryservice/v3/validation";

const getDefaultPublication = () => ({
    binderId: "AWssyhBxKoAW3UhAs5hC",
    accountId: "aid-0a9dc7fb-ca83-4b04-a078-443a7b072b4a",
    domainCollectionId: "AV2KURWh7xU0aRIt-77o",
    bindersVersion: "0.4.1",
    thumbnail: {
        medium: "https://s3-eu-west-1.amazonaws.com/manualto-images/document-cover-default.png",
        fitBehaviour: "fit",
        bgColor: "transparent"
    },
    language: {
        iso639_1: "xx",
        modules: [
            "t1"
        ],
        storyTitle: "publ",
        storyTitleRaw: "publ",
        priority: 0
    },
    links: {
        "index-pairs": [
            [
                "t1",
                "i1"
            ]
        ]
    },
    modules: {
        meta: [
            {
                markup: "richtext",
                lastModifiedDate: "2019-06-06T12:36:17.945Z",
                format: "chunked",
                caption: "Original text",
                iso639_1: "xx",
                type: "text",
                key: "t1"
            },
            {
                markup: "url",
                format: "chunked",
                caption: "Original illustrations",
                type: "images",
                key: "i1"
            }
        ],
        images: {
            chunked: [
                {
                    "chunks": [[]],
                    "key": "i1"
                }
            ]
        },
        text: {
            chunked: [
                {
                    chunks: [[]],
                    editorStates: [""],
                    key: "t1"
                }
            ]
        }
    },
    publicationDate: "2019-06-06T12:36:20.219Z",
    isActive: false,
    isMaster: true,
})

test("a valid publication should validate", () => {
    const publication = getDefaultPublication();
    const validationErrors = validatePublication(publication);
    expect(validationErrors).toHaveLength(0);
});

test("a publication with missing accountId shouldn't validate", () => {
    const publication = getDefaultPublication();
    delete publication.accountId;
    const validationErrors = validatePublication(publication);
    expect(validationErrors.length).toBeGreaterThan(0);
});

test("an invalid publication due to different chunk counts shouldn't validate", () => {
    const publication = getDefaultPublication();
    publication.modules.text.chunked[0].chunks.push(["trololol"]);
    const validationErrors = validatePublication(publication);
    expect(validationErrors.length).toBeGreaterThan(0);
});
