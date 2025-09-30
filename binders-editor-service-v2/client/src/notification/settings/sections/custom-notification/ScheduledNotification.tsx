import * as React from "react";
import {
    CustomNotification,
    ScheduledEvent
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    detectTimeZone,
    fmtDateIso8601TimeLocalizedTZ,
    toTimeZoneCode
} from "@binders/client/lib/util/date";
import Button from "@binders/ui-kit/lib/elements/button";
import { FC } from "react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TargetTag } from "../../common/TargetTag";
import { isSmartphone } from "@binders/client/lib/util/browsers";
import { useMemo } from "react";
import "./ScheduledNotification.styl";

export const ScheduledNotification: FC<{
    scheduledNotification: ScheduledEvent;
    users: User[];
    groups: UsergroupDetails[];
    onEdit: () => void;
}> = ({ scheduledNotification, users, groups, onEdit }) => {
    const notification = useMemo(() => {
        return scheduledNotification.notification as CustomNotification;
    }, [scheduledNotification])

    const formattedDate = useMemo(() => {
        const date = new Date(scheduledNotification.sendAt);
        const formattedDate = fmtDateIso8601TimeLocalizedTZ(date);
        const timeZoneCode = toTimeZoneCode(date, detectTimeZone());
        return `${formattedDate} ${timeZoneCode}`;
    }, [scheduledNotification]);
    
    return (
        <div className="scheduled-notification-wrapper" onClick={isSmartphone() ? onEdit : undefined}>
            <div className="scheduled-notification-header">
                <div className="scheduled-notification-titlesection">
                    <h2 className="scheduled-notification-title">
                        <Icon rootClassName="scheduled-notification-email" name="email" />
                        {notification.subject}
                    </h2>
                    <div className="scheduled-notification-subtitle">
                        <div className="scheduled-notification-tag">
                            Scheduled
                        </div>
                        <div className="scheduled-notification-date">
                            {formattedDate}
                        </div>
                    </div>
                </div>
                <div className="scheduled-notification-buttons">
                    <Button text={"Edit"} onClick={onEdit}/>
                </div>
            </div>
            <div className="scheduled-notification-body">
                {notification.targets.map(target => (
                    <TargetTag
                        key={target.targetId}
                        notifierKind={target.notifierKind}
                        targetId={target.targetId}
                        users={users}
                        groups={groups}
                    />
                ))}
            </div>
        </div>
    );
}
