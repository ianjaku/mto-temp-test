import { Config, ConfigError } from "../config";

export class BindersServiceClientConfig {
    static getVersionedPath(config: Config, serviceName: string, version: string, options?: { useExternalLocation: boolean }): string {
        const location = BindersServiceClientConfig.getLocation(config, serviceName, options);
        const prefixKey = Config.getServicePrefixKey(serviceName);
        const prefixOption = config.getString(prefixKey);
        if (prefixOption.isNothing()) {
            throw new ConfigError(`Missing config value for key: ${prefixKey}`);
        }
        return location + prefixOption.get() + "/" + version;
    }

    static getLocation(config: Config, serviceName: string, options?: { useExternalLocation: boolean }): string {
        const useExternalLocation = options && options.useExternalLocation;
        const locationKey = useExternalLocation ?
            Config.getServiceExternalLocationKey(serviceName) :
            Config.getServiceLocationKey(serviceName);
        const locationOption = config.getString(locationKey);
        if (locationOption.isNothing()) {
            throw new ConfigError(`Missing config value for key: ${locationKey}`);
        }
        return locationOption.get();
    }
}

export interface IBindersConfig {
    api: {
        token: string;
        locations: { [serviceName: string]: string };
        externalUserToken?: string;
    };
    backendToken?: string;
    bitmovin?: {
        analyticsKey: string;
    };
    domain: string;
    god?: boolean;
    intercom?: {
        appId: string;
        userHash: string;
    };
    hubspot?: {
        portalId: string;
    };
    isExternalUser?: boolean;
    isStaging?: boolean;
    msTransactableOffers?: {
        azureSSOAppID: string;
        azureSSORedirectURI: string;
        azureSSOAuthority: string;
    };
    pathPrefix: string;
    proxiedAPiPath: string;
    proxiedReaderPath: string;
}

/**
 * TS friendly way of getting the <code>window.bindersConfig</code> prop
 */
export const getBindersConfig = (): IBindersConfig => {
    return window["bindersConfig"];
}