import TokenAcl, { AccountAclScope } from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "../api/handler";

const client = CredentialServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export const loadAccountUrlToken = async (
    accountId: string
): Promise<string> => {
    return await client.createUrlToken(TokenAcl.fromAccountId(accountId, [AccountAclScope.BRANDING]), 1);
}
