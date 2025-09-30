import * as mongoose from "mongoose";
import {
    DeleteSemanticLinkFilter,
    ISemanticLinkRequest,
    SemanticLinkFilter,
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { MAX_SLUG_SUFFIX_LENGTH, MIN_SLUG_SUFFIX_LENGTH } from "@binders/client/lib/util/slugify";
import {
    MongoRepository,
    MongoRepositoryFactory,
    Query,
    UpdateResult
} from "@binders/binders-service-common/lib/mongo/repository";
import { DocumentType } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { SemanticLink } from "../model";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface ServerSemanticLinkFilter extends SemanticLinkFilter {
    semanticIdRegex?: string;
    semanticIdRegexOptions?: string;
    semanticIdCaseSensitive?: string;
}

export interface SemanticLinkRepository {
    findSemanticLinks(filter: ServerSemanticLinkFilter): Promise<Array<SemanticLink>>;
    findSemanticLinksMulti(filter: ServerSemanticLinkFilter): Promise<{ [binderId: string]: SemanticLink[] }>;
    ensureSemanticLinks(semanticLinkRequests: ISemanticLinkRequest[]): Promise<void>;
    relabelLanguageInSemanticLinks(domain: string, itemId: string, fromLanguageCode: string, toLanguageCode: string): Promise<SemanticLink[]>;
    deleteSemanticLinks(filter: DeleteSemanticLinkFilter, isSoftDelete?: boolean): Promise<void>;
    createSemanticLink(semanticLink: SemanticLink): Promise<SemanticLink>;
    updateSemanticLink(semanticLink: SemanticLink): Promise<SemanticLink>;
    replaceDomainInSemanticLinks(oldDomain: string, newDomain: string): Promise<UpdateResult>
}

export interface ISemanticLinkDocument extends mongoose.Document {
    id: string;
    binderId: string;
    languageCode: string;
    documentType: DocumentType;
    domain: string;
    semanticId: string;
    deleted: boolean;
}

function getSemanticLinkSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        id: {
            type: String,
            required: true,
        },
        binderId: {
            type: String,
            required: true
        },
        languageCode: {
            type: String,
            required: true
        },
        documentType: {
            type: Number,
            required: true
        },
        semanticId: {
            type: String,
            required: true
        },
        domain: {
            type: String,
            required: true
        },
        deleted: Boolean,
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

function daoToModel(dao: ISemanticLinkDocument): SemanticLink {
    return SemanticLink.from(
        dao.id,
        dao.binderId,
        dao.languageCode,
        dao.documentType,
        dao.domain,
        dao.semanticId,
        dao.deleted,
    );
}

function modelToDao(model: SemanticLink): ISemanticLinkDocument {
    return {
        id: model.id.value(),
        binderId: model.binderId,
        languageCode: model.languageCode,
        documentType: model.documentType,
        domain: model.domain,
        deleted: model.deleted || false,
        semanticId: model.semanticId,
    } as ISemanticLinkDocument;
}

function getExcapedRegExp(value: string): RegExp {
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + escapedValue + "$", "i")
}

export class MongoSemanticLinkRepository extends MongoRepository<ISemanticLinkDocument> implements SemanticLinkRepository {

    private async findSemanticLinksForSlug(
        binderId: string,
        domain: string,
        languageCode: string,
        slug: string,
    ): Promise<ISemanticLinkDocument[]> {
        return this.findEntities({
            binderId,
            domain,
            semanticId: new RegExp(`^${slug}-\\d{${MIN_SLUG_SUFFIX_LENGTH},${MAX_SLUG_SUFFIX_LENGTH}}$`),
            languageCode,
        });
    }

    async findSemanticLinks(clientFilter: ServerSemanticLinkFilter): Promise<Array<SemanticLink>> {
        const query = this.setupQuery(clientFilter);
        const daos = await this.findEntities(query);
        return daos.map(daoToModel);
    }

    async findSemanticLinksMulti(clientFilter: ServerSemanticLinkFilter): Promise<{ [binderId: string]: SemanticLink[] }> {
        const filter = this.setupQuery(clientFilter);
        const daos = await this.findEntities(filter);
        const semanticLinks = daos.map(daoToModel);
        return semanticLinks.reduce((acc, link) => {
            if (!acc[link.binderId]) {
                acc[link.binderId] = [];
            }
            acc[link.binderId].push(link);
            return acc;
        }, {} as { [binderId: string]: SemanticLink[] });
    }

    async ensureSemanticLinks(semanticLinkRequests: ISemanticLinkRequest[]): Promise<void> {
        for (const { semanticLink, slug } of semanticLinkRequests) {
            const { binderId, languageCode, documentType, domain } = semanticLink;
            const matchingLinks = await this.findSemanticLinksForSlug(binderId, domain, languageCode, slug);
            if (matchingLinks.length === 0) {
                const availableSemanticId = await this.getUniqueSemanticIdFor(domain, slug);
                await this.saveSemanticLink(SemanticLink.create(
                    binderId,
                    languageCode,
                    documentType,
                    domain,
                    availableSemanticId,
                ));
            } else {
                const linksToUpdate = matchingLinks.filter(l => l.deleted);
                for (const link of linksToUpdate) {
                    link.deleted = false;
                    await this.updateSemanticLink(daoToModel(link));
                }
            }
        }
    }

