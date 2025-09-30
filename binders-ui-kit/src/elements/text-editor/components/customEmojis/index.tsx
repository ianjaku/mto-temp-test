import * as React from "react";
import { AriaProps, EditorCommand } from "@draft-js-plugins/editor";
import { DraftHandleValue, EditorState } from "draft-js";
import Emoji, { EmojiProps } from "./components/Emoji";
import EmojiSuggestions, { EmojiSuggestionsPubParams } from "./components/EmojiSuggestions";
import EmojiSuggestionsPortal, { EmojiSuggestionsPortalParams } from "./components/EmojiSuggestionsPortal";
import { List, Map } from "immutable";
import defaultPositionSuggestions, { PositionSuggestionsParams } from "./utils/positionSuggestions";
import JoyPixelEmojiImage from "./components/Emoji/ManualtoLocalEmojiImage";
import JoyPixelEmojiInlineText from "./components/Emoji/ManualtoLocalEmojiInlineText";
import NativeEmojiImage from "./components/Emoji/NativeEmojiImage";
import NativeEmojiInlineText from "./components/Emoji/NativEmojiInlineText";
import attachImmutableEntitiesToEmojis from "./modifiers/attachImmutableEntitiesToEmojis";
import emojiList from "./utils/emojiList";
import emojiStrategy from "./emojiStrategy";
import emojiSuggestionsStrategy from "./emojiSuggestionsStrategy";
import "./theme.styl";

export interface EmojiImageProps {
    emoji: string;
}

export interface EmojiInlineTextProps {
    decoratedText: string;
    children: React.ReactNode;
    className?: string;
}

export interface EmojiSuggestionsState {
    isActive?: boolean;
    focusedOptionIndex: number;
}


export interface EmojiPLuginCallbacks {
    keyBindingFn?(event: React.KeyboardEvent): EditorCommand | null | undefined;
    handleKeyCommand: undefined;
    handleReturn?(event: React.KeyboardEvent): DraftHandleValue;
    onChange?(editorState: EditorState): EditorState;
}

export interface EmojiPluginConfig {
    positionSuggestions?: (arg: PositionSuggestionsParams) => React.CSSProperties;
    priorityList?: { [k: string]: string[] };
    selectButtonContent?: React.ReactNode;
    toneSelectOpenDelay?: number;
    useNativeArt?: boolean;
    emojiImage?: React.ComponentType<EmojiImageProps>;
    emojiInlineText?: React.ComponentType<EmojiInlineTextProps>;
}

interface GetClientRectFn {
    (): ClientRect | undefined;
}

export interface EmojiPluginStore {
    getEditorState?(): EditorState;
    setEditorState?(state: EditorState): void;
    getPortalClientRect(offsetKey: string): ClientRect | undefined;
    getAllSearches(): Map<string, string>;
    isEscaped(offsetKey: string): boolean;
    escapeSearch(offsetKey: string): void;
    resetEscapedSearch(): void;
    register(offsetKey: string): void;
    updatePortalClientRect(offsetKey: string, func: GetClientRectFn): void;
    unregister(offsetKey: string): void;
}

