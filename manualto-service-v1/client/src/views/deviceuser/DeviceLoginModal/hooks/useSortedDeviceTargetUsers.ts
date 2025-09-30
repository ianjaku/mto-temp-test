import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import compareDesc from "date-fns/compareDesc";
import { useMemo } from "react";

export const useSortedDeviceTargetUsers = (users: User[]): User[] => {
    return useMemo(() => {
        if (users == null) return [];
        return [...users].sort((userA, userB) => {
            if (userA.lastOnline == null && userB.lastOnline == null) {
                return userA.displayName.localeCompare(userB.displayName);
            }
            if (userA.lastOnline == null) return 1;
            if (userB.lastOnline == null) return -1;

            return compareDesc(new Date(userA.lastOnline), new Date(userB.lastOnline));
        });
    }, [users]);
}
