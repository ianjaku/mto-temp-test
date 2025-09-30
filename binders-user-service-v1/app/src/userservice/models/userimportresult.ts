import { IUserTag } from "@binders/client/lib/clients/userservice/v1/contract";

export class UserImportResult {
    constructor(
        public userId: string,
        public login: string,
        public displayName: string,
        public exception?: string,
        public invitationLink?: string,
        public invitationLinkSentDate?: Date,
        public firstName?: string,
        public lastName?: string,
        public lastOnline?: Date,
        public userTags?: IUserTag[]
    ) {
    }
}