import { Binder } from "../../../src/clients/repositoryservice/v3/contract";
import { ImmutableBinder } from "../../../src/binders/immutable";
import { createNewBinder } from "../../../src/binders/create";
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

function createImmutableBinder(params?: NewBinderParams): ImmutableBinder {
    const binder = createTestBinder(params);
    return ImmutableBinder.fromMutable(binder);
}

it("should be a valid binder", () => {
    const immutableBinder = createImmutableBinder();
    expect(validateBinder(immutableBinder).length).toBe(0);
});
it("should convert back to a simple JS object", () => {
    const immutableBinder = createImmutableBinder();
    expect(validateBinder(immutableBinder.toJS()).length).toBe(0);
});
