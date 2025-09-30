import { IRecursiveAction, RecursiveAction } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export const recursiveActions: IRecursiveAction[] = [
    {
        id: "translate",
        type: RecursiveAction.TRANSLATE,
        icon: "translate",
        i18nKeys: { action: "Edit_TranslateLbl", confirmation: "Edit_RecursiveTranslateConfirmMsg" },
        availableLanguagesFilter: (languageCode: string) => supportedLanguagesForTranslation.includes(languageCode),
    },
    {
        id: "publish",
        type: RecursiveAction.PUBLISH,
        icon: "chrome_reader_mode",
        i18nKeys: { action: "Edit_Publish", confirmation: "Edit_RecursivePublishConfirmMsg" }
    },
    {
        id: "unpublish",
        type: RecursiveAction.UNPUBLISH,
        icon: "visibility_off",
        i18nKeys: { action: "Edit_Unpublish", confirmation: "Edit_RecursiveUnpublishConfirmMsg" }
    },
    {
        id: "delete",
        type: RecursiveAction.DELETE,
        i18nKeys: { action: "General_MoveToTrash", confirmation: "Edit_RecursiveDeleteConfirmMsg" },
        icon: "delete",
        requiresExplicitConfirmation: true,
    },
];

// as per https://docs.microsoft.com/en-us/azure/cognitive-services/translator/language-support
export const supportedLanguagesForTranslation = [
    "af", "sq", "am", "ar", "hy", "as", "az", "bn", "bs", "bg", "yue", "ca", "lzh", "zh-Hans", "zh-Hant",
    "hr", "cs", "da", "prs", "nl", "en", "et", "fj", "fil", "fi", "fr", "fr-ca", "de", "el", "gu", "ht",
    "he", "hi", "mww", "hu", "is", "id", "iu", "ga", "it", "ja", "kn", "kk", "km", "tlh-Latn", "tlh-Piqd",
    "ko", "ku", "kmr", "lo", "lv", "lt", "mg", "ms", "ml", "mt", "mi", "mr", "my", "ne", "nb", "or", "ps",
    "fa", "pl", "pt", "pt-pt", "pa", "otq", "ro", "ru", "sm", "sr-Cyrl", "sr-Latn", "sk", "sl", "es", "sw",
    "sv", "ty", "ta", "te", "th", "ti", "to", "tr", "uk", "ur", "vi", "cy", "yua"
];
