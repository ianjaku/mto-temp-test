import * as React from "react";
import {
    NotificationKind,
    NotificationTarget,
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    useCreateOnComplete,
    useCreateTargetWithCurrentSettings,
    useDeleteTarget,
    useGoToParent,
    useIsDuplicate,
    useRecipientSettingState,
    useSelectedItemDefault,
    useUpdateOnChange,
    useWrapperClasses
} from "./recipientSetting";
import { DocumentAncestors } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TargetChip from "../target-chip";
import UserInput from "../../../../../shared/user-input/UserInput";
import { buildFormatTargetACItem } from "../../../common/helpers";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./RecipientSetting.styl";

export interface RecipientSettingProps {
    fromParent?: boolean;
    target?: NotificationTarget
    users: User[];
    groups: UsergroupDetails[];
    targetItemId: string;
    accountId: string
    refetchTargets: () => void;
    ancestors: DocumentAncestors;
    otherTargets: NotificationTarget[];
}


export const RecipientSetting: React.FC<RecipientSettingProps> = (props) => {
    const { t } = useTranslation();

    const state = useRecipientSettingState(props);
    const isDuplicate = useIsDuplicate(state, props);

    const createTargetWithCurrentSettings = useCreateTargetWithCurrentSettings(
        state,
        props,
        isDuplicate
    );
    const goToParent = useGoToParent(props);
    const deleteTarget = useDeleteTarget(state, props, isDuplicate);

    useSelectedItemDefault(state, props);
    useUpdateOnChange(state, props, createTargetWithCurrentSettings);
    useCreateOnComplete(state, props, isDuplicate, createTargetWithCurrentSettings);

    const wrapperClasses = useWrapperClasses(state, props, isDuplicate);

    return (
        <div
            className={wrapperClasses}
        >
            {state.loading && (
                <div className="recipient-setting-loading">
                    Loading...
                    {/* TODO: Replace with spinner */}
                </div>
            )}
            {isDuplicate && (
                <div className="recipient-setting-duplicate">
                    Duplicate
                </div>
            )}
            <div className="recipient-setting-text">
                {t(TK.Notifications_SettingTextSend)}
            </div>
            <Dropdown
                type="Event Type"
                onSelectElement={state.setEventKind}
                selectedElementId={state.eventKind}
                elements={[
                    { id: NotificationKind.PUBLISH_REQUEST, label: t(TK.Notifications_Publish_Request_Name) },
                    { id: NotificationKind.REVIEW_REQUEST, label: t(TK.Notifications_Review_Request_Name) },
                    { id: NotificationKind.PUBLISH, label: t(TK.Notifications_Publish_Name) },
                ]}
                maxRows={3}
                className="recipient-setting-dropdown"
            />
            <div className="recipient-setting-text">
                {t(TK.Notifications_SettingTextEventsTo)}
            </div>
            <UserInput
                selectedItems={state.selectedTargetACItems}
                setSelectedItems={state.setSelectedTargetACItems}
                maxAllowedSelectedItems={1}
                userItemFormatter={buildFormatTargetACItem(t)}
                ChipComponent={TargetChip}
                hideTypeSelector
                hideIcon
            />
            {props.target && (
                <div
                    className="recipient-setting-remove"
                    onClick={deleteTarget}
                >
                    <Icon
                        name="delete"
                        rootClassName="recipient-"
                    />
                </div>
            )}
            {props.fromParent && (
                <a
                    onClick={goToParent}
                    className="recipient-setting-overlay"
                >
                    {t(TK.Notifications_GoToParent)}
                </a>
            )}
        </div>
    )
}
