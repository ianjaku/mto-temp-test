import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";

export type AclUpdateKind = keyof Pick<
    AuthorizationServiceContract,
    | "addAccountAdmin"
    | "addAclAssignee"
    | "addDocumentAcl"
    | "addUserToAccount"
    | "createAcl"
    | "deleteAcl"
    | "grantPublicReadAccess"
    | "removeAccountAdmin"
    | "removeAclAssignee"
    | "removeUserFromAccount"
    | "revokePublicReadAccess"
    | "updateAcl"
    | "updateAclAssignee"
>

