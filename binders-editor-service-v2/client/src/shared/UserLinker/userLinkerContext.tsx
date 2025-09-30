import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import type { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { createContext, useContext, useState } from "react";
import { APIMultiGetUsersAndGroups } from "../../users/api";
import { DirtyStateId } from "../DirtyStateContext";
import type { UserInputMessageOverrides } from "../user-input/useUserInputAutocomplete";
import { UserInputType } from "../user-input/UserInputTypeSwitcher";
import { useActiveAccountId } from "../../accounts/hooks";

export type UserLinkerProps = {
    addBtnCaption?: string;
    allowUserCreation?: boolean;
    dirtyStateId?: DirtyStateId; // if provided, selected items will be saved in DirtyStateContext
    disallowGroups?: boolean;
    enabledUserTypes?: UserInputType[];
    hideAddWhenEmptyInput?: boolean;
    hideFieldLabels?: boolean;
    inlineAddBtn?: boolean;
    isLoading?: boolean;
    linkedUserIds: string[];
    linkedUsergroupIntersections?: string[][];
    messageOverrides?: UserInputMessageOverrides;
    needsEditorAccess?: boolean;
    onCreateUsers?: (names: string[]) => Promise<User[]>;
    onLinkUsers: (userIds: string[]) => Promise<void>;
    onLinkUsergroupIntersection?: (groupIds: string[]) => Promise<void>;
    onUnlinkUser: (userId: string) => Promise<void>;
    onUnlinkUsergroupIntersection?: (groupIds: string[]) => Promise<void>;
    renderAsCards?: boolean;
    searchable?: boolean;
    sortable?: boolean;
    tighterLayout?: boolean;
    userIdsIgnoreList?: string[];
    linkedTargetsFilter?: (target: string) => boolean;
    usernameLookupList?: User[];
}

export type UserLinkerContextType = UserLinkerProps & {
    setUserLookupList: (userLookupList?: User[]) => void;
    findUsersAndGroups: (ids: string[]) => Promise<Array<User | Usergroup> | undefined>;
};

const UserLinkerContext = createContext<UserLinkerContextType>({
    findUsersAndGroups: () => undefined,
    linkedUserIds: [],
    onLinkUsers: () => {
        throw new Error("Function onLinkUsers not implemented.");
    },
    onUnlinkUser: () => {
        throw new Error("Function onUnlinkUser not implemented.");
    },
    setUserLookupList: () => undefined,
});

export const UserLinkerContextProvider = ({ children, props }: {
    children: ReactNode;
    props: UserLinkerProps;
}): ReactElement => {

    const [userLookupList, setUserLookupList] = useState<Array<User | Usergroup>>();
    const accountId = useActiveAccountId();

    const findUsersAndGroups = async (userIds: string[]): Promise<Array<User | Usergroup> | undefined> => {
        const users = userLookupList?.filter(u => userIds.includes(u.id)) || [];
        const missingIds = userIds.filter(id => !users?.find(u => u.id === id));
        if (missingIds.length) {
            const usersAndGroups = await APIMultiGetUsersAndGroups(accountId, missingIds);
            users.push(...usersAndGroups);
        }
        return users;
    }

    return (
        <UserLinkerContext.Provider
            value={{
                ...props,
                linkedUsergroupIntersections: props.linkedUsergroupIntersections ?? [],
                setUserLookupList,
                findUsersAndGroups,
            }}
        >
            {children}
        </UserLinkerContext.Provider>
    );
};

export const useUserLinkerContext = (): UserLinkerContextType => useContext(UserLinkerContext);
