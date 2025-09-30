import {
    Binder,
    BinderSearchResultOptions,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations"
import { getLanguageName } from "@binders/client/lib/languages/helper"
import i18next from "@binders/client/lib/i18n"

export class InvalidBinder extends Error {

    static readonly NAME = "InvalidBinder";

    constructor(public readonly validationErrors: string[]) {
        super();
        this.message = "Invalid binder provided";
        this.name = InvalidBinder.NAME;
    }
}


export class InvalidParam extends Error {

    static readonly NAME = "InvalidParam";

    constructor(public readonly validationErrors: string[]) {
        super();
        this.message = "Invalid parameter supplied to endpoint";
        this.name = InvalidParam.NAME;
    }
}

export class InvalidCollection extends Error {
    static readonly NAME = "InvalidCollection";

    constructor(public readonly validationErrors: string[]) {
        super();
        this.message = "Invalid collection provided";
        this.name = InvalidCollection.NAME;
    }
}

export class InvalidPublication extends Error {

    static readonly NAME = "InvalidPublication";

    constructor(public readonly validationErrors: string[], public readonly extraInfo?: string) {
        super();
        this.message = `Invalid publication provided: ${validationErrors.join()} ${extraInfo || ""}`;
        this.name = InvalidPublication.NAME;
    }
}

export class WillNotOrphan extends Error {
    static readonly NAME = "WillNotOrphan";

    constructor() {
        super();
        this.message = "Cannot remove document from its last parent collection";
        this.name = WillNotOrphan.NAME;
    }
}

export class BinderHasPublicationError extends Error {
    static readonly NAME = "BinderHasPublicationError";

    constructor() {
        super();
        this.message = "Document has publications";
        this.name = BinderHasPublicationError.NAME;
    }
}

export class CollectionNotEmpty extends Error {
    static readonly NAME = "CollectionNotEmpty";

    constructor(public readonly collectionId: string) {
        super();
        this.message = "Collection is not empty.";
        this.name = CollectionNotEmpty.NAME;
    }
}

export class CollectionLastTitle extends Error {
    static readonly NAME = "CollectionLastTitle";

    constructor(public readonly collectionId: string) {
        super();
        this.message = "Cannot remove collection last title.";
        this.name = CollectionNotEmpty.NAME;
    }
}

export class NonExistingDomainFilter extends Error {
    static readonly NAME = "NonExistingDomainFilter";

    constructor(public readonly domain: string) {
        super();
        this.message = `This domain (${domain}) does not exist.`;
        this.name = NonExistingDomainFilter.NAME;
    }
}

export class NonExistingItem extends Error {
    static readonly NAME = "NonExistingItem";

    constructor(public readonly id: string) {
        super();
        this.message = `This item (${id}) does not exist.`;
        this.name = NonExistingItem.NAME;
    }
}

export class CircularPathError extends Error {
    static readonly NAME = "CircularPathError";
    constructor() {
        super();
        this.message = "The path you selected has the item you are moving as a parent. This is not allowed.";
        this.name = CircularPathError.NAME;
    }
}

export class ItemInstanceAlreadyInCollectionError extends Error {
    static readonly NAME = "ItemInstanceAlreadyInCollectionError";
    constructor() {
        super();
        this.message = "The path you selected already contains the item. This is not allowed.";
        this.name = ItemInstanceAlreadyInCollectionError.NAME;
    }
}

export class UnsupportedLanguageError extends Error {
    static readonly NAME = "UnsupportedLanguageError";

    languageCodes: string[];

    constructor(unsupported: string | string[], interfaceLanguage?: string) {
        super();
        const languageCodes = Array.isArray(unsupported) ? unsupported : [ unsupported ];
        const languageNames = languageCodes.map(c => getLanguageName(c));
        const t = (key, params = {}) => i18next.t(key, { lng: interfaceLanguage, ...params });
        const failMsg = t(TK.Edit_TranslateFail);
        const unsupportedMsg = t( TK.Edit_TranslateFailUnsupportedLanguage, {
            count: languageNames.length,
            unsupportedLanguage: languageNames.join(", ")
        });
        this.message = `${failMsg}. ${unsupportedMsg}`;
        this.name = UnsupportedLanguageError.NAME;
        this.languageCodes = languageCodes;
    }
}

export class CogtnitiveAPITimeout extends Error {
    static readonly NAME = "CogtnitiveAPITimeout";
    constructor() {
        super();
        this.message = "Cognitive API timeout";
        this.name = CogtnitiveAPITimeout.NAME;
    }
}

export class InvalidRecursiveActionOpeartion extends Error {

    static readonly NAME = "InvalidRecursiveActionOpeartion";

    constructor(public readonly operation: unknown) {
        super();
        this.message = `Invalid recursive action operation: ${operation}`;
        this.name = InvalidRecursiveActionOpeartion.NAME;
    }
}

export class MissingTitle extends Error {

    static readonly NAME = "MissingTitle";

    constructor(public readonly binderId: string, languageCode: string) {
        super();
        this.message = `Missing title provided for given binder id: ${binderId}, ${languageCode}`;
        this.name = MissingTitle.NAME;
    }
}


export class NothingToPublish extends Error {

    static readonly NAME = "NothingToPublish";

    constructor(public readonly binderId: string,public readonly languageCode: string) {
        super();
        this.message = `Nothing to publish for given binder id: ${binderId}, ${languageCode}`;
        this.name = NothingToPublish.NAME;
    }
}

export class MissingLanguage extends Error {

    static readonly NAME = "MissingLanguage";

    constructor(public readonly binderId: string, public readonly languageCode: string) {
        super();
        this.message = `Missing title provided for given binder id: ${binderId}, ${languageCode}`;
        this.name = MissingLanguage.NAME;
    }
}

export class MissingApprovals extends Error {
    static readonly NAME = "MissingApprovals";
    constructor() {
        super();
        this.message = "Binder lacks chunk approvals";
        this.name = MissingApprovals.NAME;
    }
}

export class MasterLanguageNotSet extends Error {
    static readonly NAME = "MasterLanguageNotSet";
    constructor() {
        super();
        this.message = "Master language not set";
        this.name = MasterLanguageNotSet.NAME;
    }
}

export interface ServerSideSearchOptions extends BinderSearchResultOptions {
    binderIdField?: string;
    /**
     * By default, ES does not count all the hits for a query (but returns a generic 10k or so)
     * and to work around it we need to set an additional query param. Use it sparingly since it
     * comes with performance implications
     */
    resolveTotalHitsValue?: boolean;
}

export const isServerSideSearchOptions = (options: BinderSearchResultOptions): options is ServerSideSearchOptions =>
    Object.hasOwn(options, "binderIdField");

export function isCollection(document: Binder | DocumentCollection): document is DocumentCollection {
    if ( (<Binder>document).modules) {
        return false;
    }
    return true;
}
