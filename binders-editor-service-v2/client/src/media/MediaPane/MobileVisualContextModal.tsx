import * as React from "react";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import Modal from "@binders/ui-kit/lib/elements/modal";
import Settings from "@binders/ui-kit/lib/elements/icons/Settings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./MobileVisualContextModal.styl";

export interface MobileVisualContextModalProps {
    onClose: () => void;
    onOpenSettings: () => void;
    onHide: () => void;
    isVideo: boolean;
}

export const MobileVisualContextModal: React.FC<MobileVisualContextModalProps> = ({
    onClose,
    onOpenSettings,
    onHide,
    isVideo
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            classNames="mobile-visual-context-modal"
            mobileViewOptions={{
                stretchX: { doStretch: true },
                stretchY: { doStretch: false },
                flyFromBottom: true,
                pulldownToDismiss: true,
            }}
            withoutHeader
            onHide={onHide}
        >
            <div className="mobile-visual-context-modal-body">
                <button
                    className="mobile-visual-context-button mobile-visual-context-button--delete"
                    onClick={onClose}
                >
                    <Delete />
                    <span>{isVideo ? t(TK.Edit_VisualSettings_RemoveVid) : t(TK.Edit_VisualSettings_RemoveImg)}</span>
                </button>

                <button
                    className="mobile-visual-context-button mobile-visual-context-button--settings"
                    onClick={onOpenSettings}
                >
                    <Settings />
                    <span>{isVideo ? t(TK.Edit_VisualSettings_OptionsVid) : t(TK.Edit_VisualSettings_OptionsImg)}</span>
                </button>
            </div>
        </Modal>
    );
};