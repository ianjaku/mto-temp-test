import { constructV040Binder, createNewBinder } from "@binders/client/lib/binders/create";
import { removeEmptyLastChunks } from "../../../src/repositoryservice/patching/binder";

const DEFAULT_BINDER_PARAMS = {
    accountId: "aid-20fac188-7a97-458b-b186-b2a3511b3b78",
    languageCode: "nl",
    title: "Binder title",
    editorState: "test"
};

describe("removing empty chunks", () => {
    it("should remove last empty chunks", () => {
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
                        "path/to/illustration1.jpg"
                    ],
                    [],
                    [],
                ]
            }];
        binder.modules.text.chunked = [
            {
                key: "t1",
                chunks: [[ "some text" ], [], ["<p></p>"]],
                editorStates: [""]
            },
            {
                key: "t2",
                chunks: [[ "some text" ], [], [] ],
                editorStates: [""]
            }
        ]

        const binderV40 = constructV040Binder(binder);

        const normalizedBinder = removeEmptyLastChunks(binderV40);

        const i1Chunked = normalizedBinder.modules.images.chunked.find(c => c.key === "i1");
        const t1Chunked = normalizedBinder.modules.text.chunked.find(c => c.key === "t1");
        const t2Chunked = normalizedBinder.modules.text.chunked.find(c => c.key === "t1");

        expect(i1Chunked.chunks.length).toEqual(1);
        expect(t1Chunked.chunks.length).toEqual(1);
        expect(t2Chunked.chunks.length).toEqual(1);

    });
    it("should only remove last empty chunks when they're empty in all modules", () => {
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
                        "path/to/illustration1.jpg"
                    ],
                    [
                        "path/to/illustration2.jpg",
                        "path/to/illustration3.jpg"
                    ],
                    []
                ]
            }];
        binder.modules.text.chunked = [
            {
                key: "t1",
                chunks: [[ "some text" ], [ "following one is empty" ], ["<p></p>"]],
                editorStates: [""]
            },
            {
                key: "t2",
                chunks: [
                    ["some more text"],["following one has text"],["<p>text</p>"]],
                editorStates: [""]
            }
        ]

        const binderV40 = constructV040Binder(binder);

        const normalizedBinder = removeEmptyLastChunks(binderV40);

        const i1Chunked = normalizedBinder.modules.images.chunked.find(c => c.key === "i1");
        const t1Chunked = normalizedBinder.modules.text.chunked.find(c => c.key === "t1");
        const t2Chunked = normalizedBinder.modules.text.chunked.find(c => c.key === "t1");

        expect(i1Chunked.chunks.length).toEqual(3);
        expect(t1Chunked.chunks.length).toEqual(3);
        expect(t2Chunked.chunks.length).toEqual(3);
    });
});