import { Extension } from "@tiptap/core";
import { MutableRefObject } from "react";

export const buildTabHandler = (onTab: MutableRefObject<(options?: { isShift: boolean }) => void>) => Extension.create({
    name: "tabHandler",
}).extend({
    addKeyboardShortcuts() {
        return {
            Tab: ({ editor }) => {
                if (editor.isActive("listItem")) {
                    const success = editor.commands.sinkListItem("listItem");
                    if (success) {
                        return true;
                    }
                }
                onTab.current();
                return true;
            },
            "Shift-Tab": ({ editor }) => {
                if (editor.isActive("listItem")) {
                    const success = editor.commands.liftListItem("listItem");
                    if (success) {
                        return true;
                    }
                }
                onTab.current({ isShift: true });
                return true;
            },
        }
    },
});
