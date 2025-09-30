import { Translation } from "./translations";
import en_US from "./translations/en_US";
import fr from "./translations/fr";
import nl from "./translations/nl";

type LanguageResource = {
    label: string;
    iso639_1: string;
    value: Translation | Partial<Translation>;
}

export const languageResources: LanguageResource[] = [
    {
        label: "English",
        iso639_1: "en",
        value: en_US,
    },
    {
        label: "Nederlands",
        iso639_1: "nl",
        value: nl,
    },
    {
        label: "Français",
        iso639_1: "fr",
        value: fr,
    },
];

export const i18nextResources = languageResources.reduce<
    Record<string, { translation: Translation | Partial<Translation> }>
>(
    (out, res) => {
        return {
            ...out,
            [res.iso639_1]: { translation: res.value },
        }
    },
    {}
);

export const getAvailableInterfaceLanguages = (): Array<{value: string, label: string}> => (
    languageResources.map( ({label, iso639_1}) => ({label, value: iso639_1}))
);
