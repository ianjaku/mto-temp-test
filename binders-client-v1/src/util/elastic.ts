import { TranslationKeys as TK } from "../i18n/translations";
import i18n from "../i18n";
import { isIE10Plus } from "./browsers";

const quotesRegex = /([«‹»›„“‟”＂"❝❞⹂〝〞〟❮❯])+/g;
const specialCharsRegex = /([\s\\^\\(\\)/\\#])+/g;

export const cleanESQuery = (query: string): string => {
    // escape the following characters because they mess up the elastic search query or URL patterns
    // white space, '/', '\', '^', '#', '"', '(', ')'
    const spacedOut = query.replace(quotesRegex, "\"").replace(specialCharsRegex, " ");
    const urlSafe = isIE10Plus() ?
        spacedOut.replace(/%+/g, " ") :
        spacedOut;
    return urlSafe.trim();
};

const extractMatches = (contexts: string[], searchTerms: string[]) => (
    contexts.reduce((matchesMap, context) => {
        for (const term of searchTerms) {
            const cleanedTerm = term
                .replace("*", ".*")
                .replace("+", ".+");
            const count = (context.match(new RegExp(cleanedTerm, "gi")) || []).length;
            const totalCount = (matchesMap.get(term) || 0) + count;
            matchesMap.set(term, totalCount);
        }
        return matchesMap;
    }, new Map())
);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const buildMatchCountString = (contexts: string[], searchTerms: string[]) => {
    const matchesMap = extractMatches(contexts, searchTerms);
    return searchTerms.map((term, i) => {
        const count = matchesMap.get(term);
        let txt;
        if (i === 0) {
            txt = count === 10 ?
                i18n.t(TK.DocManagement_SearchResultMentionsFullAtLeast, { term, count }) :
                i18n.t(TK.DocManagement_SearchResultMentionsFull, { term, count });
        } else {
            txt = count === 10 ?
                i18n.t(TK.DocManagement_SearchResultMentionsAtLeast, { term, count }) :
                i18n.t(TK.DocManagement_SearchResultMentions, { term, count });
        }
        return txt;
    }).join(", ");
}

export const buildSearchTerms = (query: string): string[] => {
    return query
        .replace(/"/g, "")
        .split(" ")
        .filter(t => t.trim() !== "+")
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const byMostMatches = (a, b) => {
    const aMatches = (a.match(/<span class="search-hit">/g) || []).length;
    const bMatches = (b.match(/<span class="search-hit">/g) || []).length;
    return aMatches < bMatches ? 1 : -1;
}