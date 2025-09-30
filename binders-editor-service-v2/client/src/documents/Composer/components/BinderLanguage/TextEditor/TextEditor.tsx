import * as React from "react";
import { Editor, EditorProvider, JSONContent } from "@tiptap/react";
import {
    InitializationTracker,
    wasTriggeredDuringInitialization,
} from "./custom-tiptap-extensions/InitializationTracker";
import { useEffect, useMemo, useRef } from "react";
import { useFocusEditorOnFocusComponent, useTwemoji } from "./hooks";
import { BlockInfoExtension } from "./custom-tiptap-extensions/blockinfo/BlockInfoExtension";
import {
    BlockWarningExtension
} from "./custom-tiptap-extensions/blockwarning/BlockWarningExtension";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Document from "@tiptap/extension-document";
import { EnterHandler } from "./custom-tiptap-extensions/EnterHandler";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import { IModuleTextSet } from "../types";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import { LegacyFontSizeTweakMark } from "./custom-tiptap-extensions/LegacyFontSizeTweakMark";
import { Link } from "@tiptap/extension-link";
import { LinkToolBar } from "./LinkToolBar";
import ListItem from "@tiptap/extension-list-item";
import ListKeymap from "@tiptap/extension-list-keymap";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { TK } from "@binders/client/lib/react/i18n/translations";
import Text from "@tiptap/extension-text";
import { ToolBar } from "./ToolBar";
import Underline from "@tiptap/extension-underline";
import { buildTabHandler } from "./custom-tiptap-extensions/TabHandler";
import { generateJSON } from "@tiptap/core";
import { isAcceptedLink } from "./helpers";
import { safeJsonParse } from "@binders/client/lib/util/json";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./TextEditor.styl";

export const TipTapExtensions = [
    Bold,
    Italic,
    Underline,
    BulletList,
    Document,
    Heading.configure({ levels: [1, 2, 3] }),
    History,
    Link
        .extend({ inclusive: false }) // prevents subsequent content after links to be included in them
        .configure({
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
            shouldAutoLink: isAcceptedLink,
        }),
    ListItem,
    ListKeymap,
    OrderedList,
    Paragraph,
    LegacyFontSizeTweakMark,
    Text,
    Image
        .extend({
            addAttributes() {
                return {
                    ...this.parent?.(),
                    class: {
                        default: "twemoji",
                    },
                }
            },
        })
        .configure({
            inline: true,
        }),
    EnterHandler,
    BlockInfoExtension,
    BlockWarningExtension,
    InitializationTracker,
]

export const TextEditor: React.FC<{
    isFocused: boolean;
    onFocus: (e: FocusEvent) => void;
    textModule: IModuleTextSet;
    onChange: (json: string, html: string) => void;
    handleTabNavigation?: (options?: { isBackwd?: boolean }) => void;
}> = ({ isFocused, onFocus, textModule, onChange, handleTabNavigation }) => {
    const { t } = useTranslation();
    const [editor, setEditor] = React.useState<Editor>(null);
    const [selectionBump, setSelectionBump] = React.useState(0);
    const isComposingRef = useRef(false);

    const onTab = useRef<(options: { isShift: boolean }) => void>(() => { });
    useEffect(() => {
        onTab.current = (options = { isShift: false }) => {
            handleTabNavigation?.({ isBackwd: options.isShift });
        };
    }, [handleTabNavigation]);

    const jsonContent = useMemo<JSONContent | undefined>(() => {
        try {
            const hasJson = textModule?.json?.trim().length > 0;
            const json = hasJson ?
                safeJsonParse(textModule.json) :
                generateJSON((textModule.data || []).flat().join(""), TipTapExtensions);
            return json || undefined;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`Failed to parse chunk JSON (error: ${e.message}). textModule: ${JSON.stringify(textModule)}`);
            return undefined;
        }
    }, [textModule]);

    const jsonSerializedContent = useMemo(() => {
        return JSON.stringify(jsonContent);
    }, [jsonContent]);

    const [jsonSerializedContentAndVersion, setJsonSerializedContentAndVersion] = React.useState({ jsonSerializedContent: undefined, version: 0 });

    useEffect(() => {
        if (jsonSerializedContentAndVersion.jsonSerializedContent !== jsonSerializedContent) {
            // So we get here every time the content changes
            // We'll update the content prop of jsonSerializedContentAndVersion
            // If we don't and the chunk is no longer focused the EditorProvider will remount
            // resulting in jittery flashes of short lived chunks
            setJsonSerializedContentAndVersion(serializedContentAndVersion => {
                let newVersion = serializedContentAndVersion.version;
                if (!isFocused) {
                    // The content changed while the editor was not focused
                    // This happens eg when machine translating
                    // Bumping the version will remount the EditorProvider
                    newVersion = newVersion + 1;
                }
                return {
                    jsonSerializedContent: jsonSerializedContent,
                    version: newVersion
                }
            })
        }
    }, [jsonSerializedContentAndVersion, jsonSerializedContent, isFocused]);

    useFocusEditorOnFocusComponent(editor, isFocused);
    useTwemoji(editor);

    const extensions = useMemo(() => {
        return [
            ...TipTapExtensions,
            buildTabHandler(onTab),
            Placeholder.configure({
                placeholder: t(TK.Edit_EnterText),
            }),
        ];
    }, [onTab, t]);

    return (
        <EditorProvider
            extensions={extensions}
            enableCoreExtensions={{ tabindex: false }}
            content={jsonContent}
            editorContainerProps={{ className: "tiptap-editor-provider-container" }}
            editorProps={{
                handleDOMEvents: {
                    focus: (_view, event) => onFocus(event),
                    compositionstart: () => {
                        isComposingRef.current = true;
                        return false;
                    },
                    compositionend: () => {
                        isComposingRef.current = false;
                        return false;
                    },
                },
            }}
            onUpdate={({ editor, transaction }) => {
                if (!wasTriggeredDuringInitialization(transaction)) {
                    // During composition (iOS autocorrect/predictive text), defer the change
                    // to prevent character duplication issues
                    if (isComposingRef.current) {
                        return;
                    }
                    const json = editor.getJSON();
                    const html = editor.getHTML();
                    onChange(JSON.stringify(json), html);
                }
            }}
            onCreate={({ editor }) => {
                setEditor(editor);
            }}
            onSelectionUpdate={({ editor }) => {
                setEditor(editor);
                setSelectionBump(b => b + 1);
            }}
            key={`jcv-${jsonSerializedContentAndVersion.version}`} // force re-render when jsonContent changes in the inactive language
        >
            <ToolBar isChunkFocused={isFocused} selectionBump={selectionBump} />
            <LinkToolBar selectionBump={selectionBump} />
        </EditorProvider>
    );
}
