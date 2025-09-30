import AccountStore from "../accounts/store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import i18next from "@binders/client/lib/react/i18n";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export function APIGetSupportedLanguagesByEngine(): Promise<{ [engineType: string]: string[] }> {
    return client.getSupportedLanguagesByEngine();
}

export async function APITranslate(
    accountId: string,
    html: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    isHtml: boolean,
): Promise<string> {
    try {
        return await client.translate(accountId, html, sourceLanguageCode, targetLanguageCode, isHtml);
    } catch (err) {
        const msg = (err.errorDetails && err.errorDetails.message) || i18next.t(TK.Edit_TranslateFail);
        FlashMessages.error(msg);
        return "";
    }
}
