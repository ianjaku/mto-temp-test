import * as React from "react"
import {
    ReactElement,
    ReactNode,
    useCallback,
    useEffect,
    useRef,
} from "react";
import { EmojiPluginStore } from "../../index";

export interface EmojiSuggestionsPortalParams {
    store: EmojiPluginStore;
    offsetKey: string;
    children: ReactNode;
}

export default function EmojiSuggestionsPortal({
    children,
    store,
    offsetKey,
}: EmojiSuggestionsPortalParams): ReactElement {
    const ref = useRef<HTMLSpanElement>(null);

    const updatePortalClientRect = useCallback(() => {
        store.updatePortalClientRect(offsetKey, () =>
            ref.current ?.getBoundingClientRect()
        );
    }, [store, offsetKey]);

    useEffect(() => {
        store.register(offsetKey);
        updatePortalClientRect();

        // trigger a re-render so the EmojiSuggestions becomes active
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        store.setEditorState!(store.getEditorState!());

        return () => {
            store.unregister(offsetKey);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updatePortalClientRect, store]);

    return <span ref={ref}>{children}</span>;
}
