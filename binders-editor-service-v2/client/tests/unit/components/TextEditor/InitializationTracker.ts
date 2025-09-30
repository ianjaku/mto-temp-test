import {
    InitializationTracker,
    wasTriggeredDuringInitialization
} from "../../../../src/documents/Composer/components/BinderLanguage/TextEditor/custom-tiptap-extensions/InitializationTracker";
import Document from "@tiptap/extension-document";
import { Editor } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";

describe("InitializationTracker", () => {
    let editor: Editor;
    let mockDateNow: jest.SpyInstance;
    let mockTime = 0;

    beforeEach(() => {
        jest.useFakeTimers();

        mockDateNow = jest.spyOn(Date, "now").mockImplementation(() => mockTime);
        mockTime = 1000000; // Start at arbitrary time

        editor = new Editor({
            extensions: [
                Document,
                Paragraph,
                Text,
                InitializationTracker,
            ],
            content: "<p>Test content</p>",
        });
    });

    afterEach(() => {
        editor?.destroy();
        jest.useRealTimers();
        mockDateNow.mockRestore();
    });

    it("marks transactions as triggered during initialization for the first 300ms", () => {
        const tr = editor.state.tr.insertText("test");
        editor.view.dispatch(tr);
        expect(wasTriggeredDuringInitialization(tr)).toBe(true);
    });

    it("marks transactions as NOT triggered during initialization after 300ms", () => {
        mockTime += 350;
        const tr = editor.state.tr.insertText("new text");
        editor.view.dispatch(tr);
        expect(wasTriggeredDuringInitialization(editor.view.state.tr)).toBe(false);
    });

    it("resets initialization state when editor is recreated", () => {
        mockTime += 350;
        editor.destroy();
        mockTime += 1000;
        editor = new Editor({
            extensions: [
                Document,
                Paragraph,
                Text,
                InitializationTracker,
            ],
            content: "<p>New content</p>",
        });
        const tr = editor.state.tr.insertText("test");
        editor.view.dispatch(tr);
        expect(wasTriggeredDuringInitialization(tr)).toBe(true);
    });
});
