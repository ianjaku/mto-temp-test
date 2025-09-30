import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { JSONContent, generateText } from "@tiptap/core";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { IModuleTextSet } from "./Composer/components/BinderLanguage/types";
import RTEState from "@binders/client/lib/draftjs/state";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TipTapExtensions } from "./Composer/components/BinderLanguage/TextEditor/TextEditor";
import i18next from "@binders/client/lib/react/i18n";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { isDev } from "@binders/client/lib/util/environment";
import { safeJsonParse } from "@binders/client/lib/util/json";

export const browserDebounceTime = 1000;

export const extractBinderTitle = (binder: BinderClass, languageCode: string): string => {
    const language = binder.findLanguageByIsoCode(languageCode);
    if (language == null && isDev()) {
        const error = new Error(`Requested storyTitle of language ${languageCode}, but this language code isn't part of binder's languages`);
        // eslint-disable-next-line
        console.error(error);
    }
    return language?.storyTitle ?? "";
}

/**
 * Traverses up a DOM tree to find the closest parent element with a class matching one of the provided class names
 */
export const closestByClassName = (element: HTMLElement | SVGElement, classNameCandidates: string[]): null | HTMLElement | SVGElement => {
    if (element == null) return null;
    // Some elements' className is an object with baseVal prop (type SVGAnimatedString, seen on a <path> element)
    const elementClassName: string | undefined = element.className?.baseVal ?? element.className;
    if (
        // If the current element has no class name, go up the DOM
        elementClassName != null &&
        // If the current element's classname exists in the "classNameCandidates" array, return that element
        classNameCandidates.some(parentCandidate => elementClassName.includes(parentCandidate))
    ) {
        return element;
    }
    return closestByClassName(element.parentNode as HTMLElement | SVGElement, classNameCandidates);
}

export const isSemanticallyEmptyTitle = (title: string): boolean => {
    return !title || (title.startsWith("<") && title.endsWith(`${i18next.t(TK.Edit_Translation)}>`));
}

export const isSemanticallyEmptyChunk = (textModule: IModuleTextSet, options: { shouldUseNewTextEditor: boolean }) => {
    if (options.shouldUseNewTextEditor && textModule.json) {
        return isSemanticallyEmptyJsonChunkSerialized(textModule.json);
    }
    return textModule.state && RTEState.isSemanticallyEmpty(textModule.state)
}

const isSemanticallyEmptyJsonChunk = (parsedJson: JSONContent) => {
    return generateText(parsedJson, TipTapExtensions).trim().length === 0
}

export const isSemanticallyEmptyJsonChunkSerialized = (serializedJson: string) => {
    const parsedJson = safeJsonParse(serializedJson);
    if (!parsedJson) return true;
    return isSemanticallyEmptyJsonChunk(parsedJson);
}

export const pickFirstParentItem = (items: Array<Binder | DocumentCollection>): { id: string, domainCollectionId: string, name: string }[] =>
    items && items[0] && isCollectionItem(items[0]) ?
        [
            {
                id: items && items[0].id,
                domainCollectionId: items && items[0].domainCollectionId,
                name: items && items[0] && items[0].titles && items[0].titles[0].title,
            }
        ] :
        [];

export function countWords(str: string): number {
    return str.trim().split(/\s+/).length;
}

export function truncate(str: string, numberOfWords: number): string {
    return str.split(" ").splice(0, numberOfWords).join(" ");
}
