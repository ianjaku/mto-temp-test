import { Editor } from "@tiptap/core";
import twemoji from "twemoji";
import { useEffect } from "react";

export const useFocusEditorOnFocusComponent = (editor: Editor, isFocused: boolean) => {
    useEffect(() => {
        if (isFocused) {
            editor?.commands.focus();
        }
    }, [editor, isFocused]);
}

export const useTwemoji = (editor: Editor) => {
    useEffect(() => {
        if (!editor) {
            return;
        }
        twemoji.parse(editor.view.dom, {
            ext: ".svg",
            folder: "svg",
            base: "/assets/",
            className: "twemoji",
        });
    }, [editor]);
}
