import { useActiveAccountFeatures, useActiveAccountSettings } from "../accounts/hooks";
import { getInterfaceLanguage } from "@binders/client/lib/i18n";
import { useUserPreferences } from "../users/hooks";

export function useInterfaceLanguage(): string {
    const features = useActiveAccountFeatures();
    const accountSettings = useActiveAccountSettings();
    const userPreferences = useUserPreferences();
    const interfaceLanguage = getInterfaceLanguage(features, accountSettings, userPreferences);
    return interfaceLanguage;
}
