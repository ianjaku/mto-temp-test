import * as React from "react";
import { FC, useMemo, useState } from "react";
import { ConfirmModal } from "./ConfirmModal";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { FlashMessages } from "../../../../logging/FlashMessages";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { NotificationTemplate } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./TemplateDropdown.styl";


export const TemplateDropdown: FC<{
    templates: NotificationTemplate[];
    onSelectTemplate: (template: NotificationTemplate) => void;
    onDeleteTemplate: (templateId: string) => Promise<void>;
}> = (props) => {
    const { t } = useTranslation();
    const [currenTemplate, setCurrentTemplate] = useState<NotificationTemplate>(null);
    
    const availableTemplatesForDropdown = useMemo(() => {
        return props.templates.map(tmpl => ({
            id: tmpl.templateId,
            label: tmpl.templateName
        }));
    }, [props.templates]);

    const onSelectElement = (id: string) => {
        const template = props.templates.find(tmpl => tmpl.templateId === id);
        if (template) {
            setCurrentTemplate(template);
            props.onSelectTemplate(template);
        }
    }

    const onDelete = async () => {
        const shouldDelete = await showModal(ConfirmModal, {
            title: t(TK.Notifications_DeleteTemplateTitle),
            message: t(TK.Notifications_DeleteTemplateMessage)
        });
        if (!shouldDelete) return;
        await props.onDeleteTemplate(currenTemplate.templateId);
        setCurrentTemplate(null);
        FlashMessages.success("Notification template deleted");
    }

    return (
        <div className="template-dropdown">
            <Dropdown
                type="templates"
                elements={availableTemplatesForDropdown}
                maxRows={5}
                selectedElementId={currenTemplate?.templateId ?? null}
                onSelectElement={onSelectElement}
                showBorders={true}
                className="create-email-not-templates"
                width={200}
            />
            {currenTemplate != null && (
                <div className="template-dropdown-delete" onClick={onDelete}>
                    <Icon
                        name="delete"
                    />
                </div>
            )}
        </div>
    )
}
