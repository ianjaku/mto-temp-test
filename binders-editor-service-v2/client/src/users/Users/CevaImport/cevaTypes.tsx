import { CevaUser } from "@binders/client/lib/clients/userservice/v1/contract";

export type CevaUserImportPayload = {
    users: CevaUser[];
}

