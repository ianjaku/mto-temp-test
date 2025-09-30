import { Editor, Extension } from "@tiptap/core";

function defaultEnterCommands(editor: Editor) {
    return editor.commands.first(({ commands }) => [
        () => commands.newlineInCode(),
        () => commands.splitListItem("listItem"),
        () => commands.createParagraphNear(),
        () => commands.liftEmptyBlock(),
        () => commands.splitBlock(),
    ]);
}

export const EnterHandler = Extension.create({
    name: "enterHandler",
}).extend({
    addKeyboardShortcuts() {
        return {
            Enter: ({ editor }) => {
                editor.commands.unsetMark("bold");
                return defaultEnterCommands(editor);
            },
        }
    },
});
