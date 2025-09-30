import { DocumentType } from "@binders/client/lib/clients/model";
import { Either } from "@binders/client/lib/monad";
import { EntityIdentifier } from "@binders/binders-service-common/lib/model/entities";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import UUID from "@binders/client/lib/util/uuid";

export class DomainNotFound extends Error {
    static readonly NAME = "DomainNotFound";

    constructor(public readonly domain: string) {
        super();
        this.message = `Domain ${domain} not found`;
        this.name = DomainNotFound.NAME;
    }
}

export class SemanticLink {
    private constructor(
        readonly id: SemanticLinkIdentifier,
        readonly binderId: string,
        readonly languageCode: string,
        readonly documentType: DocumentType,
        readonly domain: string,
        readonly semanticId: string,
        readonly deleted?: boolean,
    ) {
    }

    static create(
        binderId: string,
        languageCode: string,
        documentType: DocumentType,
        domain: string,
        semanticId: string,
    ): SemanticLink {
        return new SemanticLink(
            SemanticLinkIdentifier.generate(),
            binderId,
            languageCode,
            documentType,
            domain,
            semanticId
        );
    }

    static from(
        id: string,
        binderId: string,
        languageCode: string,
        documentType: DocumentType,
        domain: string,
        semanticId: string,
        deleted?: boolean
    ): SemanticLink {
        return new SemanticLink(
            SemanticLinkIdentifier.from(id),
            binderId,
            languageCode,
            documentType,
            domain,
            semanticId,
            deleted
        );
    }
}

export class SemanticLinkAlreadyExist extends Error {

    static readonly NAME = "SemanticLinkAlreadyExist";

    constructor(public readonly validationErrors: string[]) {
        super();
        this.message = "Hyperlink already is used by other document";
        this.name = SemanticLinkAlreadyExist.NAME;
    }
}

export class SemanticLinkIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "sli-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(SemanticLinkIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid semantic link id '${id}'`);
        }
    }

    static generate(): SemanticLinkIdentifier {
        const id = UUID.randomWithPrefix(SemanticLinkIdentifier.PREFIX);
        return new SemanticLinkIdentifier(id);
    }

    static from(id: string): SemanticLinkIdentifier {
        return new SemanticLinkIdentifier(id);
    }

    static build(key: string): Either<Error, SemanticLinkIdentifier> {
        try {
            return Either.right<Error, SemanticLinkIdentifier>(new SemanticLinkIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}