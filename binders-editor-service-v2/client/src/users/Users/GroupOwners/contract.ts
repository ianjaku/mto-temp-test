import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";

export type GroupOwnerGroup = Usergroup & {
    owners: User[];
}