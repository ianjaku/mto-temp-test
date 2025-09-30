import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import type { SearchUsersOrGroupsResult } from "../../users/search";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserInputType } from "./UserInputTypeSwitcher";
import { buildAutoCompleteInfo } from "./helpers";
import { useTranslation } from "@binders/client/lib/react/i18n";

type UseUserInputAutocompleteProps = {
    accountId: string;
    disallowGroups: boolean;
    hideTypeSelector: boolean;
    itemFilter: (item: IAutocompleteItem) => boolean;
    itemFormatter: (item: IAutocompleteItem) => IAutocompleteItem;
    itemIdFilter: (itemId: string) => boolean;
    messageOverrides: UserInputMessageOverrides;
    needsEditorAccess: boolean;
    searchGroups: (accountId: string, query: string) => Promise<SearchUsersOrGroupsResult>;
    searchUsers: (accountId: string, query: string, needsEditorAccess?: boolean) => Promise<SearchUsersOrGroupsResult>;
    userInputType: UserInputType;
}

export type UseUserInputAutocompleteResult = {
    autocompleteData: IAutocompleteItem[];
    autocompleteFilteredCount: number;
    isLoading: boolean;
    noMatchesOverride: string;
    onUpdateSearchTerm: (term: string) => Promise<void>;
    placeholder: string;
    setAutocompleteData: Dispatch<SetStateAction<IAutocompleteItem[]>>;
}

export function useUserInputAutocomplete({
    accountId,
    disallowGroups,
    hideTypeSelector,
    itemFilter,
    itemFormatter,
    itemIdFilter,
    messageOverrides,
    needsEditorAccess,
    searchGroups,
    searchUsers,
    userInputType,
}: UseUserInputAutocompleteProps): UseUserInputAutocompleteResult {
    const [autocompleteData, setAutocompleteData] = useState<IAutocompleteItem[]>([]);
    const [autocompleteFilteredCount, setAutocompleteFilteredCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [usersAndGroups, setUsersAndGroups] = useState<IAutocompleteItem[]>([]);
    const { t } = useTranslation();

    const info = useMemo(
        () => buildAutoCompleteInfo(
            usersAndGroups,
            itemIdFilter,
            itemFormatter,
            itemFilter,
        ),
        [itemFilter, itemFormatter, itemIdFilter, usersAndGroups]
    );

    useEffect(() => {
        setAutocompleteData(info.autocompleteData);
        setAutocompleteFilteredCount(totalResults - info.autocompleteFilteredCount);
    }, [info, totalResults]);

    const onUpdateSearchTerm = useCallback<UseUserInputAutocompleteResult["onUpdateSearchTerm"]>(
        async (term: string) => {
            if (term.length < 3) {
                setUsersAndGroups([]);
            } else {
                setIsLoading(true);

                let results: SearchUsersOrGroupsResult = null;

                if (hideTypeSelector && !disallowGroups) {
                    const [usersResult, groupsResult] = await Promise.all([
                        await searchUsers(accountId, term, needsEditorAccess),
                        await searchGroups(accountId, term)
                    ]);
                    results = {
                        hits: [...usersResult.hits, ...groupsResult.hits],
                        totalHits: usersResult.totalHits + groupsResult.totalHits
                    };
                } else if (!hideTypeSelector) {
                    results = userInputType === UserInputType.User ?
                        await searchUsers(accountId, term, needsEditorAccess) :
                        await searchGroups(accountId, term);
                } else {
                    results = await searchUsers(accountId, term, needsEditorAccess);
                }

                setIsLoading(false);
                setUsersAndGroups(results.hits as IAutocompleteItem[]);
                setTotalResults(results.totalHits);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [accountId, userInputType],
    );

    const placeholder = useMemo(() => {
        if (!disallowGroups && hideTypeSelector) {
            return messageOverrides?.linkUsersPlaceholder || t(TK.User_AddUserOrUsergroup);
        }
        if (userInputType === UserInputType.User) {
            return messageOverrides?.linkUsersPlaceholder || t(TK.User_AddUsers);
        }
        return messageOverrides?.linkGroupsPlaceholder || t(TK.User_AddGroups);
    }, [messageOverrides, userInputType, t, disallowGroups, hideTypeSelector]);

    let noMatchesOverride: string;
    if (messageOverrides?.noUserMatches && userInputType === UserInputType.User) {
        noMatchesOverride = messageOverrides.noUserMatches;
    } else {
        noMatchesOverride = messageOverrides?.noGroupMatches && userInputType === UserInputType.Group ?
            messageOverrides.noGroupMatches :
            undefined;
    }

    return {
        autocompleteData,
        autocompleteFilteredCount,
        isLoading,
        noMatchesOverride,
        onUpdateSearchTerm,
        placeholder,
        setAutocompleteData,
    }
}

export interface UserInputMessageOverrides {
    linkGroupsPlaceholder?: string;
    linkUsersPlaceholder?: string;
    noGroupMatches?: string;
    noUserMatches?: string;
}

