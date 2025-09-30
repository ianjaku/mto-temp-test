import * as React from "react";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { User, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useAddGroupMember, useGetGroupMembers, useRemoveGroupMember } from "../../query";
import { FlashMessages } from "../../../logging/FlashMessages";
import OrganizableLists from "@binders/ui-kit/lib/elements/organizablelists";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useMyDetails } from "../../hooks";
import "../users.styl";

export interface UsergroupOrganizerProps {
    users: User[],
    usergroupMembers: UsergroupDetails,
    t: TFunction,
    accountId: string,
    adminUserGroup: { result: string },
    usergroupId: string,
    usergroupName: string,
}

const UsergroupOrganizer: React.FC<UsergroupOrganizerProps> = ({
    accountId,
    adminUserGroup: { result: groupId },
    usergroupId,
    usergroupName,
    users,
    t,
}) => {
    const members = useGetGroupMembers(accountId, usergroupId);
    const nonMembers = users.filter(candidate => !(members.data?.members ?? []).find(m => m.id === candidate.id));
    const myDetails = useMyDetails();
    const removeGroupMember = useRemoveGroupMember();
    const addGroupMember = useAddGroupMember();

    const onMoveMember = async (member: { id: string }, membersId: string) => {
        if (membersId === "members") {
            await addGroupMember.mutateAsync({ accountId, userGroupId: usergroupId, userId: member.id, groupName: usergroupName });
        } else {
            if (!(usergroupId === groupId && member.id === myDetails?.user.id)) {
                await removeGroupMember.mutateAsync({ accountId, userGroupId: usergroupId, userId: member.id, groupName: usergroupName });
            } else {
                FlashMessages.error(t(TK.User_CantRemoveYourselfFromAdmin));
            }
        }
    }

    return (
        <div>
            <label className="info">{t(TK.User_DragUsersInfo)}</label>
            <OrganizableLists
                leftMembers={members.data?.members.map(toOrganizableListItem) ?? []}
                rightMembers={nonMembers.map(toOrganizableListItem)}
                leftMembersId="members"
                rightMembersId="nonmembers"
                leftMembersTitle={t(TK.User_MembersAmountOrganizer, { length: members.data?.members.length ?? 0 }).toUpperCase()}
                rightMembersTitle={t(TK.User_NonMembers).toUpperCase()}
                leftMembersDropMessage={t(TK.User_DropToAddToGroup)}
                rightMembersDropMessage={t(TK.User_DropToRemoveFromGroup)}
                onMoveMember={onMoveMember}
            />
        </div>
    );
}

const toOrganizableListItem = ({ id, displayName: name, login }: User) => ({
    id,
    name,
    login,
});

export default withTranslation()(UsergroupOrganizer);
