import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { fetchLaunchDarklyFlags } from "./api";
import { useActiveAccountId } from "../stores/hooks/account-hooks";

export const useFetchLaunchDarklyFlags = (): UseQueryResult<Record<LDFlags, unknown>> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: () => fetchLaunchDarklyFlags(accountId),
        queryKey: ["launchDarklyFlags", accountId],
        enabled: !!accountId,
    });
}