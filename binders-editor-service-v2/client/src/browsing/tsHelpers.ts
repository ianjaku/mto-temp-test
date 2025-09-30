import { EditorItem, Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getAllLanguageCodes, toLanguageLabel } from "@binders/client/lib/languages/helper";
import { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";

const compareLanguageLabels = (lbl1: string, lbl2: string) => lbl1 < lbl2 ? -1 : 1;
const toDropdownElement = (languageCode: string): IDropdownElement => (
    {
        id: languageCode,
        label: toLanguageLabel(languageCode)
    }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function getParentLocation(collectionId: string, restParams: any): string {
    const rest = restParams["0"];
    const path = collectionId ?
        `${rest ? `${rest}/` : ""}${collectionId}` :
        "";
    return `/browse/${path}`;
}

export function getItemLink(rest: Item[], item: EditorItem): string {
    const { id, kind } = item;
    const path = kind === "collection" ? "browse" : "documents";
    const previous = rest.length > 0 ? `/${rest.map(({ id }) => id).join("/")}` : "";
    return `/${path}${previous}/${id}`;
}

function getLanguageCodesToRender(
    options: GetLanguageElementsOptions = {}
): {
    languages: string[],
    prioritizedCount: number
} {
    const { languageCodesToOmit, languageCodesToPrioritize, includeDialects, includeGhentianDialect, translatorLanguageCodes } = options;
    const allLanguageCodes = getAllLanguageCodes(includeDialects, includeGhentianDialect);
    if (translatorLanguageCodes) {
        return {
            languages: allLanguageCodes.filter(languageCode => translatorLanguageCodes.includes(languageCode)),
            prioritizedCount: 0
        };
    }
    const allLanguages = allLanguageCodes.filter(lc => !(languageCodesToPrioritize || []).includes(lc)).sort(compareLanguageLabels);
    const prioritized = (languageCodesToPrioritize ?? []).filter(l => !options.languageCodesToDisable?.includes(l));
    const languageCodes = [
        ...(prioritized || []),
        ...allLanguages,
    ];
    return {
        languages: languageCodes.filter(lc => !(languageCodesToOmit || []).includes(lc)),
        prioritizedCount: prioritized.length
    };
}

export interface GetLanguageElementsOptions {
    languageCodesToOmit?: string[];
    languageCodesToPrioritize?: string[];
    languageCodesToDisable?: string[];
    languageCodesToDisableSuffix?: string;
    includeDialects?: boolean;
    includeGhentianDialect?: boolean;
    translatorLanguageCodes?: string[];
}

export function getLanguageElements(
    options: GetLanguageElementsOptions = {}
): {
    elements: IDropdownElement[],
    prioritizedCount: number; // The length of getLanguageElements without the languageCodesToDisable
} {
    const {
        languages: languageCodesToRender,
        prioritizedCount
    } = getLanguageCodesToRender(options);
    const ddElements = languageCodesToRender.map(l => toDropdownElement(l));
    if (!(options?.languageCodesToDisable)) {
        return {
            elements: ddElements,
            prioritizedCount
        };
    }
    const elements = ddElements.map(el => options.languageCodesToDisable?.includes(`${el.id}`) ?
        ({
            ...el,
            label: `${el.label}${options.languageCodesToDisableSuffix || ""}`,
            disabled: true,
            isGrayedOut: true,
        }) :
        el);

    return {
        elements,
        prioritizedCount
    }
}
