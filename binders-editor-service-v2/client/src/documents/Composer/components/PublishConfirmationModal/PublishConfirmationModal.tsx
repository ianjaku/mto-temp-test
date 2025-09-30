import * as React from "react";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { useCallback, useMemo } from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import Icon from "@binders/ui-kit/lib/elements/icons";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { PublishConfirmationModalChecking } from "./PublishConfirmationModalChecking";
import { PublishConfirmationModalCompleted } from "./PublishConfirmationModalCompleted";
import { PublishConfirmationModalConfirm } from "./PublishConfirmationModalConfirm";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import cx from "classnames";
import { publishBinder } from "../../../actions";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./PublishConfirmationModal.styl";

export interface IPublishConfirmationModalProps {
    binder: Binder;
    languageCode: string;
    publicationLocations: string[];
    readerLocation: string;
    onView: () => void;
}

enum PublishConfirmationStep {
    Checking = 0,
    AwaitingUserConfirmation = 1,
    Publishing = 2,
    PublishCompleted = 3,
}

export const PublishConfirmationModal: React.FC<ModalProps<IPublishConfirmationModalProps, undefined>> = ({ params, hide }) => {
    const { t } = useTranslation();

    const [notificationTargets, setNotificationTargets] = React.useState<(User | Usergroup)[]>([]);
    const [publishConfirmationStep, setPublishConfirmationStep] = React.useState(PublishConfirmationStep.Checking);
    const [shouldNotify, setShouldNotify] = React.useState(true);

    const onPublish = useCallback(async () => {
        setPublishConfirmationStep(PublishConfirmationStep.Publishing);
        const success = await publishBinder(params.binder.id, [params.languageCode], shouldNotify);
        if (success) {
            setPublishConfirmationStep(PublishConfirmationStep.PublishCompleted);
        } else {
            // error will be shown in toast
            hide();
        }
    }, [hide, params.binder.id, params.languageCode, shouldNotify]);

    const isClosable = useMemo(() => {
        return ([
            PublishConfirmationStep.AwaitingUserConfirmation,
            PublishConfirmationStep.PublishCompleted,
        ].includes(publishConfirmationStep));
    }, [publishConfirmationStep]);

    return (
        <Modal
            withoutHeader
            withoutFooter
            {...isClosable ?
                {
                    closeIcon: <Icon name="close" data-testid="publish-confirmation-modal-closebtn" />,
                    onHide: hide,
                } :
                {
                    uncloseable: true
                }
            }
            classNames="publish-confirmation-modal"
            mobileViewOptions={{
                flyFromBottom: true,
                stretchX: { doStretch: true },
                stretchY: { doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 300 },
                pulldownToDismiss: isClosable,
            }}
        >
            {publishConfirmationStep === PublishConfirmationStep.Checking && (
                <PublishConfirmationModalChecking
                    binderId={params.binder.id}
                    onDataLoaded={(usersAndGroups: (User | Usergroup)[]) => {
                        setNotificationTargets(usersAndGroups);
                        setPublishConfirmationStep(PublishConfirmationStep.AwaitingUserConfirmation);
                    }}
                />
            )}
            {publishConfirmationStep === PublishConfirmationStep.AwaitingUserConfirmation && (
                <PublishConfirmationModalConfirm
                    notificationTargets={notificationTargets}
                    binder={params.binder}
                    languageCode={params.languageCode}
                    onCancel={hide}
                    onPublish={onPublish}
                    shouldNotify={shouldNotify}
                    setShouldNotify={setShouldNotify}
                    publicationLocations={params.publicationLocations}
                />
            )}
            {publishConfirmationStep === PublishConfirmationStep.Publishing && (
                <div className={cx("publish-confirmation", "publish-confirmation-checking")}>
                    {circularProgress(null, null, 22)}
                    {t(TK.Edit_Publishing)}...
                </div>
            )}
            {publishConfirmationStep === PublishConfirmationStep.PublishCompleted && (
                <PublishConfirmationModalCompleted
                    binder={params.binder}
                    languageCode={params.languageCode}
                    onClose={hide}
                    onView={params.onView}
                />
            )}
        </Modal >
    )

}

export default PublishConfirmationModal;
