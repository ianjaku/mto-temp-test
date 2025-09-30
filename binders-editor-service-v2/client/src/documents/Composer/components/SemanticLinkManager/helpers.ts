import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";

export type SemanticLinkMap = {
    [languageCode: string]: ISemanticLink[],
};

export function groupSemanticLinks(semanticLinks: ISemanticLink[]): SemanticLinkMap {
    return semanticLinks.reduce((reduced, semanticLink) => {
        if (!reduced[semanticLink.languageCode]) {
            reduced[semanticLink.languageCode] = [];
        }
        reduced[semanticLink.languageCode].push(semanticLink);
        return reduced;
    }, {} as SemanticLinkMap);
}
