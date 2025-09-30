import { createNewBinder } from "../../../src/binders/create";
import { validateBinder } from "../../../src/clients/repositoryservice/v3/validation";

const getDefaultBinder = () => {
    const DEFAULT_BINDER_PARAMS = {
        accountId: "aid-20fac188-7a97-458b-b186-b2a3511b3b78",
        languageCode: "nl",
        title: "Binder title",
        editorState: "test"
    };

    const binderParams = DEFAULT_BINDER_PARAMS;
    const binder = createNewBinder(binderParams.accountId, binderParams.languageCode, "validation test", binderParams.editorState);
    binder["bindersVersion"] = "0.4.0";
    binder.id = "AVrd3UDtWsBl3LBoWtnu";
    return binder;
}

test("a valid binder should validate", () => {
    const binder = getDefaultBinder();
    binder.modules.text.chunked = [
        {
            key: "t1",
            iso639_1: "en",
            chunks: [["some text"]],
            editorStates: [""]
        },
        {
            key: "t2",
            iso639_1: "en",
            chunks: [["some translation"]],
            editorStates: [""]
        }
    ];
    const validationErrors = validateBinder(binder);
    expect(validationErrors).toHaveLength(0);
});

test("an invalid binder due to different chunk counts shouldn't validate", () => {
    const binder = getDefaultBinder();
    binder.modules.text.chunked = [
        {
            key: "t1",
            iso639_1: "en",
            chunks: [["some text"]],
            editorStates: [""]
        },
        {
            key: "t2",
            iso639_1: "en",
            chunks: [],
            editorStates: [""]
        }
    ];
    const validationErrors = validateBinder(binder);
    expect(validationErrors.length).toBeGreaterThan(0);
});
