import { ISemanticLink } from "../clients/routingservice/v1/contract";
import { QUERY_PARAM_MTLC } from "../react/hooks/useQueryParams";
import { getReaderLocation } from "../util/domains";
import { isProduction } from "../util/environment";
import { withProtocol } from "../util/uri";

export interface IReaderLinkParams {
    isCollection: boolean,
    lang?: string,
    itemId: string,
    parentCollections?: string,
    semanticLinks?,
    domain,
    readerLocation,
    hasDraft?: boolean,
    fullPath?: boolean,
    isPublication?: boolean,
    isDraft?: boolean,
    machineTranslatedLanguageCode?: string;
}

function getRoute(isCollection, isDraft, isPublication) {
    if (isCollection) {
        return "browse";
    }
    if (isPublication) {
        return "read";
    }
    return isDraft ? "preview" : "launch";
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildLink(linkConfig: IReaderLinkParams) {
    const defaultConfig = {
        isDraft: false,
        fullPath: true,
        isPublication: false,
        parentCollections: "",
        lang: undefined,
        semanticLinks: [],
    };
    const config = { ...defaultConfig, ...linkConfig };

    const {
        isCollection,
        lang,
        itemId,
        parentCollections,
        semanticLinks,
        domain,
        readerLocation,
        isDraft,
        fullPath,
        isPublication,
        machineTranslatedLanguageCode,
    } = config;

    const semanticLink = (semanticLinks || []).filter(l => l.languageCode === lang).pop();

    const path = getRoute(isCollection, isDraft, isPublication);
    const queryParams = (isCollection || isPublication || (semanticLink && semanticLink.semanticId)) ? [] : [`lang=${lang}`];
    const parent = fullPath && parentCollections ?
        `/${parentCollections}` :
        "";
    const semanticId = semanticLink && semanticLink.semanticId;
    const semanticDomain = semanticLink && semanticLink.domain;

    if (!isProduction()) {
        queryParams.push(`domain=${domain}`);
    }
    if (machineTranslatedLanguageCode) {
        queryParams.push(`${QUERY_PARAM_MTLC}=${machineTranslatedLanguageCode}`)
    }
    const queryString = queryParams.length > 0 ?
        `?${queryParams.join("&")}` :
        "";
    const readerLocationToUse = (isProduction() && semanticDomain) || readerLocation;
    const readerLocationNoTrailing = (readerLocationToUse && readerLocationToUse.endsWith("/")) ?
        readerLocationToUse.slice(0, -1) :
        readerLocationToUse;
    const readerLocationWithProtocol = withProtocol(readerLocationNoTrailing);

    return semanticLink && semanticId ?
        `${readerLocationWithProtocol}/${semanticId}${queryString}` :
        `${readerLocationWithProtocol}/${path}${parent}/${itemId}${queryString}`;
}

/**
 * The same as builLink, but returns multiple results
 *  when there are multiple semantic links.
 */
export function buildLinks(linkConfig: IReaderLinkParams): string[] {
    if (linkConfig.isCollection || linkConfig.isPublication) {
        return [buildLink(linkConfig)];
    }

    let semanticLinks = linkConfig.semanticLinks ?? [];
    semanticLinks = semanticLinks.filter(l => l.languageCode === linkConfig.lang);

    if (semanticLinks.length === 0) {
        return [buildLink(linkConfig)];
    }

    return semanticLinks.map(semanticLink => {
        return buildLink({
            ...linkConfig,
            semanticLinks: [semanticLink],
        });
    });
}

export function generateDocumentLink(semanticLink: ISemanticLink, override?: Partial<IReaderLinkParams>): string {
    const { binderId, domain, semanticId, languageCode } = semanticLink;
    const readerLocation = getReaderLocation(domain);
    const config = {
        isCollection: false,
        lang: languageCode,
        itemId: binderId,
        semanticLinks: [{ semanticId, languageCode: languageCode, domain }],
        domain,
        readerLocation,
        isDraft: false,
        fullPath: false,
        isPublication: false,
        ...(override ?? {}),
    }
    return buildLink(config);
}
