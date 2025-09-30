import { Mark } from "@tiptap/core";

export const LegacyFontSizeTweakMark = Mark.create({
    name: "legacyFontSizeTweakMark",
    parseHTML() {
        return [
            {
                tag: "span",
                getAttrs: node => node.style?.fontSize && null,
            },
        ];
    },
    addAttributes() {
        return {
            style: {
                default: null,
                parseHTML: element => element.getAttribute("style"),
                renderHTML: attributes => {
                    return attributes.style ? { style: attributes.style } : {};
                },
            },
        };
    },
    renderHTML({ HTMLAttributes }) {
        return ["span", HTMLAttributes, 0];
    },
});