import * as React from "react";
import { FC, useMemo } from "react";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { NotifierKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import "./TargetTag.styl";

export const TargetTag: FC<{
    notifierKind: NotifierKind;
    targetId: string;
    onClick?: () => void
    grey?: boolean;
    users: User[];
    groups: UsergroupDetails[];
}> = (
    { notifierKind, targetId, onClick, grey, users, groups }
) => {
    const resolvedTarget = useMemo((): { icon: string; label: string } => {
        if (notifierKind == null || targetId == null) return null;

        if (notifierKind === NotifierKind.USER_EMAIL) {
            const user = users.find(u => u.id === targetId);
            return {
                icon: "person",
                label: user ? buildUserName(user) : "..."
            }
        }
        if (notifierKind === NotifierKind.GROUP_EMAIL) {
            const group = groups.find(g => g.group.id === targetId);
            return {
                icon: "group",
                label: group ? group.group.name : "..."
            }
        }
    }, [notifierKind, targetId, users, groups]);
    
    if (resolvedTarget == null) {
        return null;
    }
    return (
        <div
            className={`target-tag-wrapper ${grey && "target-tag-wrapper--grey"}`}
            onClick={onClick}
        >
            <Icon name={resolvedTarget.icon} rootClassName="target-tag-icon" />
            {resolvedTarget.label}
        </div>
    );
}
