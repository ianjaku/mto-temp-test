import { useActiveAccountFeatures, useActiveAccountSettings } from "../../stores/hooks/account-hooks";
import { getInterfaceLanguage } from "@binders/client/lib/i18n";
import { useCurrentUserPreferences } from "../../stores/hooks/user-hooks";

export function useInterfaceLanguage(): string {
    const features = useActiveAccountFeatures();
    const accountSettings = useActiveAccountSettings();
    const userPreferences = useCurrentUserPreferences();
    const interfaceLanguage = getInterfaceLanguage(features, accountSettings, userPreferences);
    return interfaceLanguage;
}
