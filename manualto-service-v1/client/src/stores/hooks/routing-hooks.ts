import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { AccountStoreGetters } from "../zustand/account-store";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { isPublicationItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { useActiveViewable } from "./binder-hooks";
import { useMemo } from "react";

const routingServiceClient = RoutingServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);
export const useActiveSemanticLinks = (): UseQueryResult<ISemanticLink[]> => {

    const viewable = useActiveViewable();
    const binderId = useMemo(() => {
        if (!viewable || !isPublicationItem(viewable)) return null; // note: viewable can be a binder in the case of /preview routes. No sharing UX in that case so no need for semantic links
        return viewable.binderId;
    }, [viewable]);

    return useQuery({
        queryFn: async () => routingServiceClient.findSemanticLinks(binderId),
        queryKey: ["routingservice", "semanticlinks", binderId],
        enabled: !!binderId,
    });

}
