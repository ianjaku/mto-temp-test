import { attemptToFixImagesWithoutId } from "../../../src/scripts/fixCorruptBinders/attemptToFixImagesWithoutId";
import { createNewBinder } from "@binders/client/lib/binders/create";

const DEFAULT_BINDER_PARAMS = {
    accountId: "aid-20fac188-7a97-458b-b186-b2a3511b3b78",
    languageCode: "nl",
    title: "Binder title",
    editorState: "test"
};

describe("attemptToFixImagesWithoutId", () => {
    test("only the invalid images should be removed from a binder", async () => {
        const binderParams = DEFAULT_BINDER_PARAMS;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const binder: any = createNewBinder(binderParams.accountId, binderParams.languageCode, "upgrade test", binderParams.editorState);

        binder["bindersVersion"] = "0.4.0";
        binder.id = "AVrd3UDtWsBl3LBoWtnu";
        binder.modules.images.chunked = [
            {
                key: "i1",
                chunks: [
                    [
                        "path/to/illustration1.jpg",
                        {
                            id: "some-invalid-id",
                            languageCodes: [],
                            bgColor: "#fff",
                            fitBehaviour: "fit",
                            url: "some-url",
                            formatUrls: [],
                            status: "ready"
                        },
                        {
                            id: "some-invalid-id2",
                            languageCodes: [],
                            bgColor: "#fff",
                            fitBehaviour: "fit",
                            url: "https://api.binders.media/images/v1/binders/AWy5-UmB65ZAyUDJcMgk/img-c4e9df91-267c-4707-b89e-0dd2f5d0fb3c/original",
                            formatUrls: [],
                            status: "ready"
                        },
                    ],
                    [
                        {
                            id: "img-c4e9df91-267c-4707-b89e-0dd2f5d0fb3d",
                            languageCodes: [],
                            bgColor: "#fff",
                            fitBehaviour: "fit",
                            url: "some-url",
                            formatUrls: [],
                            status: "ready"
                        }
                    ],
                    [],
                ]
            }];

        const fixed = await attemptToFixImagesWithoutId({ _source: binder });

        const chunk0 = fixed.esHit._source.modules.images.chunked[0].chunks[0];
        expect(chunk0.length).toBe(2);

        const chunk1 = fixed.esHit._source.modules.images.chunked[0].chunks[1];
        expect(chunk1.length).toBe(1);

        expect(chunk0[0]).toBe("path/to/illustration1.jpg");
        expect(chunk0[1].id).toBe("img-c4e9df91-267c-4707-b89e-0dd2f5d0fb3c");
        expect(chunk1[0].id).toBe("img-c4e9df91-267c-4707-b89e-0dd2f5d0fb3d");
    });
});
