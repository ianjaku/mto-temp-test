import { Config, ConfigError } from "@binders/client/lib/config/config";

interface TransactableOffersLiveConfig {
    appId: string;
    appSecret: string;
    tenantId: string;
    useStub?: false;
    notificationEmailAddress: string;
}
interface TransactableOffersStubConfig {
    useStub: true;
}

type TransactableOffersConfig = TransactableOffersStubConfig | TransactableOffersLiveConfig;

export class MSTransactableOffersConfig {
    public readonly marketPlaceApiVersion: string = "2018-08-31";
    public readonly marketPlaceApiBaseUrl: string = "https://marketplaceapi.microsoft.com";
    public readonly authApiBaseUrl: string = "https://login.microsoftonline.com";
    public readonly marketPlaceResourceId: string = "20e940b3-4c77-4b0b-9a53-9e16a1b010a7"
    
    constructor(
        public readonly appId: string,
        public readonly appSecret: string,
        public readonly tenantId: string,
        public readonly isDummy: boolean,
        public readonly notificationEmailAddress: string
    ) {}

    public static fromConfig(config: Config): MSTransactableOffersConfig {
        const option = config.getObject("msTransactableOffers")
        if (option.isNothing()) {
            throw new ConfigError("Missing config settings for Microsoft transactable offers.");
        }
        const settings = <TransactableOffersConfig>option.get();
        const errors = [];
        if ("useStub" in settings && settings.useStub === true) {
            return new MSTransactableOffersConfig(null, null, null, true, null);
        }
        if (settings.appId == null) {
            errors.push("Missing config key 'appId' for Microsoft transactable offers.");
        }
        if (settings.appSecret == null) {
            errors.push("Missing config key 'appSecret' for Microsoft transactable offers.");
        }
        if (settings.tenantId == null) {
            errors.push("Missing config key 'tenantId' for Microsoft transactable offers.");
        }
        if (errors.length > 0) {
            throw new ConfigError(errors.join("\n"));
        }
        return new MSTransactableOffersConfig(
            settings.appId,
            settings.appSecret,
            settings.tenantId,
            false,
            settings.notificationEmailAddress
        );
    }
}
