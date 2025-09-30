import * as React from "react";
import {
    APIAddNotificationTemplate,
    APISendCustomNotification,
    APIUpdateScheduledNotification
} from  "../../../api";
import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CustomNotification,
    NotificationTemplate,
    RelativeDate,
    ScheduledEvent
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { FC, useEffect, useMemo, useState } from "react";
import {
    combineDates,
    resolveRelativeDate
} from  "@binders/client/lib/clients/notificationservice/v1/helpers";
import Button from "@binders/ui-kit/lib/elements/button";
import CloseIcon from "@binders/ui-kit/lib/elements/icons/Close";
import { CreateTemplateNotificationModal } from "./CreateTemplateNotificationModal";
import { FlashMessages } from "../../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { ScheduledFormDetails } from "./ScheduledFormDetails";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TargetChip from "../recipients-settings/target-chip";
import { TemplateDropdown } from "./TemplateDropdown";
import UserInput from "../../../../shared/user-input/UserInput";
import add from "date-fns/add";
import { buildFormatTargetACItem } from "../../common/helpers";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { isDocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { isRelativeDate } from "@binders/client/lib/clients/notificationservice/v1/validation";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { useNotificationBodyValidator } from "./useNotificationBodyValidator";
import { useNotificationTemplates } from "../../../hooks";
import { useTargetACItems } from "./useTargetACItems";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CreateNotificationModal.styl";

export interface CreateEmailNotificationModalProps {
    scheduled?: boolean;
    targetItem: DocumentCollection | Binder;
    scheduledNotification?: ScheduledEvent;
}

export const CreateNotificationModal: FC<ModalProps<CreateEmailNotificationModalProps, undefined | boolean>> = (
    { params, hide }
) => {
    const { t } = useTranslation();
    const accountId = params?.targetItem.accountId;
    const {
        loadTargets,
        selectedTargets,
        ACData
    } = useTargetACItems();
    const { templates, loadTemplates, deleteTemplate } = useNotificationTemplates();
    const [text, setText] = useState("");
    const [subject, setSubject] = useState("");
    const [date, setDate] = useState<Date | RelativeDate>(add(new Date(), { days: 1 }));
    const [time, setTime] = useState<Date>(add(new Date(), { hours: 1 }));
    const [error, setError] = useState<string>(null)
    const [loading, setLoading] = useState(false);

    const scheduledNotification = useMemo(
        () => params.scheduledNotification ?? null,
        [params.scheduledNotification]
    );

    const notification = useMemo(
        () => scheduledNotification?.notification as (CustomNotification | null) ?? null,
        [scheduledNotification]
    );

    // Set values for Update
    useEffect(() => {
        if (notification == null || scheduledNotification == null) return;
        setText(notification.text);
        setSubject(notification.subject);
        setDate(new Date(scheduledNotification.sendAt));
        setTime(new Date(scheduledNotification.sendAt));
    }, [scheduledNotification, notification]);

    useEffect(() => {
        if (notification == null || scheduledNotification == null) return;
        loadTargets(notification.targets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.scheduledNotification, accountId, notification, scheduledNotification]);

    const dateTime = useMemo(() => {
        if (date == null) return new Date();
        const absoluteDate = resolveRelativeDate(date);
        return combineDates(absoluteDate, time);
    }, [time, date]);

    const createTemplate = async (modalBodyEl: HTMLDivElement) => {
        if (!validate(modalBodyEl)) return;
        const name = await showModal(CreateTemplateNotificationModal);
        if (name == null) return;
        await APIAddNotificationTemplate(
            accountId,
            {
                targets: selectedTargets,
                text,
                subject
            },
            name,
            params.scheduled ? date : undefined,
            params.scheduled ? time : undefined
        );
        FlashMessages.success(t(TK.Notifications_TemplateCreated));
        loadTemplates();
    }

    const onSelectTemplate = (template: NotificationTemplate) => {
        const data = template.templateData;
        if (data.subject) {
            setSubject(data.subject);
        }
        if (data.text) {
            setText(data.text);
        }
        if (data.targets) {
            loadTargets(data.targets);
        }
        if (template.scheduledTime) {
            setTime(new Date(template.scheduledTime));
        }
        if (template.scheduledDate) {
            if (isRelativeDate(template.scheduledDate)) {
                setDate(template.scheduledDate);
            } else {
                setDate(new Date(template.scheduledDate));
            }
        }
    };

    const title = useMemo(
        () => extractTitle(params.targetItem),
        [params.targetItem]
    );

    const isCollection = useMemo(
        () => isDocumentCollection(params.targetItem),
        [params.targetItem]
    );

    const canCreateNotification = useMemo(() => {
        return subject !== "" &&
            text !== "" &&
            selectedTargets.length > 0;
    }, [subject, text, selectedTargets]);

    const showError = (err: string, modalBodyEl: HTMLDivElement) => {
        setError(err);
        if (err != null) {
            modalBodyEl.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    const {
        error: bodyError,
        validate: validateBody,
        clearError: clearBodyError
    } = useNotificationBodyValidator();

    const validate = (modalBodyEl?: HTMLDivElement): boolean => {
        setError(null);
        if (params.scheduled && new Date() > dateTime) {
            showError(t(TK.Notifications_DateTimeFuture), modalBodyEl);
            return false;
        }
        if (!validateBody(text)) {
            setError(t(TK.Notifications_InvalidTags));
            return false;
        }
        return true;
    }

    const createNotification = async (modalBodyEl: HTMLDivElement) => {
        if (!validate(modalBodyEl)) return;
        try {
            setLoading(true);
            await APISendCustomNotification(
                accountId,
                params.targetItem.id,
                selectedTargets,
                subject,
                text,
                params.scheduled ? dateTime : undefined
            );
            if (params.scheduled) {
                FlashMessages.success(t(TK.Notifications_Created));
            } else {
                FlashMessages.success(t(TK.Notifications_Sent));
            }
            hide(true);
        } catch (e) {
            showError(t(TK.Notifications_500Error), modalBodyEl);
        } finally {
            setLoading(false);
        }
    }

    const updateNotification = async (modalBodyEl: HTMLDivElement) => {
        if (!validate(modalBodyEl)) return;
        try {
            setLoading(true)
            await APIUpdateScheduledNotification(
                params.scheduledNotification.id,
                {
                    ...params.scheduledNotification.notification,
                    text,
                    subject,
                    targets: selectedTargets
                } as CustomNotification,
                dateTime
            );
            FlashMessages.success(t(TK.Notifications_Saved));
            hide(true);
        } catch (e) {
            showError(t(TK.Notifications_500Error), modalBodyEl);
        } finally {
            setLoading(false);
        }
    }

    const onSave = (modalBodyEl: HTMLDivElement) => {
        if (params.scheduledNotification != null) {
            updateNotification(modalBodyEl);
        } else {
            createNotification(modalBodyEl);
        }
    }

    return (
        <Modal
            title={
                params.scheduledNotification ?
                    t(TK.Notifications_UpdateCustom) :
                    t(TK.Notifications_CreateCustom)
            }
            withBodyEl={(modalBodyEl) => (
                <div className="create-email-not-wrapper">
                    {error != null && (
                        <div className="create-email-not-error">
                            {error}
                            <div
                                className="create-email-not-error-close"
                                onClick={() => setError(null)}
                            >
                                <CloseIcon />
                            </div>
                        </div>
                    )}
                    {templates?.length > 0 && (
                        <div className="create-email-not-row">
                            <label htmlFor="subject" className="create-email-not-label">
                                {t(TK.Notifications_SelectATemplate)}
                            </label>
                            <TemplateDropdown
                                templates={templates}
                                onSelectTemplate={onSelectTemplate}
                                onDeleteTemplate={deleteTemplate}
                            />
                        </div>
                    )}
                    <div className="create-email-not-row">
                        <label htmlFor="subject" className="create-email-not-label">
                            {t(TK.Notifications_SelectedItem, {
                                docOrCol: t(
                                    isCollection ?
                                        TK.DocManagement_Collection :
                                        TK.DocManagement_Document)
                            })}
                        </label>
                        <div className="create-email-not-item">
                            {title}
                        </div>
                    </div>
                    <div className="create-email-not-row">
                        <label htmlFor="subject" className="create-email-not-label">
                            {t(TK.Notifications_Subject)}
                        </label>
                        <Input
                            className="create-email-not-input"
                            id="subject"
                            value={subject}
                            placeholder="The subject of the email"
                            onChange={setSubject}
                        />
                    </div>
                    <div className="create-email-not-row">
                        <label htmlFor="subject" className="create-email-not-label">
                            {t(TK.Notifications_Targets)}
                        </label>
                        <div className="create-email-not-targets">
                            <UserInput
                                {...ACData}
                                userItemFormatter={buildFormatTargetACItem(t)}
                                ChipComponent={TargetChip}
                                hideTypeSelector
                                hideIcon
                            />
                        </div>
                    </div>
                    {params.scheduled && (
                        <ScheduledFormDetails
                            onDateChange={v => setDate(v)}
                            onTimeChange={v => setTime(v)}
                            date={date}
                            time={time}
                        />
                    )}
                    {bodyError != null && (
                        <div className="create-email-not-error">
                            {bodyError}
                            <div
                                className="create-email-not-error-close"
                                onClick={() => clearBodyError()}
                            >
                                <CloseIcon />
                            </div>
                        </div>
                    )}
                    <div className="create-email-not-row">
                        <label htmlFor="subject" className="create-email-not-label">
                            {t(TK.Notifications_EmailContent)}
                        </label>
                        <textarea
                            placeholder={t(TK.Notifications_CustomNotPlaceholder)}
                            className="create-email-not-textarea"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onBlur={() => {
                                const isValid = validateBody(text)
                                if (isValid) setError(null)
                            }}
                        ></textarea>
                        <a
                            className="create-email-not-help"
                            href={t(TK.Notifications_TemplateHelpLink)}
                            target="_blank"
                        >
                            {t(TK.Notifications_TemplateHelp)}
                        </a>
                    </div>
                    <div className="create-email-not-buttons">
                        <a
                            className="create-email-not-link"
                            onClick={() => createTemplate(modalBodyEl)}
                        >
                            {!params.scheduledNotification && t(TK.Notifications_CreateTemplate)}
                        </a>
                        <Button
                            onClick={() => onSave(modalBodyEl)}
                            isEnabled={canCreateNotification && !loading}
                            text={`${params.scheduledNotification != null ? t(TK.Notifications_UpdateButton) : t(TK.Notifications_CreateButton)}`}
                            className="create-email-not-button"
                        />
                    </div>
                </div>
            )} />
    )
}
