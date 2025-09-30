import * as React from "react";
import { CustomTagStyle, ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { DropdownRow } from "../forms/dropdown";
import FontAwesome from "react-fontawesome";
import { TextAreaRow } from "../forms/textarea";

const SUPPORTED_TAGS = [
    "",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "strong",
    "u",
    "em",
    "ol",
    "ul",
    "p",
];

function allTagsCorrect(branding: ReaderBranding) {
    const { customTagsStyles = [] } = branding?.stylusOverrideProps ?? {};
    const textCssRegex = /(([A-Za-z\- ]+:[\s]*[\w #./()\-!]+;[\r\n]*)+)$/g;
    return customTagsStyles.every((el) => {
        const filledIn = !!(el.tag) === !!(el.style);
        let correctStyles = true;
        if (!!el.tag && !!el.style && !textCssRegex.test(el.style)) {
            correctStyles = false;
        }
        textCssRegex.lastIndex = 0;
        return filledIn && correctStyles;
    });
}

export type CustomStylesProps = {
    branding: ReaderBranding;
    updateStyle: (index: number, value: Partial<CustomTagStyle>) => void;
}

export const CustomStyles: React.FC<CustomStylesProps> = ({ branding, updateStyle }) => {
    const addNewStylingTag = React.useCallback(() => {
        updateStyle(branding?.stylusOverrideProps?.customTagsStyles?.length ?? 0, { tag: undefined, style: "" });
    }, [branding, updateStyle]);

    const onTextAreaChange = React.useCallback((index: number, style: string) => {
        updateStyle(index, { style });
    }, [updateStyle])

    const chooseTag = React.useCallback((index: number, tag: string) => {
        updateStyle(index, { tag });
    }, [updateStyle]);

    const hasCustomTagError = React.useMemo(() => !allTagsCorrect(branding), [branding]);
    const customTagsStyles = React.useMemo(() => branding?.stylusOverrideProps?.customTagsStyles ?? [], [branding]);

    const [, unusedTags] = React.useMemo(() => {
        const usedTags = new Set(customTagsStyles.map(cts => cts.tag));
        const unusedTags = SUPPORTED_TAGS.filter(tag => !usedTags.has(tag)).reduce((res, item) => ({ ...res, [item]: item }), {});
        return [usedTags, unusedTags];
    }, [customTagsStyles]);

    return (
        <>
            {customTagsStyles.map((el, index) => {
                return (
                    <div key={`tag-${index}`} className="">
                        <div className="customTag-dropdown">
                            <DropdownRow
                                changeHandler={value => chooseTag(index, value)}
                                label=""
                                initialValue={el.tag}
                                options={el.tag ? { ...unusedTags, [el.tag]: el.tag } : unusedTags}
                            />
                        </div>
                        <div className="customTag-area">
                            <TextAreaRow
                                changeHandler={value => onTextAreaChange(index, value)}
                                value={el.style}
                                tag={el.tag}
                                placeholder="for example:\ncolor: black;\nfont-size: 16px;" />
                        </div>
                    </div>
                )
            })}
            {hasCustomTagError && (
                <div className="font-row font-error">
                    <p>Be sure to fill in proper style for all selected tags</p>
                </div>
            )}
            <span className="customTag-button" onClick={addNewStylingTag} >
                <FontAwesome name="plus" />
                Add tag style
            </span>
        </>
    );
}
