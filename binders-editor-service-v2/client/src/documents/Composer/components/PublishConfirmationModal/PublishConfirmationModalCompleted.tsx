import React, { useEffect, useMemo, useRef } from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { ComposerSharingModal } from "../../../../shared/sharing/ComposerSharingModal";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { Trophy } from "./Trophy/Trophy";
import cx from "classnames";
import { extractBinderTitle } from "../../../helper";
import { makeSubstringBold } from "@binders/ui-kit/lib/helpers/dom";
import { shadeHexColor } from "../../../../shared/colorutil";
import { useCurrentDomain } from "../../../../accounts/hooks";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";

export const PublishConfirmationModalCompleted: React.FC<{
    binder: Binder,
    languageCode: string,
    onClose: () => void,
    onView: () => void,
}> = ({ binder, languageCode, onClose, onView }) => {
    const { t } = useTranslation();
    const title = useMemo(() => extractBinderTitle(binder, languageCode), [binder, languageCode]);
    const domain = useCurrentDomain();
    const confettiRef = useRef(null);

    const showSharingModal = useShowModal(({ hide }) => {
        return (
            <ComposerSharingModal
                hide={hide}
                initialLanguageCode={languageCode}
                binder={binder}
            />
        )
    });

    useEffect(() => {
        import("canvas-confetti").then(({ default: confetti }) => { // dynamic import to avoid bundle size increase
            if (!confettiRef.current) return;
            const buttonRect = confettiRef.current.getBoundingClientRect();
            const origin = buttonRect ?
                {
                    x: (buttonRect.x + buttonRect.width / 2) / window.innerWidth,
                    y: (buttonRect.y + 50) / window.innerHeight,
                } :
                undefined;
            confetti({
                origin,
                spread: 70,
                zIndex: 10_000,
                colors: [
                    vars.accentColor,
                    shadeHexColor(vars.accentColor, 20),
                    shadeHexColor(vars.accentColor, -20),
                    shadeHexColor(vars.accentColor, 40),
                    shadeHexColor(vars.accentColor, -40),
                ]
            });
        });
    }, []);

    return (

        <div className={cx("publish-confirmation", "publish-confirmation-complete")}>
            <label className="publish-confirmation-complete-title" data-testid="publish-confirmation-success">
                {t(TK.Edit_PubConfirm_Success)}
            </label>
            <div ref={confettiRef} className="publish-confirmation-complete-body">
                <Trophy />
                <label>
                    {makeSubstringBold(t(TK.Edit_PubConfirm_SuccessMsg, { name: `"${title}"`, domain }), domain)}
                </label>
            </div>
            <div className="publish-confirmation-complete-nextsteps">
                <span className="publish-confirmation-complete-nextsteps-title">
                    {t(TK.Edit_PubConfirm_SuccessNextSteps)}
                </span>
                <div className="publish-confirmation-complete-nextsteps-steps">
                    <div className="publish-confirmation-complete-nextsteps-steps-step" onClick={() => { onClose(); showSharingModal() }}>
                        <Icon name="share" outlined />
                        <div className="publish-confirmation-complete-nextsteps-steps-step-body">
                            <span className="publish-confirmation-complete-nextsteps-steps-step-body-title">
                                {t(TK.Edit_PubConfirm_SuccessNextSteps_Share)}
                            </span>
                            <span className="publish-confirmation-complete-nextsteps-steps-step-body-text">
                                {t(TK.Edit_PubConfirm_SuccessNextSteps_ShareTxt)}
                            </span>
                        </div>
                        <Icon name="arrow_forward" />
                    </div>
                    <div className="publish-confirmation-complete-nextsteps-steps-step" onClick={() => onView()}>
                        <Icon name="visibility" outlined />
                        <div className="publish-confirmation-complete-nextsteps-steps-step-body">
                            <span className="publish-confirmation-complete-nextsteps-steps-step-body-title">
                                {t(TK.Edit_PubConfirm_SuccessNextSteps_View)}
                            </span>
                            <span className="publish-confirmation-complete-nextsteps-steps-step-body-text">
                                {t(TK.Edit_PubConfirm_SuccessNextSteps_ViewTxt)}
                            </span>
                        </div>
                        <Icon name="arrow_forward" />
                    </div>
                </div>
            </div>
        </div>
    );
}
