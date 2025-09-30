import {
    APIGetAccountFeatures,
    APIGetAccountSettings,
    APIGetPublicAccountSettings
} from "../../api/accountService";
import { AccountFeatures, IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { APIHasAvailableEditorAccount } from "../../api/authorizationService";
import DebugLog from "@binders/client/lib/util/debugLogging";
import { getAccountStoreActions } from "../../stores/zustand/account-store";
import { getDocumentsICanEdit } from "../../api/authorizationService";

/**
 * Sets the amIEditor status to "YES_ELSEWHERE" or "NO"
 * depending on if the user has edit access to any document.
 */
export const loadAmIEditorElsewhere = async (
    accountId: string,
    userId: string
): Promise<void> => {
    const isEditor = await APIHasAvailableEditorAccount([accountId], userId);
    if (!isEditor) return;

    getAccountStoreActions().setCanEditElsewhere();
}

/**
* @deprecated use hook functions instead
*/
export async function loadAccountFeatures(accountId: string) {
    const features = await APIGetAccountFeatures(accountId);
    DebugLog.setDebugFeature(features);
    getAccountStoreActions().loadFeatures(features as unknown as AccountFeatures);
    return features;
}

/**
* @deprecated use hook functions instead
*/
export async function loadAccountSettings(accountId: string, isPublic = false) {
    const getSettings = isPublic ? APIGetPublicAccountSettings : APIGetAccountSettings;
    const settings = await getSettings(accountId);
    getAccountStoreActions().loadSettings(settings as IAccountSettings);
    return settings;
}

/**
* @deprecated use hook functions instead
*/
export async function loadDocsToEdit(accountId: string) {
    const docs = await getDocumentsICanEdit([accountId]);
    getAccountStoreActions().loadDocsToEdit(docs);
}
