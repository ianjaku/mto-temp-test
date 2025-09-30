import * as React from "react";
import { GroupOwnerGroup } from "./contract";
import { useGroupOwnerGroups } from "./hooks";
import { useGroupOwnersUpdate } from "../../query";

type GroupOwnersContextType = {
    groups?: GroupOwnerGroup[];
    isLoading?: boolean;
    onGroupOwnersChange: (groupId: string, ownerUserIds: string[]) => Promise<void>;
};
const GroupOwnersContext = React.createContext<
    GroupOwnersContextType
>({
    onGroupOwnersChange: () => Promise.resolve()
});

type Props = {
    children: React.ReactNode;
};

export const GroupOwnersContextProvider = ({ children }: Props): React.ReactElement => {

    const { groups, isLoading } = useGroupOwnerGroups();
    const update = useGroupOwnersUpdate();

    const onGroupOwnersChange = React.useCallback(
        async (groupId: string, ownerUserIds: string[]) =>
            update.mutate({ groupId, ownerUserIds }),
        [update]
    );

    return (
        <GroupOwnersContext.Provider
            value={{
                groups,
                isLoading,
                onGroupOwnersChange
            }}
        >
            {children}
        </GroupOwnersContext.Provider>
    );
};

export const useGroupOwnersContext = (): GroupOwnersContextType => React.useContext(GroupOwnersContext);
