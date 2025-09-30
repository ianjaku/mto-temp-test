import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { useActiveAccountId } from "../../../accounts/hooks";
import { useQuery } from "@tanstack/react-query";

const authorizationClient = AuthorizationServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const useDocumentIsPublic = (itemId: string | undefined) => {
    const accountId = useActiveAccountId();
    const { data: isPublic } = useQuery({
        queryFn: async () => {
            return authorizationClient.containsPublicAcl(accountId, [itemId]);
        },
        queryKey: ["isPublic", itemId],
        enabled: !!itemId,
    });
    return isPublic;
}