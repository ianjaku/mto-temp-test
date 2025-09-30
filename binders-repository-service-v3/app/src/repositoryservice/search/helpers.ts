import {
    BinderSearchHit,
    CollectionSearchHit,
    HitType,
    IDescendantsMap,
    PublicationSearchHit,
    SearchResult,
    isCollectionHitType
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getAllLanguageCodes, getLanguageInfo } from "@binders/client/lib/languages/helper";
import { DESIRED_NUMBER_OF_RESULTS } from "./const";
import {
    SEARCH_QUERY_LANGUAGE_OPTION_REGEX
} from  "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { UnsupportedLanguageError } from "../model";
import getDialects from "@binders/client/lib/languages/dialects";
import { idOfSearchHit } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

export type FoundScopedSearchResults = { [key: string]: boolean }

export function sortSearchResultsByScore<I extends HitType>(results: SearchResult<I>): SearchResult<I> {
    const hits = [...results.hits].sort((hitA, hitB) => {
        let scoreA = hitA.score;
        if (isCollectionHitType(hitA)) scoreA *= 1.5;
        let scoreB = hitB.score;
        if (isCollectionHitType(hitB)) scoreB *= 1.5;
        return scoreB - scoreA;
    });
    return {
        ...results,
        hits
    }
}

export function mergeSearchResults<I extends HitType>(
    result1: SearchResult<I>,
    result2: SearchResult<I>
): SearchResult<I> {
    // Remove duplicates
    const mapOfFoundItems = buildFoundReaderItemsMap(result1)
    const hits = [...result1.hits];
    for (const hit of result2.hits) {
        if (!mapOfFoundItems[getItemId(hit)]) {
            hits.push(hit)
        }
    }
    
    const isTruncated = result1.isTruncated || result2.isTruncated
    return {
        totalHitCount: hits.length,
        hits,
        isTruncated
    }
}

export function getItemId(hit: CollectionSearchHit | PublicationSearchHit | BinderSearchHit): string | undefined {
    if ("publicationSummary" in hit) {
        return (hit as PublicationSearchHit).publicationSummary.id
    }
    if ("collection" in hit) {
        return (hit as CollectionSearchHit).collection.id
    }
    if ("binderSummary" in hit) {
        return (hit as BinderSearchHit).binderSummary.id
    }
    return undefined
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildFoundReaderItemsMap<I extends HitType>(scopedSearchResults: SearchResult<I>) {
    return scopedSearchResults.hits
        .map(getItemId)
        .filter(id => !!id)
        .reduce((map, id) => (map[id] = true, map), {})
}




// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildSortByDescendantDepth(descendantsMap: IDescendantsMap) {
    function depthOfItem(itemId: string): number | undefined {
        const depthStr = Object.keys(descendantsMap).find(depth => descendantsMap[depth].some(el => el.key === itemId));
        return depthStr ? parseInt(depthStr) : undefined;
    }
    return function (hit1: HitType, hit2: HitType) {
        const depth1 = depthOfItem(idOfSearchHit(hit1));
        const depth2 = depthOfItem(idOfSearchHit(hit2));
        if (depth1 !== undefined && depth2 === undefined) {
            return -1;
        }
        if (depth1 === undefined && depth2 !== undefined) {
            return 1;
        }
        return depth1 - depth2;
    }
}

export function getEmptySearchResult<I extends HitType>(): SearchResult<I> {
    return {
        totalHitCount: 0,
        hits: [],
    }
}

export function haveEnoughSearchResults<I extends HitType>(results: SearchResult<I>): boolean {
    const { hits } = results
    return hits?.length && hits.length >= DESIRED_NUMBER_OF_RESULTS
}

export function maybeCutSearchResultsForClient<I extends HitType>(results: SearchResult<I>, scope = true): SearchResult<I> {
    if (!haveEnoughSearchResults(results)) {
        return results
    }
    const filteredHits = results?.hits.slice(0, DESIRED_NUMBER_OF_RESULTS)
    return {
        ...results,
        totalHitCount: filteredHits.length,
        hits: filteredHits,
        isTruncatedInScope: scope && true,
        isTruncatedOutsideScope: !scope && true
    }
}

/**
 * Looks for occurences of language settings in the query string (example: "lang:fr" for French)
 * removes them from the query and returns them as the "strictLanguages" key
 */
export async function parseQueryLanguageRestrictions(
    queryString: string
): Promise<{
    queryString: string, // After removing the language restriction text
    strictLanguages?: string[]
}> {
    // Match "lang:[langCode]" and "lang:[langCode]-[dialect]" && "lang:[LanguageName]"
    const langMatches = queryString.match(SEARCH_QUERY_LANGUAGE_OPTION_REGEX);
    if (langMatches != null) {
        // Remove the language restrictions from the query string
        const newQueryString = langMatches.reduce((newQuery, match) => {
            return newQuery.replace(match, "");
        }, queryString);

        let languageCodes = langMatches.map(match => (
            match.toLowerCase().replace("lang:", "")
        ));
        languageCodes = await normalizeAndValidateLanguages(languageCodes);
        languageCodes = addLanguageDialects(languageCodes);
        languageCodes = replaceUnknownWithXX(languageCodes);
        return {
            queryString: newQueryString.trim(),
            strictLanguages: languageCodes
        }
    }
    return {
        queryString,
        strictLanguages: null
    }
}

export async function normalizeAndValidateLanguages(
    languageCodes: string[]
): Promise<string[]> {
    const supportedLanguageCodes = getAllLanguageCodes(true);
    return languageCodes.map(languageCode => {
        if (["xx", "unknown"].includes(languageCode.toLowerCase())) {
            return languageCode.toLowerCase();
        }
        const foundLanguageCode = supportedLanguageCodes.find(langCode => {
            const langInfo = getLanguageInfo(langCode);
            return (
                langCode.toLowerCase() === languageCode.toLowerCase() ||
                    langInfo.name.toLowerCase() === languageCode.toLowerCase() ||
                    langInfo.nativeName.toLowerCase() === languageCode.toLowerCase()
            )
        })
        if (foundLanguageCode == null) {
            throw new UnsupportedLanguageError(languageCode);
        }
        return foundLanguageCode;
    });
}

export function replaceUnknownWithXX(languageCodes: string[]): string[] {
    return languageCodes.map(languageCode => {
        if (languageCode.toLowerCase() === "unknown") {
            return "xx";
        }
        return languageCode;
    });
}

export function addLanguageDialects(languageCodes: string[]): string[] {
    const result: string[] = [...languageCodes];
    const dialects = getDialects();
    languageCodes.forEach(languageCode => {
        const languageDialects = dialects[languageCode];
        if (languageDialects == null) return;
        result.push(...Object.keys(languageDialects));
    });
    return result;
}