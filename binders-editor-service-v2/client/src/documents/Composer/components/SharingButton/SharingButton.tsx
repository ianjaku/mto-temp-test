import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import BinderClass from "@binders/client/lib/binders/custom/class";
import Button from "@binders/ui-kit/lib/elements/button";
import { ComposerSharingModal } from "../../../../shared/sharing/ComposerSharingModal";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { usePublishedUnpublishedLanguages } from "../../hooks/usePublishedUnpublishedLangCodes";
import { useRef } from "react";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./SharingButton.styl";

interface SharingButtonProps {
    binder: BinderClass;
    initialLanguageCode: string;
}

export const SharingButton: React.FC<SharingButtonProps> = (props) => {
    const { t } = useTranslation();

    const { publishedLanguages } = usePublishedUnpublishedLanguages(props.binder);

    const shareTooltip = useRef(null);
    const notPublishedTooltip = useRef(null);
    const mouseEnterShareBtn = (e: React.MouseEvent<HTMLElement>) => {
        if (publishedLanguages.length) {
            showTooltip(e, shareTooltip.current, TooltipPosition.BOTTOM, { top: 10, left: -35 });
        } else {
            showTooltip(e, notPublishedTooltip.current, TooltipPosition.BOTTOM, { top: 10, left: -55 });
        }
    }

    const mouseLeaveShareBtn = e => {
        hideTooltip(e, shareTooltip.current);
        hideTooltip(e, notPublishedTooltip.current);
    }

    const showSharingModal = useShowModal<SharingButtonProps, unknown>(({ hide, params }) => {
        return (
            <ComposerSharingModal
                hide={hide}
                initialLanguageCode={params.initialLanguageCode}
                binder={params.binder}
            />
        )
    });

    const isMobile = isMobileView();
    return !isMobile && (
        <>
            <Button
                text={t(TK.Reader_Sharing_ShareDoc)}
                onClick={() => {
                    showSharingModal({ binder: props.binder, initialLanguageCode: props.initialLanguageCode });
                }}
                secondary
                icon={<Icon name="qr_code" />}
                className="composer-share-button"
                isEnabled={!!publishedLanguages.length}
                mouseOverActiveOnDisabled
                onMouseOver={mouseEnterShareBtn}
                onMouseLeave={mouseLeaveShareBtn}
                data-testid="composer-share-button"
            />
            <Tooltip message={t(TK.Edit_ShareBtn_Tooltip)} ref={shareTooltip} />
            <Tooltip message={t(TK.Edit_ShareBtn_NotPublishedMessage)} ref={notPublishedTooltip} respectLineBreaks />
        </>
    )
}
