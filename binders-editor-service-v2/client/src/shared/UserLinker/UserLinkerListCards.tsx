import * as React from "react";
import type { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { getUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import type { IUserLinkerCardProps } from "./UserCard";
import IconGroup from "@binders/ui-kit/lib/elements/icons/Group";
import IconIntersection from "@binders/ui-kit/lib/elements/icons/Intersection";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserCard from "./UserCard";
import type { UserCardSortMethod } from "./UserLinkerList";
import { mergeGroupNames } from "./utils";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useUserLinkerContext } from "./userLinkerContext";

export interface IUserCard {
    id: string;
    primaryLabel: string;
    secondaryLabel?: string;
    lastOnlineTime?: number;
    tooltip?: string;
    icon?: React.ReactNode;
}

const UserLinkerListCards: React.FC<{
    searchTerm: string;
    sortMethod: UserCardSortMethod;
}> = ({ searchTerm, sortMethod }) => {
    const {
        findUsersAndGroups,
        linkedUserIds,
        linkedUsergroupIntersections,
        onUnlinkUser,
        onUnlinkUsergroupIntersection,
    } = useUserLinkerContext();
    const { t } = useTranslation();

    const allUserAndGroupIds = useMemo(
        () => [...new Set([...linkedUserIds, ...linkedUsergroupIntersections.flat()])],
        [linkedUserIds, linkedUsergroupIntersections]
    );

    const usersAndGroupsByIdsResult = useQuery({
        queryFn: async () => {
            const usersAndGroups = await findUsersAndGroups(allUserAndGroupIds)
            return usersAndGroups.reduce(
                (res, item) => res.set(item.id, item),
                new Map<string, User | Usergroup>(),
            );
        },
        queryKey: ["UserLinkerListCards", "findUsersAndGroups", ...allUserAndGroupIds],
        enabled: allUserAndGroupIds.length > 0,
    });
    const usersAndGroupsByIds = useMemo<typeof usersAndGroupsByIdsResult["data"]>(
        () => usersAndGroupsByIdsResult.data ?? new Map(),
        [usersAndGroupsByIdsResult.data],
    );

    const userCards = useMemo<IUserLinkerCardProps[]>(
        () => linkedUserIds.filter(userId => usersAndGroupsByIds.has(userId))
            .map(userId => {
                const userOrGroup = usersAndGroupsByIds.get(userId);
                return isUsergroup(userOrGroup) ?
                    {
                        userCard: {
                            primaryLabel: userOrGroup.name,
                            id: userOrGroup.id,
                            icon: IconGroup(),
                        },
                        onUnlinkUser,
                    } :
                    {
                        userCard: {
                            primaryLabel: getUserName(userOrGroup),
                            secondaryLabel: userOrGroup.login,
                            id: userOrGroup.id,
                            lastOnlineTime: userOrGroup.lastOnline ? new Date(userOrGroup.lastOnline).getTime() : undefined,
                        },
                        onUnlinkUser,
                    };
            }),
        [linkedUserIds, onUnlinkUser, usersAndGroupsByIds],
    );

    const usergroupIntersectionCards = useMemo<IUserLinkerCardProps[]>(
        () => linkedUsergroupIntersections.map(lui => {
            const groups = lui.map(groupId => usersAndGroupsByIds.get(groupId)).filter(Boolean);
            const groupNames = groups.map(g => isUsergroup(g) ? g.name : "");
            let primaryLabel: string;
            switch (groupNames.length) {
                case 0:
                    primaryLabel = t(TK.General_Empty);
                    break;
                case 1:
                    primaryLabel = groupNames.at(0);
                    break;
                case 2:
                    primaryLabel = t(TK.User_UsergroupIntersectionGroups2, {
                        first: groupNames.at(0),
                        second: groupNames.at(1),
                    });
                    break;
                case 3:
                    primaryLabel = t(TK.User_UsergroupIntersectionGroups3, {
                        first: groupNames.at(0),
                        second: groupNames.at(1),
                        third: groupNames.at(2),
                    });
                    break;
                default:
                    primaryLabel = t(TK.User_UsergroupIntersectionGroups4Plus, {
                        first: groupNames.at(0),
                        second: groupNames.at(1),
                        more: groupNames.length - 2,
                    });
            }
            return {
                fullWidth: true,
                userCard: {
                    id: lui.join(","),
                    icon: IconIntersection(),
                    primaryLabel,
                    tooltip: mergeGroupNames(groupNames, t(TK.General_And)),
                },
                onUnlinkUser: (id: string) => onUnlinkUsergroupIntersection(id.split(",")),
            }
        }),
        [linkedUsergroupIntersections, onUnlinkUsergroupIntersection, t, usersAndGroupsByIds]
    );

    const userOrGroupCards = useMemo(
        () => sortCards(filterCardsBySearchTerm(userCards, searchTerm, "secondaryLabel"), sortMethod),
        [searchTerm, sortMethod, userCards]
    );

    const intersectionCards = useMemo(
        () => sortCards(filterCardsBySearchTerm(usergroupIntersectionCards, searchTerm), sortMethod),
        [searchTerm, sortMethod, usergroupIntersectionCards]
    );

    return (
        <>
            <div className="userLinkerListCards">
                {userOrGroupCards.map( (card) => (
                    <UserCard key={`ucard_${card.userCard.id}`} {...card} />
                ))}
            </div>
            {intersectionCards.length > 0 && (
                <div className="userLinkerListCards">
                    {intersectionCards.map((card) => (
                        <UserCard key={`ugicard${card.userCard.id}`} {...card} />
                    ))}
                </div>
            )}
        </>
    )
}

function filterCardsBySearchTerm(cards: IUserLinkerCardProps[], searchTerm: string, additionalField?: string) {
    if (!searchTerm) return cards;

    const searchTermLowerCase = searchTerm.toLowerCase();
    return cards.filter(({ userCard }) => {
        const primaryMatch = userCard.primaryLabel.toLowerCase().includes(searchTermLowerCase);
        const secondaryMatch = additionalField && (userCard[additionalField] || "").toLowerCase().includes(searchTermLowerCase);
        return primaryMatch || secondaryMatch;
    });
}

function sortCards(cards: IUserLinkerCardProps[], sortMethod?: UserCardSortMethod) {
    if (!sortMethod) {
        return cards;
    }
    return cards.sort(({ userCard: uc1 }, { userCard: uc2 }) => {
        switch (sortMethod) {
            case "name":
                return uc1.primaryLabel.localeCompare(uc2.primaryLabel);
            case "lastonline":
                if (uc1.lastOnlineTime && uc2.lastOnlineTime) {
                    return uc2.lastOnlineTime - uc1.lastOnlineTime;
                }
                if (uc1.lastOnlineTime) {
                    return -1;
                }
                if (uc2.lastOnlineTime) {
                    return 1;
                }
                return uc1.primaryLabel.localeCompare(uc2.primaryLabel);
            default:
                return 0;
        }
    })
}

export default UserLinkerListCards;
