import { createSecret, deleteSecret } from "../k8s/secrets";
import { getDevopsConfig } from "../../lib/config";

export const GMAIL_CREDENTIALS_SECRET = "gmail-credentials";
const CREDENTIAL_NAMESPACE = "monitoring";

export const setupMailCredentials = async (): Promise<void> => {
    const devopsSecret = await getDevopsConfig();
    const { login, password } = devopsSecret.smtp.gmail;
    try {
        await createSecret(GMAIL_CREDENTIALS_SECRET, { login, password }, CREDENTIAL_NAMESPACE);
    } catch (ex) {
        if (ex.message.indexOf("(AlreadyExists)") > -1) {
            await deleteSecret(GMAIL_CREDENTIALS_SECRET, CREDENTIAL_NAMESPACE);
            return setupMailCredentials();
        }
        throw ex;
    }

};