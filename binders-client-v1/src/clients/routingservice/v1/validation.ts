import { READER_ROUTES_PREFIXES } from "../../../util/readerRoutes";
import { TranslationKeys as TK } from "../../../i18n/translations";
import i18n from "../../../i18n";
import { tcombValidate } from "../../validation";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

const DeleteSemanticLinkFilterStruct = t.struct({
    id: t.maybe(t.String),
    binderId: t.String,
    languageCode: t.maybe(t.String),
    semanticId: t.maybe(t.String),
});

const SemanticLinkStruct = t.struct({
    id: t.maybe(t.String),
    binderId: t.String,
    languageCode: t.String,
    semanticId: t.String,
    domain: t.String,
    deleted: t.maybe(t.Boolean),
});

const SemanticLinkRequestStruct = t.struct({
    semanticLink: t.struct({
        binderId: t.String,
        languageCode: t.String,
        documentType: t.Number,
        domain: t.String,
    }),
    // TODO sem link: move documentType outside semanticLink struct?
    slug: t.String,
});

export function validateDeleteSemanticLinkFilter(filterCandidate: unknown): string[] {
    return tcombValidate(filterCandidate, DeleteSemanticLinkFilterStruct);
}


export function validateSemanticLinkRequest(candidate: unknown): string[] {
    return tcombValidate(candidate, SemanticLinkRequestStruct);
}

export function validateGetDomainFiltersForAccountsOptions(candidate: unknown): string[] {
    return tcombValidate(candidate, t.struct({
        includeBranding: t.maybe(t.Boolean),
    }));
}

const ReaderBrandingStructure = t.struct(
    {
        id: t.maybe(t.String),
        name: t.maybe(t.String),
        domain: t.String,
        logo: t.maybe(t.Object),
        stylusOverrideProps: t.Object,
    },
    "Reader Branding",
);

const IPWhitelistStructure = t.struct({
    domain: t.String,
    CIDRs: t.list(t.String),
    enabled: t.Boolean
});

export function validateReaderBranding(readerBrandingCandidate: unknown): string[] {
    return tcombValidate(readerBrandingCandidate, ReaderBrandingStructure);
}

export function validateIPWhitelist(ipWhitelist: unknown): string[] {
    return tcombValidate(ipWhitelist, IPWhitelistStructure);
}

export function validateSemanticLink(semanticLinkCandidate: unknown): string[] {
    const errors = tcombValidate(semanticLinkCandidate, SemanticLinkStruct);
    if (errors.length > 0) {
        return errors;
    }
    const { semanticId } = semanticLinkCandidate as { semanticId: string };
    const hasSpaces = /\s+/;
    const slashesOnly = /^\/+$/;
    if (semanticId == null || hasSpaces.test(semanticId) || slashesOnly.test(semanticId)) {
        return [i18n.t(TK.Edit_InvalidSemanticLink)];
    }
    const [ link ] = semanticId.split("/");
    const lowerCaseLink = link.toLowerCase();
    const isExistingLink = READER_ROUTES_PREFIXES.has(lowerCaseLink);
    if (isExistingLink) {
        return [i18n.t(TK.Edit_InvalidSemanticLink)];
    }
    return errors;
}