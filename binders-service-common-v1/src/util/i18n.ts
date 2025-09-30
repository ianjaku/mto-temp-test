import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "../apiclient/backendclient";
import {
    getAccountFeaturesFromRequestContext,
    getAccountIdFromRequestContext,
    getAccountSettingsFromRequestContext
} from "../middleware/requestContext";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "../bindersconfig/binders";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "../middleware/request";
import { getDomainFromRequest } from "./domains";
import { getInterfaceLanguage } from "@binders/client/lib/i18n";


const config = BindersConfig.get();
let globalAccountServiceClient: AccountServiceContract;
let globalRoutingServiceClient: RoutingServiceContract;
let globalUserServiceClient: UserServiceContract;

const getAccountClient = async (): Promise<AccountServiceContract> => {
    if (!globalAccountServiceClient) {
        globalAccountServiceClient = await BackendAccountServiceClient.fromConfig(config, SERVICE_NAME);
    }
    return globalAccountServiceClient;
}
const getRoutingClient = async (): Promise<RoutingServiceContract> => {
    if (!globalRoutingServiceClient) {
        globalRoutingServiceClient = await BackendRoutingServiceClient.fromConfig(config, SERVICE_NAME);
    }
    return globalRoutingServiceClient;
}
const getUserClient = async (): Promise<UserServiceContract> => {
    if (!globalUserServiceClient) {
        globalUserServiceClient = await BackendUserServiceClient.fromConfig(config, SERVICE_NAME);
    }
    return globalUserServiceClient;
}

const SERVICE_NAME = "interface-lang-detect";

export interface IExtractInterfaceLangOptions {
    domain?: string;
    accountId?: string;
}

async function getAccountIdFromRequest(
    request: WebRequest,
    options?: IExtractInterfaceLangOptions,
): Promise<string> {
    const routingServiceClient = await getRoutingClient();
    let accountId: string;
    if (options) {
        if (options.accountId) {
            accountId = options.accountId;
        } else if (options.domain) {
            accountId = await getAccountIdFromRequestContext(options.domain, routingServiceClient);
        }
    }
    if (!accountId) {
        const domain = getDomainFromRequest(request, Application.EDITOR, { returnOnlySubdomain: false });
        accountId = await getAccountIdFromRequestContext(domain, routingServiceClient);
    }
    return accountId;
}

const getUserSettings = async (userId: string | undefined, userServiceClient: UserServiceContract) =>
    userId ? userServiceClient.getPreferences(userId) : undefined

export const extractInterfaceLanguageFromRequest = async (
    request: WebRequest,
    options?: IExtractInterfaceLangOptions
): Promise<string> => {
    const [accountServiceClient, userServiceClient] = await Promise.all([
        getAccountClient(),
        getUserClient()
    ]);
    try {
        const userId = request.user && request.user.userId;
        const accountId = await getAccountIdFromRequest(request, options);

        const [accountFeatures, accountSettings, userSettings] = await Promise.all([
            getAccountFeaturesFromRequestContext(accountId, accountServiceClient),
            getAccountSettingsFromRequestContext(accountId, accountServiceClient),
            getUserSettings(userId, userServiceClient),
        ])
        return getInterfaceLanguage(accountFeatures, accountSettings, userSettings);
    } catch (err) {
        if (request.logger) {
            request.logger.error("Could not extract preferred interface language: " + err.toString(), "i18n-detect");
        }
    }
    return "en";
}


export const extractAccountDefaultLanguageFromRequest = async (
    request: WebRequest,
    options?: IExtractInterfaceLangOptions,
): Promise<string | undefined> => {
    try {
        const accountServiceClient = await getAccountClient();
        const accountId = await getAccountIdFromRequest(request, options);
        const accountSettings = await getAccountSettingsFromRequestContext(accountId, accountServiceClient);
        return accountSettings.languages.defaultCode;
    } catch (err) {
        if (request.logger) {
            request.logger.error("Could not extract default language: " + err.toString(), "i18n-detect");
        }
        return undefined;
    }
}
