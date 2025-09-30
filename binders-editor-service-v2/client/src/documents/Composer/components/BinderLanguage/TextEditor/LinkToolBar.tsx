import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { LinkEditor } from "./LinkEditor";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { TextEditorFloater } from "../TextEditorFloater";
import { useCurrentEditor } from "@tiptap/react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./LinkToolBar.styl";

interface Props {
    selectionBump: number, // touched when selection in the editor changes. Without, memoized hooks wouldn't be reevaluated (selection change doesn't update editor instance)
}

export const LinkToolBar: React.FC<Props> = ({ selectionBump }) => {
    const editorContext = useCurrentEditor();
    const editor = useMemo(() => editorContext.editor, [editorContext]);
    const { t } = useTranslation();

    const [isEditing, setIsEditing] = useState(false);

    const selectedHref = useMemo(() => {
        return editor?.getAttributes("link").href;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, selectionBump]);

    const shouldShow = useMemo(() => {
        if (!editor) return false;
        const { from, to } = editor.state.selection;
        const nodeAtStart = editor.state.doc.nodeAt(from);
        if (!to) {
            return false;
        }
        const nodeAtEnd = editor.state.doc.nodeAt(to - 1);
        return (
            nodeAtStart?.marks.some(mark => mark.type.name === "link") &&
            nodeAtStart.eq(nodeAtEnd)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, selectionBump]);
    const prevShouldShow = usePrevious(shouldShow);
    useEffect(() => {
        if (shouldShow && !prevShouldShow) {
            setIsEditing(false);
        }
    }, [shouldShow, prevShouldShow]);

    return (
        <>
            <TextEditorFloater
                editor={editor}
                tippyOptions={{
                    duration: 100,
                    appendTo: "parent",
                    zIndex: 1399,
                    placement: "bottom-start",
                    arrow: true,
                }}
                pluginKey="link"
                shouldShow={({ state }) => {
                    const { from, to } = state.selection;
                    if (from < to) return false;
                    const nodeAtStart = state.doc.nodeAt(from);
                    if (!to) {
                        return false;
                    }
                    const nodeAtEnd = state.doc.nodeAt(to - 1);
                    return (
                        nodeAtStart?.marks.some(mark => mark.type.name === "link") &&
                        nodeAtStart.eq(nodeAtEnd)
                    );
                }}
            >
                <div className="text-editor-link-toolbar">
                    <a
                        className="text-editor-link-toolbar-anchor"
                        href={selectedHref}
                        target="_blank"
                        data-testid="link-toolbar-anchor"
                    >
                        {selectedHref}
                    </a>
                    <div className="text-editor-link-toolbar-buttons">
                        <Button
                            text={t(TK.Edit_LinkEditor_Remove)}
                            onClick={() => {
                                editor.chain()
                                    .extendMarkRange("link")
                                    .unsetLink().run();
                                setIsEditing(false);
                            }}
                            secondary
                            borderless
                            data-testid="link-toolbar-remove"
                        />
                        <Button
                            text={t(TK.General_Edit)}
                            onClick={() => {
                                setIsEditing(true);
                            }}
                            secondary
                            data-testid="link-toolbar-edit"
                        />
                    </div>
                </div>
            </TextEditorFloater>
            {isEditing &&
                (
                    <LinkEditor
                        editor={editor}
                        requestClose={() => setIsEditing(false)}
                        alignCenter
                    />
                )
            }
        </>
    )
}