export type EmojiPlugin = {
    EmojiSuggestions: React.ComponentType<EmojiSuggestionsPubParams>;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (config: EmojiPluginConfig = {}) => {
    const callbacks: EmojiPLuginCallbacks = {
        keyBindingFn: undefined,
        handleKeyCommand: undefined,
        handleReturn: undefined,
        onChange: undefined,
    };

    const ariaProps: AriaProps = {
        ariaHasPopup: "false",
        ariaExpanded: false,
        ariaOwneeID: undefined,
        ariaActiveDescendantID: undefined,
    };

    let searches: Map<string, string> = Map();
    let escapedSearch: string | undefined;
    let clientRectFunctions: Map<string, GetClientRectFn> = Map();

    const store: EmojiPluginStore = {
        getEditorState: undefined,
        setEditorState: undefined,
        getPortalClientRect: (offsetKey) => clientRectFunctions.get(offsetKey) ?.(),
        getAllSearches: () => searches,
        isEscaped: (offsetKey) => escapedSearch === offsetKey,
        escapeSearch: (offsetKey) => {
            escapedSearch = offsetKey;
        },

        resetEscapedSearch: () => {
            escapedSearch = undefined;
        },

        register: (offsetKey) => {
            searches = searches.set(offsetKey, offsetKey);
        },

        updatePortalClientRect: (offsetKey, func) => {
            clientRectFunctions = clientRectFunctions.set(offsetKey, func);
        },

        unregister: (offsetKey) => {
            searches = searches.delete(offsetKey);
            clientRectFunctions = clientRectFunctions.delete(offsetKey);
        },
    };

    const {
        positionSuggestions = defaultPositionSuggestions,
        priorityList,
        useNativeArt,
        emojiImage = useNativeArt ? NativeEmojiImage : JoyPixelEmojiImage,
        emojiInlineText = useNativeArt ?
            NativeEmojiInlineText :
            JoyPixelEmojiInlineText,
    } = config;

    // if priorityList is configured in config then set priorityList
    if (priorityList) {
        emojiList.setPriorityList(priorityList);
    }
    const suggestionsProps = {
        ariaProps,
        callbacks,
        store,
        positionSuggestions,
        shortNames: List(Object.keys(emojiList.list)),
        emojiImage,
    };


    const DecoratedEmojiSuggestions = (
        props: EmojiSuggestionsPubParams
    ): React.ReactElement => <EmojiSuggestions {...props} {...suggestionsProps} />;

    const DecoratedEmoji = (props: EmojiProps): React.ReactElement => (
        <Emoji {...props} emojiInlineText={emojiInlineText} />
    );
    const DecoratedEmojiSuggestionsPortal = (
        props: EmojiSuggestionsPortalParams
    ): React.ReactElement => <EmojiSuggestionsPortal {...props} store={store} />;
    return {
        EmojiSuggestions: DecoratedEmojiSuggestions,
        decorators: [
            {
                strategy: emojiStrategy,
                component: DecoratedEmoji,
            },
            {
                strategy: emojiSuggestionsStrategy,
                component: DecoratedEmojiSuggestionsPortal,
            },
        ],
        getAccessibilityProps: () => ({
            role: "combobox",
            ariaAutoComplete: "list",
            ariaHasPopup: ariaProps.ariaHasPopup,
            ariaExpanded: ariaProps.ariaExpanded,
            ariaActiveDescendantID: ariaProps.ariaActiveDescendantID,
            ariaOwneeID: ariaProps.ariaOwneeID,
        }),

        initialize: ({ getEditorState, setEditorState }) => {
            store.getEditorState = getEditorState;
            store.setEditorState = setEditorState;
        },

        keyBindingFn: (keyboardEvent: React.KeyboardEvent) =>
            callbacks.keyBindingFn && callbacks.keyBindingFn(keyboardEvent),
        handleReturn: (keyboardEvent: React.KeyboardEvent): DraftHandleValue => {
            if (callbacks.handleReturn) {
                return callbacks.handleReturn(keyboardEvent)
            }
            return "not-handled";
        },
        onChange: (editorState) => {
            let newEditorState = attachImmutableEntitiesToEmojis(editorState);
            if (
                !newEditorState
                    .getCurrentContent()
                    .equals(editorState.getCurrentContent())
            ) {
                const selection = editorState.getSelection();
                // Forcing the current selection ensures that it will be at it's right place.
                // This solves the issue where inserting an Emoji on OSX with Apple's Emoji
                // selector led to the right selection the data, but wrong position in
                // the contenteditable.
                newEditorState = EditorState.forceSelection(newEditorState, selection);
            }

            if (callbacks.onChange) {
                return callbacks.onChange(newEditorState);
            }
            return newEditorState;
        },
    };
};
