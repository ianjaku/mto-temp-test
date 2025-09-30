import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { ILockInfo } from "@binders/client/lib/clients/notificationservice/v1/contract";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback } = React;

interface IBinderBusyModalProps {
    lockedByInfo: ILockInfo;
    redirectUserBack: (disallowReleaseLock: boolean) => void;
    onOverrideLock: () => void;
}

const BinderBusyModal: React.FC<IBinderBusyModalProps> = (props: IBinderBusyModalProps) => {
    const { lockedByInfo, onOverrideLock, redirectUserBack } = props;
    const { t }: { t: TFunction } = useTranslation();

    const renderOverrideLockModal = useCallback(() => {
        return (
            <Modal
                title={t(TK.Edit_LockInfoSelfTitle)}
                buttons={[
                    <Button key="cancel" secondary text={t(TK.General_Cancel)} onClick={() => redirectUserBack(true)} />,
                    <Button key="ok" text={t(TK.General_Ok)} onClick={onOverrideLock} />,
                ]}
                onHide={() => redirectUserBack(true)}
            >
                <p>
                    {t(TK.Edit_LockInfoSelf1)}
                </p>
                <p>
                    {t(TK.Edit_LockInfoSelf2)}
                </p>
            </Modal>
        );
    }, [onOverrideLock, redirectUserBack, t]);

    const renderDocumentLockedModal = useCallback((currentEditorName) => {
        return (
            <Modal
                title={t(TK.Edit_LockInfoOtherTitle)}
                buttons={[
                    <Button key="ok" text={t(TK.General_Ok)} onClick={() => redirectUserBack(true)} />,
                ]}
                onHide={() => redirectUserBack(true)}
            >
                <p>
                    {t(TK.Edit_LockInfoOther, { name: currentEditorName })}
                </p>
            </Modal>
        );
    }, [redirectUserBack, t]);

    const renderItemIsLockedModal = useCallback(() => {
        if (!lockedByInfo || lockedByInfo.lockedInThisWindow) {
            return null;
        }
        return (lockedByInfo.itsMe) ?
            renderOverrideLockModal() :
            renderDocumentLockedModal(lockedByInfo.user.displayName);
    }, [lockedByInfo, renderDocumentLockedModal, renderOverrideLockModal]);

    return renderItemIsLockedModal();
}

export default BinderBusyModal;
