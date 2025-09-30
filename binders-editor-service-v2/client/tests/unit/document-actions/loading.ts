import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { generateJSON } from "@tiptap/core";

// Mock window.bindersConfig before importing any modules that depend on it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).window = {
    bindersConfig: {
        isExternalUser: false,
        api: {
            token: "test-token"
        }
    }
};

jest.mock("../../../src/documents/Composer/components/BinderLanguage/TextEditor/TextEditor", () => ({
    TipTapExtensions: []
}));

jest.mock("@tiptap/core", () => ({
    generateJSON: jest.fn()
}));

jest.mock("../../../src/documents/api", () => ({
    APILoadBinder: jest.fn()
}));

jest.mock("../../../src/accounts/api", () => ({
    APIFindSemanticLinks: jest.fn()
}));

jest.mock("../../../src/accounts/store", () => ({
    default: {
        getAccountFeatures: jest.fn(() => ({ result: [] }))
    }
}));

jest.mock("@binders/client/lib/draftjs/helpers", () => ({
    deserializeEditorStates: jest.fn()
}));

jest.mock("@binders/client/lib/react/flux/dispatcher", () => {
    const mockDispatcher = {
        register: jest.fn(),
        dispatch: jest.fn()
    };
    return {
        dispatch: jest.fn(),
        dispatcher: mockDispatcher,
        Dispatcher: jest.fn().mockImplementation(() => mockDispatcher)
    };
});

jest.mock("../../../src/documents/store", () => ({
    KEY_ACTIVE_BINDER: "KEY_ACTIVE_BINDER",
    KEY_BACKEND_META_MODULE: "KEY_BACKEND_META_MODULE",
    default: {
        getState: jest.fn(() => new Map())
    }
}));

jest.mock("../../../src/shared/fluxwebdata", () => ({
    wrapAction: jest.fn()
}));

// Import after all mocks are set up
import { normalizeBinderJson } from "../../../src/documents/actions/loading";

describe("normalizeBinderJson", () => {
    const mockGenerateJSON = generateJSON as jest.MockedFunction<typeof generateJSON>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateJSON.mockImplementation((html) => ({ 
            type: "doc", 
            content: [{ type: "paragraph", content: [{ type: "text", text: html }] }] 
        }));
    });

    it("should return the original binder when no normalization is needed", () => {
        const binder: Binder = {
            modules: {
                text: {
                    chunked: [
                        {
                            key: "test-key",
                            iso639_1: "en",
                            chunks: [["<p>Hello</p>"], ["<p>World</p>"]],
                            json: ["{\"type\":\"doc\"}", "{\"type\":\"doc\"}"],
                            editorStates: []
                        }
                    ]
                }
            }
        } as Binder;
        const result = normalizeBinderJson(binder);
        expect(result).toBe(binder);
        expect(mockGenerateJSON).not.toHaveBeenCalled();
    });

    it("should normalize binder when json array is missing", () => {
        const binder: Binder = {
            modules: {
                text: {
                    chunked: [
                        {
                            key: "test-key",
                            iso639_1: "en",
                            chunks: [["<p>Hello</p>"], ["<p>World</p>"]],
                            editorStates: []
                        }
                    ]
                }
            }
        } as Binder;

        const result = normalizeBinderJson(binder);
        expect(result.modules?.text?.chunked?.[0].json).toHaveLength(2);
        expect(result.modules?.text?.chunked?.[0].json?.[0]).toBe("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"<p>Hello</p>\"}]}]}");
        expect(result.modules?.text?.chunked?.[0].json?.[1]).toBe("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"<p>World</p>\"}]}]}");
    });

    it("should normalize binder when json array has empty entries", () => {
        const binder: Binder = {
            modules: {
                text: {
                    chunked: [
                        {
                            key: "test-key",
                            iso639_1: "en",
                            chunks: [["<p>First</p>"], ["<p>Second</p>"]],
                            json: ["{\"type\":\"doc\"}", ""],
                            editorStates: []
                        }
                    ]
                }
            }
        } as Binder;

        const result = normalizeBinderJson(binder);
        expect(result.modules?.text?.chunked?.[0].json?.[1]).toBe("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"<p>Second</p>\"}]}]}");
    });

});