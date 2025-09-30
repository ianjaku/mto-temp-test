import { Plugin, PluginKey, Transaction } from "@tiptap/pm/state";
import { Extension } from "@tiptap/core";

const TRIGGERED_DURING_INITIALIZATION_KEY = "triggeredDuringInitialization";
export const INITIALIZATION_WINDOW = 300; // milliseconds

/**
 * This extension is used to track if the editor is during the initialization phase.
 * It is used to prevent the editor from saving changes during this phase.
 */
export const InitializationTracker = Extension.create({
    name: "initializationTracker",

    addOptions() {
        return {
            initializationWindow: INITIALIZATION_WINDOW,
        };
    },

    addStorage() {
        return {
            initializationStartTime: null,
            isInitialized: false,
        };
    },

    onCreate() {
        this.storage.initializationStartTime = Date.now();
        this.storage.isInitialized = false;
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("initializationTracker"),
                filterTransaction: (tr: Transaction) => {
                    if (this.storage.isInitialized) {
                        tr.setMeta(TRIGGERED_DURING_INITIALIZATION_KEY, false);
                        return true;
                    }
                    const timeSinceInit = this.storage.initializationStartTime ?
                        Date.now() - this.storage.initializationStartTime :
                        0;
                    const isInit = timeSinceInit < this.options.initializationWindow;
                    // cache the result to avoid future Date.now() calls
                    if (!isInit) {
                        this.storage.isInitialized = true;
                    }
                    tr.setMeta(TRIGGERED_DURING_INITIALIZATION_KEY, isInit);
                    return true;
                },
            }),
        ];
    },
});

export function wasTriggeredDuringInitialization(transaction: Transaction): boolean {
    return transaction.getMeta(TRIGGERED_DURING_INITIALIZATION_KEY) === true;
}
