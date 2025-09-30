import { UserImportResult } from "./userimportresult";

export class UserImportAction {
    constructor(
        public accountId: string,
        public importDate: string,
        public userImportResults: Array<UserImportResult>
    ) {
    }
}