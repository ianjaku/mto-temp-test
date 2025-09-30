import { Application } from "@microsoft/microsoft-graph-types";
import moment from "moment";

export const DEFAULT_DAYS_TO_EXPIRE = 14

export function willPasswordCredentialExpire(application: Application, daysToExpire = DEFAULT_DAYS_TO_EXPIRE): boolean {
    const applicationsWithExpiredPasswords = application.passwordCredentials.filter((passwordCredential => {
        const expiration = moment(passwordCredential.endDateTime);
        const current_date = moment();
        return moment(expiration).diff(current_date, "days") < daysToExpire;
    }))

    return applicationsWithExpiredPasswords.length > 0
}