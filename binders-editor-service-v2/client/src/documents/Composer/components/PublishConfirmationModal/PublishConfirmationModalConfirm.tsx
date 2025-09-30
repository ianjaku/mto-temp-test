import React, { useMemo } from "react";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { getUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import Binder from "@binders/client/lib/binders/custom/class";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { extractBinderTitle } from "../../../helper";
import { makeSubstringBold } from "@binders/ui-kit/lib/helpers/dom";
import { useCurrentDomain } from "../../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

function getTargetName(target: User | Usergroup): string {
    if (isUsergroup(target)) {
        return target.name;
    }
    return getUserName(target);
}

export const PublishConfirmationModalConfirm: React.FC<{
    notificationTargets: (User | Usergroup)[],
    publicationLocations: string[],
    binder: Binder,
    languageCode: string,
    shouldNotify: boolean,
    setShouldNotify: (shouldNotify: boolean) => void,
    onCancel: () => void,
    onPublish: () => void,
}> = ({ notificationTargets, publicationLocations, binder, languageCode, onCancel, onPublish, shouldNotify, setShouldNotify }) => {
    const { t } = useTranslation();

    const title = useMemo(() => extractBinderTitle(binder, languageCode), [binder, languageCode]);
    const domain = useCurrentDomain();

    return (
        <div className={cx("publish-confirmation", "publish-confirmation-confirm")}>
            <label className="publish-confirmation-confirm-title">
                {t(TK.Edit_PublishX, { name: `"${title}"` })}
            </label>
            <label className="publish-confirmation-confirm-question">
                {makeSubstringBold(t(TK.Edit_PubConfirm_ConfirmQuestion, { domain }), domain)}
            </label>
            <ul className="publish-confirmation-confirm-inforows">
                {notificationTargets?.length > 0 && (
                    <li className="publish-confirmation-confirm-inforows-notification">
                        <label className="publish-confirmation-confirm-subtitle">
                            {t(TK.Notifications_NotifyUsers)}
                        </label>
                        <div className="publish-confirmation-confirm-inforows-notification-targets">
                            <Checkbox
                                onCheck={(v) => setShouldNotify(v)}
                                label={notificationTargets.map(target => getTargetName(target)).join(", ")}
                                checked={shouldNotify}
                            />
                        </div>
                    </li>
                )}
                {publicationLocations?.length > 1 && (
                    <li className="publish-confirmation-confirm-inforows-instance">
                        <label className="publish-confirmation-confirm-subtitle">
                            {t(TK.Edit_PubConfirm_InstanceLocations)}
                        </label>
                        <div className="publish-confirmation-confirm-inforows-instance-locations">
                            {publicationLocations.map((location, i) => (
                                <span key={`instloc${i}`}>{location}</span>
                            ))}
                        </div>
                    </li>
                )}
            </ul>
            <div className="publish-confirmation-confirm-buttons">
                <Button
                    text={t(TK.General_Cancel)}
                    onClick={() => onCancel()}
                    secondary
                />
                <Button
                    text={t(TK.Edit_Publish)}
                    onClick={() => onPublish()}
                    CTA
                    data-testid="publish-confirm-button"
                />
            </div>
        </div>
    );
}
