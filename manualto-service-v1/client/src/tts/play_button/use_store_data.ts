import { AccountFeatures, IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useActiveAccountFeatures, useActiveAccountSettings } from "../../stores/hooks/account-hooks";

export const useStoreData = (): {
    accountSettings: IAccountSettings;
    features: AccountFeatures,
} => {
    const accountSettings = useActiveAccountSettings();
    const features = useActiveAccountFeatures();

    return {
        accountSettings,
        features,
    }
}
