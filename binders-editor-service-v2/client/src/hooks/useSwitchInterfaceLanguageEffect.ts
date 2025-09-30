import { defaultLanguage, getInterfaceLanguage, switchInterfaceLanguage } from "@binders/client/lib/i18n";
import { useActiveAccountFeatures, useActiveAccountSettings } from "../accounts/hooks";
import { useEffect, useMemo } from "react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useUserPreferences } from "../users/hooks";

export function useSwitchInterfaceLanguageEffect() {
    const userPreferences = useUserPreferences();
    const accountSettings = useActiveAccountSettings();
    const accountFeatures = useActiveAccountFeatures();
    const interfaceLanguage = useMemo(
        () => getInterfaceLanguage(accountFeatures, accountSettings, userPreferences),
        [accountFeatures, accountSettings, userPreferences],
    );
    const previousInterfaceLanguage = usePrevious(interfaceLanguage);
    useEffect(() => {
        const hasChangedPreviouslySelectedInterfaceLanguage = previousInterfaceLanguage && interfaceLanguage !== previousInterfaceLanguage;
        const hasChangedDefaultInterfaceLanguage = !previousInterfaceLanguage && interfaceLanguage !== defaultLanguage
        if (hasChangedPreviouslySelectedInterfaceLanguage || hasChangedDefaultInterfaceLanguage) {
            switchInterfaceLanguage(interfaceLanguage);
        }
    }, [interfaceLanguage, previousInterfaceLanguage]);
}

