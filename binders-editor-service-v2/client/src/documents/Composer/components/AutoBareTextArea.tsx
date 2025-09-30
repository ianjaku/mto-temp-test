import * as React from "react";
import { useEffect, useRef } from "react";
import AutoTextarea from "react-textarea-autosize";
import classnames from "classnames";
import { useComposerProps } from "../contexts/composerPropsContext";
import variables from "@binders/ui-kit/lib/variables";

interface AutoBareTextAreaProps {
    className?: string;
    disabled?: boolean;
    languageCode: string;
    placeholder: string;
    translateButton?: React.ReactNode;
    tabIndex?: number;
    approvalButton?: React.ReactNode;
    index: number;
    editorStateVersion: number;
    onChange: (text: string, languageCode: string, index: number) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onBlur?: (e: any, index: number) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFocus: (e: any, index: number) => void;
    handleTabNavigation?: (options?: { isBackwd?: boolean }) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style: any;
    text: string | string[];
    isPrimary: boolean;
}

const AutoBareTextArea: React.FC<AutoBareTextAreaProps> = (props: AutoBareTextAreaProps) => {
    const {
        className,
        disabled,
        languageCode,
        index,
        placeholder,
        style,
        tabIndex,
        translateButton,
        approvalButton,
        onBlur,
        onChange,
        onFocus,
        handleTabNavigation,
        editorStateVersion,
        text: propsText,
        isPrimary,
    } = props;

    const ref = useRef<HTMLTextAreaElement>(null);

    const [isFocused, setIsFocused] = React.useState(false);

    const { selectedChunkDetails } = useComposerProps();
    useEffect(() => {
        if (selectedChunkDetails.index === index && selectedChunkDetails.isPrimary === isPrimary) {
            if (ref.current) {
                const focusable = ref.current.focus ? ref.current : ref.current["_rootDOMNode"];
                if (focusable) {
                    focusable.focus();
                }
            }
        }
    }, [index, isPrimary, selectedChunkDetails]);

    let initialText;
    if (!propsText) {
        initialText = "";
    } else {
        initialText = Array.isArray(propsText) ?
            propsText.join("\n\n") :
            propsText;
    }
    const [text, setText] = React.useState(initialText);

    React.useEffect(
        () => {
            setText(initialText);
        },
        [editorStateVersion, initialText]
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onInputChange = (e: any) => {
        if (isFocused) {
            const text = e.target.value;
            onChange(text, languageCode, index);
            setText(text);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onInputFocus = (e: any) => {
        setIsFocused(true);
        if (typeof onFocus === "function") {
            onFocus(e, index);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onInputBlur = (e: any) => {
        setIsFocused(false);
        if (typeof onBlur === "function") {
            onBlur(e, index);
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            if (typeof handleTabNavigation === "function") {
                handleTabNavigation({ isBackwd: e.shiftKey });
            }
        }
    }

    return (
        <div className={classnames("textarea-wrapper", !!className && className)}>
            <AutoTextarea
                onInput={onInputChange}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                onKeyDown={onKeyDown}
                style={{ ...style, fontFamily: variables.secondaryFontName }}
                value={text}
                disabled={disabled}
                placeholder={placeholder}
                dir="auto"
                tabIndex={tabIndex}
                ref={ref}
            />
            {translateButton}
            {approvalButton}
        </div>
    );
}

export default AutoBareTextArea;
