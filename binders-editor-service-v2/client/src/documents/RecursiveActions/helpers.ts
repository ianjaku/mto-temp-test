import { IRecursiveAction, RecursiveAction } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IDeleteConfirmationMessageInfo {
    type: "delete";
}
interface IPublishConfirmationMessageInfo {
    type: "publish";
}
interface IUnpublishConfirmationMessageInfo {
    type: "unpublish";
}
interface ITranslateConfirmationMessageInfo {
    type: "translate";
    language: string;
}

type ConfirmationMessageInfo = {
    collectionTitle: string,
    affectedItemsCount: number,
    languagesMarkdown: string;
} & (IDeleteConfirmationMessageInfo | IPublishConfirmationMessageInfo | IUnpublishConfirmationMessageInfo | ITranslateConfirmationMessageInfo);

export interface IConfirmationMessageExtraParams {
    selectedLanguageCodes?: string[],
    additionalSelectedLanguageCode?: string;
}

export function buildConfirmationMessageInfo(
    collectionTitle: string,
    action: IRecursiveAction,
    affectedItemsCount: number,
    extraParameters?: IConfirmationMessageExtraParams,
): ConfirmationMessageInfo | undefined {
    if ([RecursiveAction.PUBLISH, RecursiveAction.UNPUBLISH].includes(action.type)) {
        return {
            type: action.type === RecursiveAction.PUBLISH ? "publish" : "unpublish",
            collectionTitle,
            affectedItemsCount,
            languagesMarkdown: buildSelectedLanguagesListMarkdown(extraParameters.selectedLanguageCodes),
        }
    }
    if (action.type === RecursiveAction.DELETE) {
        return {
            type: "delete",
            languagesMarkdown: undefined,
            collectionTitle,
            affectedItemsCount,
        }
    }
    if (action.type === RecursiveAction.TRANSLATE) {
        const { selectedLanguageCodes, additionalSelectedLanguageCode } = extraParameters;
        const languageCode = ((selectedLanguageCodes || []).length) ?
            selectedLanguageCodes[0] :
            additionalSelectedLanguageCode;
        return {
            type: "translate",
            collectionTitle,
            affectedItemsCount,
            language: getLanguageInfo(languageCode).name,
            languagesMarkdown: undefined,
        }
    }
    return undefined;
}

function buildSelectedLanguagesListMarkdown(selectedLanguageCodes: string[]): string {
    const languages = selectedLanguageCodes.map((c) => ({ iso639_1: c, ...getLanguageInfo(c) }));
    return `\n${languages.map((lang) => `- ${lang.name}`).join("\n")}\n`;
}