    private async getUniqueSemanticIdFor(domain: string, slug: string): Promise<string> {
        let suffixLength = MIN_SLUG_SUFFIX_LENGTH;
        while (suffixLength <= MAX_SLUG_SUFFIX_LENGTH) {
            const suffix = Math.random().toString()
                .substring(2, suffixLength + 2)
                .padEnd(suffixLength, "0");
            const semanticId = `${slug}-${suffix}`;
            const existingLink = await this.fetchOne({ domain, semanticId });
            if (existingLink.isNothing()) {
                return semanticId;
            }
            suffixLength++;
        }
        throw new Error(`Could not find a unique slug for ${slug}`);
    }

    async relabelLanguageInSemanticLinks(
        domain: string,
        itemId: string,
        fromLanguageCode: string,
        toLanguageCode: string
    ): Promise<SemanticLink[]> {
        await this.updateMany(
            { domain, binderId: itemId, languageCode: fromLanguageCode },
            { $set: { languageCode: toLanguageCode } }
        );
        const semanticLinks = await this.findEntities({ domain, binderId: itemId });
        return semanticLinks.map(daoToModel);
    }

    async saveSemanticLink(semanticLink: SemanticLink): Promise<void> {
        const {
            id,
            binderId,
            languageCode,
            documentType,
            domain,
            semanticId,
            deleted,
        } = semanticLink;
        await this.upsert(
            { binderId, domain, semanticId },
            modelToDao({
                id,
                binderId,
                languageCode,
                documentType,
                domain,
                semanticId,
                deleted,
            })
        );
    }

    async deleteSemanticLinks(clientFilter: DeleteSemanticLinkFilter, isSoftDelete = false): Promise<void> {
        this.validateDeleteFilter(clientFilter);
        if (isSoftDelete) {
            await this.updateMany(clientFilter, { deleted: true })
            return;
        }
        await this.deleteEntity(clientFilter);
    }

    private validateDeleteFilter(filter: DeleteSemanticLinkFilter): void {
        if (filter.id) {
            return;
        }
        if (filter.binderId) {
            return;
        }
        const exception = new Error(`Invalid delete filter: ${JSON.stringify(filter)}`);
        this.logger.logException(exception, "semantic-link-delete");
        throw exception
    }

    private setupQuery(clientFilter: ServerSemanticLinkFilter): Query<ISemanticLinkDocument> {
        const {
            id,
            binderId,
            binderIds,
            semanticId,
            semanticIdRegex,
            semanticIdRegexOptions,
            semanticIdCaseSensitive,
            domain,
        } = clientFilter;
        const query: Query<ISemanticLinkDocument> = {};
        if (id) {
            query.id = id;
        }
        if (binderId) {
            query.binderId = binderId;
        }
        if (binderIds) {
            query.binderId = mongoose.trusted({ $in: binderIds.map(String) });
        }
        if (semanticIdCaseSensitive) {
            query.semanticId = semanticIdCaseSensitive;
        }
        if (semanticId) {
            query.semanticId = getExcapedRegExp(semanticId as string)
        }
        if (semanticIdRegex) {
            query.semanticId = mongoose.trusted({
                $regex: String(semanticIdRegex),
                ...(semanticIdRegexOptions ? { $options: String(semanticIdRegexOptions) } : {}),
            });
        }
        if (domain) {
            query.domain = domain;
        }
        return query;
    }

    async createSemanticLink(semanticLink: SemanticLink): Promise<SemanticLink> {
        const dao = modelToDao(semanticLink);
        const newSemanticLink = await this.insertEntity(dao);
        return daoToModel(newSemanticLink);
    }

    async updateSemanticLink(semanticLink: SemanticLink): Promise<SemanticLink> {
        const dao = modelToDao(semanticLink);
        const updatedSemanticLink = await this.updateEntity(
            { domain: dao.domain, semanticId: dao.semanticId }, dao);
        return daoToModel(updatedSemanticLink);
    }

    async replaceDomainInSemanticLinks(oldDomain: string, newDomain: string): Promise<UpdateResult> {
        return this.updateMany({ domain: oldDomain }, { domain: newDomain })
    }
}

export class SemanticLinkRepositoryFactory extends MongoRepositoryFactory<ISemanticLinkDocument> {

    build(logger: Logger): MongoSemanticLinkRepository {
        return new MongoSemanticLinkRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSemanticLinkSchema(this.collection.name);
        schema.index({ semanticId: 1 });
        schema.index({ semanticId: 1, domain: 1 }, { unique: true });
        schema.index({ binderId: 1 });
        this.model = this.collection.connection.model<ISemanticLinkDocument>("SemanticLinkDAO", schema);
    }
}
