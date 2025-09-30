import * as React from "react";
import {
    Binder,
    DocumentAncestors
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FC, useMemo } from "react";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { NotificationTarget } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { RecipientSetting } from "./recipient-setting/RecipientSetting";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isDocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./RecipientsSettings.styl";


export const RecipientsSettings: FC<{
    item: Binder | DocumentCollection;
    targets: NotificationTarget[];
    users: User[];
    groups: UsergroupDetails[];
    refetchTargets: () => void;
    ancestors: DocumentAncestors;
}> = (
    { item, targets, users, groups, refetchTargets, ancestors }
) => {
    const { t } = useTranslation();
    const isCollection = useMemo(() => isDocumentCollection(item), [item])

    const currentItemTargets = useMemo(() => (
        targets.filter(target => target.itemId === item.id)
    ), [targets, item]);
    const ancestorItemTargets = useMemo(() => (
        targets.filter(target => target.itemId !== item.id)
    ), [targets, item]);
    
    return (
        <div className="recipients-settings-wrapper">
            <h1 className="recipients-settings-title">
                {t(TK.Notifications_CurrentType, { type: isCollection ? "collection" : "document" })}
            </h1>
            {currentItemTargets.map(target => (
                <RecipientSetting
                    users={users}
                    groups={groups}
                    target={target}
                    key={target.targetId + target.itemId + target.notificationKind}
                    targetItemId={item.id}
                    accountId={item.accountId}
                    refetchTargets={refetchTargets}
                    ancestors={ancestors}
                    otherTargets={targets}
                />
            ))}
            <RecipientSetting
                users={users}
                groups={groups}
                targetItemId={item.id}
                accountId={item.accountId}
                refetchTargets={refetchTargets}
                ancestors={ancestors}
                otherTargets={targets}
            />
            <h1 className="recipients-settings-title">
                {t(TK.Notifications_ParentTitle)}
            </h1>
            {ancestorItemTargets.map(target => (
                <RecipientSetting
                    users={users}
                    groups={groups}
                    key={target.targetId + target.itemId + target.notificationKind}
                    target={target}
                    fromParent
                    targetItemId={item.id}
                    accountId={item.accountId}
                    refetchTargets={refetchTargets}
                    ancestors={ancestors}
                    otherTargets={targets}
                />
            ))}
            {ancestorItemTargets.length === 0 && (
                <div className="recipients-settings-empty">
                    {t(TK.Notifications_NoParents)}
                </div>
            )}
        </div>
    );
}
