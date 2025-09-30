import { createNewBinder, shallowCloneBinder } from "../../../src/binders/create";
import { Binder } from "../../../src/clients/repositoryservice/v3/contract";
import { validateBinder } from "../../../src/clients/repositoryservice/v3/validation";

interface NewBinderParams {
    accountId: string;
    languageCode: string;
    title: string;
    editorState?: string;
}
const DEFAULT_BINDER_PARAMS: NewBinderParams = {
    accountId: "aid-123",
    languageCode: "nl",
    title: "Binder title"
};

function createTestBinder(params?: NewBinderParams): Binder {
    const binderParams = params ? params : DEFAULT_BINDER_PARAMS;
    return createNewBinder(
        binderParams.accountId,
        binderParams.languageCode,
        binderParams.title,
        binderParams.editorState
    );
}

it("constructs a valid binder", () => {
    const binder = createTestBinder();
    expect(validateBinder(binder).length).toBe(0);
    expect(binder.accountId).toBe(DEFAULT_BINDER_PARAMS.accountId);
    expect(binder.languages[0].iso639_1).toBe(DEFAULT_BINDER_PARAMS.languageCode);
    expect(binder.languages[0].storyTitle).toBe(DEFAULT_BINDER_PARAMS.title);
    expect(binder.modules.images.chunked.length).toBe(1);
    expect(binder.modules.text.chunked.length).toBe(1);
});

it("adds the editor state correctly", () => {
    const params = Object.assign({}, DEFAULT_BINDER_PARAMS);
    const editorState = "Some serialized editor state";
    params.editorState = editorState;
    const binder = createTestBinder(params);
    expect(binder.modules.text.chunked[0].editorStates[0]).toBe(editorState);
});

it("builds a new binder", () => {
    const original = createTestBinder();
    const clone = shallowCloneBinder(original);
    expect(original).not.toBe(clone);
    for (const k in original) {
        expect(original[k]).toEqual(clone[k]);
    }
});
it("excludes to right keys", () => {
    const original = createTestBinder();
    const clone = shallowCloneBinder(original, ["languages"]);
    for (const k in clone) {
        expect(original[k]).toEqual(clone[k]);
    }
    expect(clone["languages"]).toBeUndefined();
});
