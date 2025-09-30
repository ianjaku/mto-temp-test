import { User, UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { getAccountStoreActions } from "../../stores/zustand/account-store";
import { getUserStoreActions } from "../../stores/zustand/user-store";
import { updateUser as remoteUpdateUser } from "../../binders/loader";

/**
 * @deprecated use hook functions instead
 */
export function updateUserPreferences(preferences: Partial<UserPreferences>): void {
    if (!preferences) return;
    getUserStoreActions().updatePreferences(preferences);
}

/**
 * @deprecated use hook functions instead
 */
export function overrideReaderLanguages(readerLanguages: string[]): void {
    getUserStoreActions().overrideLanguages(readerLanguages);
}

/**
 * @deprecated use hook functions instead
 */
export function updateReaderLanguages(readerLanguages: string[]): void {
    overrideReaderLanguages(readerLanguages);
    updateUserPreferences({ readerLanguages });
}

/**
 * @deprecated use hook functions instead
 */
export async function updateUser(user: User, accountId: string): Promise<void> {
    await remoteUpdateUser(user, accountId);
    getUserStoreActions().loadUser(user)
    getAccountStoreActions().setAccountId(accountId);
}

