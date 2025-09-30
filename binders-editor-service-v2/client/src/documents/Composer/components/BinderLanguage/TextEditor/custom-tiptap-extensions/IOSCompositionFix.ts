import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

/**
 * This extension fixes an iOS bug where the first letter gets repeated when pressing spacebar.
 *
 * The issue occurs because iOS Safari's composition events (used for autocomplete/autocorrect)
 * can cause text duplication when a space is typed. This is particularly problematic when
 * typing the first word and pressing space.
 *
 * The fix works by:
 * 1. Detecting iOS devices
 * 2. Tracking composition state (compositionstart/compositionend events)
 * 3. Detecting and removing duplicate characters after composition
 * 4. Optionally disabling autocorrect via HTML attributes
 *
 * The root cause is that on iOS, when autocorrect/autocomplete is active:
 * - compositionstart fires when typing begins
 * - compositionend fires when space is pressed
 * - The browser may insert the completed word PLUS repeat the first character
 *
 * Solution approach:
 * - After compositionend, we check if the first character was duplicated
 * - If found, we remove the duplicate and restore the correct cursor position
 *
 * References:
 * - https://github.com/ueberdosis/tiptap/issues/1925
 * - https://github.com/facebook/draft-js/issues/1240
 * - https://bugs.webkit.org/show_bug.cgi?id=165004
 */

// Helper to detect iOS
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

interface CompositionState {
    isComposing: boolean;
    compositionText: string;
    anchorBefore: number;
    textBefore: string;
}

export const IOSCompositionFix = Extension.create({
    name: "iosCompositionFix",

    addOptions() {
        return {
            disableAutocorrect: true,
        };
    },

    addProseMirrorPlugins() {
        // Only apply this fix on iOS devices
        if (!isIOS()) {
            return [];
        }

        const compositionState: CompositionState = {
            isComposing: false,
            compositionText: "",
            anchorBefore: 0,
            textBefore: "",
        };

        return [
            new Plugin({
                key: new PluginKey("iosCompositionFix"),
                props: {
                    // Set attributes on the contenteditable element to prevent autocorrect issues
                    attributes: this.options.disableAutocorrect ? {
                        autocorrect: "off",
                        autocapitalize: "off",
                        spellcheck: "false",
                    } : {},

                    handleDOMEvents: {
                        compositionstart: (view: EditorView, event: Event) => {
                            compositionState.isComposing = true;
                            compositionState.compositionText = "";
                            compositionState.anchorBefore = view.state.selection.anchor;

                            // Store the text content before composition
                            const { state } = view;
                            const { $from } = state.selection;
                            const textNode = $from.parent.textContent;
                            compositionState.textBefore = textNode;

                            return false;
                        },

                        compositionupdate: (view: EditorView, event: Event) => {
                            const compositionEvent = event as CompositionEvent;
                            if (compositionEvent.data) {
                                compositionState.compositionText = compositionEvent.data;
                            }
                            return false;
                        },

                        compositionend: (view: EditorView, event: Event) => {
                            const compositionEvent = event as CompositionEvent;

                            // Store the final composition text
                            if (compositionEvent.data) {
                                compositionState.compositionText = compositionEvent.data;
                            }

                            // Check for duplication after ProseMirror has processed the event
                            setTimeout(() => {
                                const { state } = view;
                                const { $from } = state.selection;
                                const currentText = $from.parent.textContent;
                                const expectedText = compositionState.textBefore + compositionState.compositionText + " ";

                                // Check if the first character of the composed text was duplicated
                                if (compositionState.compositionText && currentText.length > expectedText.length) {
                                    const firstChar = compositionState.compositionText.charAt(0);
                                    const duplicatePattern = expectedText.slice(0, -1) + firstChar + expectedText.slice(-1);

                                    // If we detect the duplication pattern, fix it
                                    if (currentText === duplicatePattern) {
                                        const tr = state.tr;
                                        const pos = $from.pos;

                                        // Delete the duplicate character (the extra first character before the space)
                                        const deletePos = pos - 2; // position of duplicate char before space
                                        tr.delete(deletePos, deletePos + 1);

                                        // Apply the transaction
                                        view.dispatch(tr);
                                    }
                                }

                                compositionState.isComposing = false;
                                compositionState.compositionText = "";
                                compositionState.textBefore = "";
                            }, 50);

                            return false;
                        },
                    },
                },
            }),
        ];
    },
});
