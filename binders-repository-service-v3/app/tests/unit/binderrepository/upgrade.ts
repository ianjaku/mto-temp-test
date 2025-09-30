import { constructV040Binder, createNewBinder } from "@binders/client/lib/binders/create";

const DEFAULT_BINDER_PARAMS = {
    accountId: "aid-20fac188-7a97-458b-b186-b2a3511b3b78",
    languageCode: "nl",
    title: "Binder title",
    editorState: "test"
};

describe("binders upgrade", () => {
    it("DUMMY should upgrade a V0.3.0 binder to V0.4.0", () => {
        const binderParams = DEFAULT_BINDER_PARAMS;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const binder: any = createNewBinder(binderParams.accountId, binderParams.languageCode, "upgrade test", binderParams.editorState);

        binder["bindersVersion"] = "0.3.0";
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
                    ]
                ]
            }];
        binder.modules.text.chunked = [
            {
                key: "t1",
                chunks: [[ "some text" ], ["<p></p>"]],
                editorStates: [""]
            }
        ];
        const upgradedBinder = constructV040Binder(binder);

        const imageArray = upgradedBinder.modules.images.chunked[0].chunks[1];

        expect(upgradedBinder.bindersVersion).toEqual("0.4.0");
        expect(imageArray).toBeDefined();
        expect(imageArray[1]).toBeDefined();
        expect(imageArray[1].url).toEqual("path/to/illustration3.jpg");
        expect(imageArray[1].fitBehaviour).toBeDefined();
        expect(imageArray[1].bgColor).toBeDefined();
    });
});