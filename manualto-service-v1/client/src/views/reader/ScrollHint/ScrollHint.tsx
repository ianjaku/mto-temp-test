import * as React from "react";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { isMobileOrTablet } from "@binders/client/lib/util/browsers";
import { useScrollHintFromContext } from "./ScrollHintContext";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ScrollHint.styl";

export const ScrollHint = (props: {
    goToNextChunk: () => void;
    marginLeft?: string;
}) => {
    const { isVisible, shouldRender } = useScrollHintFromContext();
    const { t } = useTranslation();

    if (!shouldRender) return null;
    return (
        <div className={cx(
            "scroll-hint",
            isVisible ? "visible" : "hidden",
        )} style={{ left: props.marginLeft }}>
            <button className="scroll-hint-button" onClick={() => {
                captureFrontendEvent(ReaderEvent.ScrollHintClicked);
                props.goToNextChunk();
            }}>
                <span>
                    {isMobileOrTablet() ?
                        t(TK.Reader_ScrollHint_ButtonLabel_Mobile) :
                        t(TK.Reader_ScrollHint_ButtonLabel_Desktop)
                    }
                </span>
                <span className="down-indicator">
                    <Icon name="expand_more" />
                </span>
            </button>
        </div>
    )
}

