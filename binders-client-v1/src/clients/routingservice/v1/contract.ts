import { AccountSummary } from "../../accountservice/v1/contract";
import { DocumentType } from "../../model";

export interface ReaderCssProps {
    bgMedium: string;
    bgDark: string;
    fgDark: string;
    systemFont: string;
    userFont: string;
    titleFont: string;
    headerFontColor: string;
    headerBgColor?: string;
    customTagsStyles: CustomTagStyle[];
}

export interface Font {
    fontFaceUrl: string;
    name: string;
}

export interface CustomTagStyle {
    tag: string;
    style: string;
}

export enum FontWeightType {
    thin = 200,
    light = 300,
    regular = 400,
    medium = 500,
    bold = 700,
    super = 900,
}

export interface FontProperties {
    name: string;
    fullName: string;
    weight: string;
    style: string;
}

export interface Logo {
    url: string;
    mime: string;
    size: number;
    base64Strings?: {
        small?: string;
    },
}

export interface ReaderBranding {
    id?: string;
    name?: string;
    domain?: string;
    logo?: Logo;
    stylusOverrideProps: Partial<ReaderCssProps>;
    customFonts?: Array<Font>;
}

export interface ISemanticLink {
    id?: string;
    binderId: string;
    languageCode: string;
    documentType: DocumentType;
    semanticId: string;
    domain: string;
    deleted?: boolean;
}
export interface RegexSetting {
    $regex: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $options?: any
}


export interface SemanticLinkFilter {
    id?: string;
    binderId?: string;
    binderIds?: string[];
    domain?: string | RegexSetting;
    semanticId?: string | RegExp | RegexSetting;
}

export interface DeleteSemanticLinkFilter {
    id?: string;
    binderId: string;
    domain?: string | RegexSetting;
    languageCode?: string;
}

export interface ISemanticLinkRequest {
    semanticLink: Partial<ISemanticLink>;
    slug: string;
}
export interface DomainFilter {
    domainFilterId: string;
    accountId: string;
    domain: string;
    domainCollectionId: string;
    branding?: ReaderBranding;
}

export interface IPWhitelist {
    domain: string;
    enabled: boolean;
    CIDRs: string[];
}

export interface SemanticLinkConflict {
    conflicted: boolean;
    conflictedWithDeletedItem?: boolean;
    availableForReassign?: boolean;
}

export interface SetSemanticLinkResult<S = ISemanticLink> {
    semanticLink?: S;
    conflict?: SemanticLinkConflict;
}

export interface GetDomainFiltersForAccountsOptions {
    includeBranding?: boolean;
}

export interface RoutingServiceContract {
    createReaderBranding(branding: ReaderBranding): Promise<ReaderBranding>;
    deleteReaderBranding(branding: ReaderBranding): Promise<void>;
    getBrandingForReaderDomain(domain: string): Promise<ReaderBranding>;
    setBrandingForReaderDomain(domain: string, branding: ReaderBranding): Promise<void>;
    getAccountIdsForDomain(domain: string): Promise<string[]>;
    getAccountsForDomain(domain: string): Promise<AccountSummary[]>;
    getSemanticLinkById(domain: string, semanticId: string): Promise<ISemanticLink[]>
    findSemanticLinks(binderId: string): Promise<ISemanticLink[]>;
    findSemanticLinksMulti(binderIds: string[]): Promise<{[binderId: string]: ISemanticLink[]}>;
    setSemanticLink(semanticLink: ISemanticLink, binderId: string, overrideInTrash?: boolean): Promise<SetSemanticLinkResult>;
    ensureSemanticLinks(semanticLinkRequests: ISemanticLinkRequest[]): Promise<void>;
    identifyLanguageInSemanticLinks(domain: string, itemId: string, languageCode: string): Promise<ISemanticLink[]>;
    listBrandings(): Promise<Array<ReaderBranding>>;
    listDomainFilters(): Promise<Array<DomainFilter>>;
    deleteDomainFilter(domain: string): Promise<void>;
    updateReaderBranding(id: string, branding: ReaderBranding): Promise<void>;
    setDomainsForAccount(accountId: string, domain: string[]): Promise<DomainFilter[]>;
    getDomainFiltersForAccounts(accountIds: string[], options?: GetDomainFiltersForAccountsOptions): Promise<DomainFilter[]>;
    getDomainFilterByDomain(domain: string): Promise<DomainFilter>;
    deleteSemanticLinks(filter: DeleteSemanticLinkFilter, isSoftDelete?: boolean): Promise<void>;
    getIpWhitelist(domain: string): Promise<IPWhitelist>;
    saveIpWhitelist(whitelist: IPWhitelist): Promise<void>;
    relabelLanguageInSemanticLinks(domain: string, itemId: string, fromLanguageCode: string, toLanguageCode: string): Promise<ISemanticLink[]>;
}
