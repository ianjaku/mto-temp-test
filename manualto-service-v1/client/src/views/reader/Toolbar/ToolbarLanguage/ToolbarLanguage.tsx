import * as React from "react";
import { useShouldDisplayGlobeAndCode, useToolbarLanguage } from "./useToolbarLanguage";
import { FEATURE_LIVE_TRANSLATION_ON_READER } from "@binders/client/lib/clients/accountservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ToolbarLanguageFull } from "./ToolbarLanguageFull";
import { ToolbarLanguageMachineTranslateButton } from "./ToolbarLanguageMachineTranslateButton";
import { ToolbarLanguageMinimal } from "./ToolbarLanguageMinimal";
import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import type { UseToolbarLanguageProps } from "./useToolbarLanguage";
import cx from "classnames";
import { useIsAccountFeatureActive } from "../../../../stores/hooks/account-hooks";
import { useToolbarLanguageWidth } from "./useToolbarLanguageWidth";

type Props = UseToolbarLanguageProps & {
    isTranslating: boolean;
    onClickMachineTranslation: () => void;
    setCollapsed: (c: boolean) => void;
    switchLanguage: (translation: Translation) => void;
}

export const ToolbarLanguage: React.FC<Props> = (props) => {
    const { invisible, isCollapsed } = props;
    const isMTFeatureActive = useIsAccountFeatureActive(FEATURE_LIVE_TRANSLATION_ON_READER);
    const shouldDisplayGlobeAndCode = useShouldDisplayGlobeAndCode(props)
    const { width, isRenderedCollapsed } = useToolbarLanguageWidth(props.isCollapsed, shouldDisplayGlobeAndCode)
    const {
        // isRenderedCollapsed,
        renderedLanguageCode,
        // shouldDisplayGlobeAndCode,
        shouldDisplayLanguages,
        shouldDisplayMachineTranslateButton,
        shouldDisplaySeparator,
        translations,
        // width,
    } = useToolbarLanguage({ ...props, isMTFeatureActive, isRenderedCollapsed });

    return (
        <div
            className={cx(
                "toolbarPill",
                "toolbarLanguage",
                {
                    "toolbarLanguage--collapsed": isCollapsed,
                    "toolbarLanguage--invisible": invisible,
                },
            )}
            style={{ width: invisible ? 0 : width }}
        >
            {shouldDisplayGlobeAndCode && (
                <div
                    className="toolbarLanguage-globeAndCode"
                    onClick={() => props.setCollapsed(!isCollapsed)}
                >
                    <Icon name="language" />
                    {isRenderedCollapsed && (
                        <label>{`${renderedLanguageCode}${props.translatedLanguage ? "*" : ""}`}</label>
                    )}
                </div>
            )}
            {shouldDisplayLanguages && (
                translations.length > 2 ?
                    (
                        <ToolbarLanguageFull
                            activeLanguageCode={props.activeLanguageCode}
                            translatedLanguage={props.translatedLanguage}
                            translations={translations}
                            switchLanguage={props.switchLanguage}
                        />
                    ) :
                    (
                        <ToolbarLanguageMinimal
                            activeLanguageCode={props.activeLanguageCode}
                            translatedLanguage={props.translatedLanguage}
                            translations={translations}
                            switchLanguage={props.switchLanguage}
                            shouldDisplayGlobeAndCode={shouldDisplayGlobeAndCode}
                        />
                    )
            )}
            {shouldDisplaySeparator && (
                <div className="toolbarLanguage-separator"></div>
            )}
            {shouldDisplayMachineTranslateButton && <ToolbarLanguageMachineTranslateButton
                onClickMachineTranslation={props.onClickMachineTranslation}
                isTranslating={props.isTranslating}
            />}
        </div >
    )
}
