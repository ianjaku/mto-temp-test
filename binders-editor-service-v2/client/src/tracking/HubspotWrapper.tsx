import * as React from "react";
import { HubspotWidget } from "@binders/ui-kit/lib/thirdparty/Hubspot";
import { hoursToMilliseconds } from "date-fns";
import { useCurrentUserId } from "../users/hooks";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../users/api";

export const HubspotWrapper: React.FC = () => {
    const currentUser = useCurrentUserId();

    const identifyTokenQuery = useQuery({
        queryKey: ["hubspot-identify-token", currentUser],
        queryFn: () =>  userService.createHubspotIdentifyToken(),

        // The token is valid for 10 hours, no need to refetch until then
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        cacheTime: hoursToMilliseconds(10),
        staleTime: hoursToMilliseconds(10),
        refetchInterval: hoursToMilliseconds(10),
    });

    if (identifyTokenQuery.data == null) return null;
    return (
        <HubspotWidget
            email={identifyTokenQuery.data?.email}
            token={identifyTokenQuery.data?.token}
            portalId={window.bindersConfig?.hubspot?.portalId}
        />
    );
}