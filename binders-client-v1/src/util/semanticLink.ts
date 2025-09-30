import { ISemanticLink } from "../clients/routingservice/v1/contract";
import { SLUG_STYLE_SUFFIX_REGEX } from "./slugify";

export function getSemanticLinkToUseForSharing(semanticLinks: ISemanticLink[], languageCode?: string): ISemanticLink {
    let candidates = languageCode && semanticLinks.filter(link => link.languageCode === languageCode);
    if (!(candidates?.length)) {
        candidates = semanticLinks;
    }
    const firstHumanCreatedCandidate = candidates.find(semanticLink => !SLUG_STYLE_SUFFIX_REGEX.test(semanticLink.semanticId));
    return firstHumanCreatedCandidate ?? candidates[0];
}