import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { useActiveAccountFeatures, useActiveAccountId } from "../accounts/hooks";
import { APIGetUserActivities } from "../documents/api";
import { FEATURE_DOCUMENT_OWNER } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { UserActivities } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";

export const useIsHomePageEnabled = () => {
    const accountFeatures = useActiveAccountFeatures();
    const hasFlag = useLaunchDarklyFlagValue(LDFlags.HOME_PAGE);
    return hasFlag && accountFeatures.includes(FEATURE_DOCUMENT_OWNER);
}

export const useActivities = (
): UseQueryResult<UserActivities> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: () => APIGetUserActivities(accountId),
        queryKey: ["activities", accountId]
    });
}