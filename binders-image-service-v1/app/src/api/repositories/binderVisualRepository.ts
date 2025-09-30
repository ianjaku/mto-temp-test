import {
    IVisualFilter,
    ImageNotFound,
    VisualStatus,
    VisualUsage
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory,
    Query
} from "@binders/binders-service-common/lib/mongo/repository";
import { Visual, VisualFormat, VisualIdentifier } from "../model";
import {
    VisualCreationAttributes,
    VisualDAO,
    VisualRepository,
    VisualUpdate,
    daoToModel,
    getScheme,
    modelToDao,
    visualToMongoUpdate
} from "./contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { TRIMMING_MATCH_TOLERANCE_SEC } from "@binders/client/lib/clients/imageservice/v1/Visual";
import mongoose from "mongoose";
import { omit } from "ramda";

export class MongoBinderVisualRepository extends MongoRepository<VisualDAO> implements VisualRepository {

    async getBinderIdsForVisualIds(visualIds: string[]): Promise<string[]> {
        const visuals = await this.model.find({ imageId: mongoose.trusted({ $in: visualIds.map(String) }) }, ["binderId"])
            .setOptions({ sanitizeFilter: true });
        return visuals.map(dao => dao.binderId);
    }

    async saveVisual(visual: Visual): Promise<Visual> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dao = modelToDao(visual) as any;
        const savedDao = await this.saveEntity({ imageId: visual.id.value(), binderId: visual.binderId }, dao);
        return daoToModel(savedDao);
    }

    async createVisual(attr: VisualCreationAttributes): Promise<Visual> {
        const dao = {
            imageId: attr.visualId.value(),
            binderId: attr.binderId,
            fileName: attr.fileName,
            extension: attr.extension,
            md5: attr.md5,
            mime: attr.mime,
            status: attr.status,
            formats: [attr.original],

            usage: attr.usage,

            // Specific properties to VisualUsage.BinderChunk
            fitBehaviour: attr.fitBehaviour,
            bgColor: attr.bgColor,
            languageCodes: attr.languageCodes,
            rotation: attr.rotation,
            audioEnabled: attr.audioEnabled,
            autoPlay: attr.autoPlay,
            hasAudio: attr.hasAudio,

            // Specific properties to VisualUsage.ReaderComment
            commentId: attr.commentId
        } as VisualDAO;
        const insertedDao = await this.insertEntity(dao);
        return daoToModel(insertedDao);
    }

    async deleteVisual(binderId: string, visualId: VisualIdentifier, isDeleted = true, fileName?: string): Promise<void> {
        const updateResult = await this.update(
            this.singleVisualQuery(binderId, visualId),
            { isDeleted, ...(fileName ? { fileName } : {}) }
        );
        if (updateResult.matchCount === 0) {
            throw new ImageNotFound(`${binderId}/${visualId.value()}`);
        }
    }

    async softDeleteVisuals(binderId: string, visualIds: VisualIdentifier[]): Promise<number> {
        const updateResult = await this.updateMany(
            this.multipleVisualsQuery([binderId], visualIds),
            { isDeleted: true }
        );
        return updateResult.updateCount;
    }

    async hardDeleteVisual(binderId: string, visualId: VisualIdentifier): Promise<void> {
        const deletedCount = await this.deleteOne(this.singleVisualQuery(binderId, visualId));
        if (deletedCount === 0) {
            this.logger.error(`Could not delete visual ${binderId}/${visualId.value()}; not found`, "binderVisualRepository");
        }
    }

    async hardDeleteVisuals(filter: { binderIds: string[] }): Promise<void> {
        const deletedCount = await this.deleteMany(this.multipleVisualsQuery(filter.binderIds));
        if (deletedCount === 0) {
            this.logger.error(`Could not delete visuals for binders ${filter.binderIds.join(", ")}; none found`, "binderVisualRepository");
        }
        this.logger.debug(`Deleted ${deletedCount} visuals for binders ${filter.binderIds.join(", ")}`, "binderVisualRepository");
    }

    async getVisualById(visualId: string): Promise<Visual> {
        const daoOption = await this.fetchOne({ imageId: visualId });
        if (daoOption.isNothing()) {
            throw new ImageNotFound(`${visualId}`);
        }
        return daoToModel(daoOption.get());
    }

    async getVisual(binderId: string, visualId: VisualIdentifier): Promise<Visual> {
        const daoOption = await this.fetchOne(this.singleVisualQuery(binderId, visualId));
        if (daoOption.isNothing()) {
            throw new ImageNotFound(`${binderId}/${visualId.value()}`);
        }
        return daoToModel(daoOption.get());
    }

    async findVisuals(visualFilter: IVisualFilter): Promise<Visual[]> {
        const { idRegex, ids, status, statuses, createdAfter, createdBefore } = visualFilter;
        const query = {
            ...(idRegex ? { imageId: mongoose.trusted({ $regex: String(idRegex) }) } : {}),
            ...(ids ? { imageId: mongoose.trusted({ $in: ids.map(String) }) } : {}),
            ...(status ? { status } : {}),
            ...(statuses ? { status: mongoose.trusted({ $in: statuses.map(String) }) } : {}),
            ...(createdAfter ? { created: mongoose.trusted({ $gt: new Date(createdAfter) }) } : {}),
            ...(createdBefore ? { created: mongoose.trusted({ $lt: new Date(createdBefore) }) } : {}),
        }
        const daos = await this.findEntities(query);
        return daos.map(daoToModel);
    }

    async getImageIdByOriginalVisualData(originalBinderId: string, originalVisualId: string, binderId: string): Promise<Visual> {
        const daoOption = await this.fetchOne({
            binderId,
            "originalVisualData.binderId": originalBinderId,
            "originalVisualData.originalId": originalVisualId
        });
        if (daoOption.isNothing()) {
            throw new ImageNotFound(`${binderId} , ${{ originalBinderId, originalVisualId }}`);
        }
        return daoToModel(daoOption.get());
    }

    async getAllVisualsByOriginalVisualData(originalBinderId: string, originalVisualId: string): Promise<Visual[]> {
        const daos = await this.findEntities({
            "originalVisualData.binderId": originalBinderId,
            "originalVisualData.originalId": originalVisualId
        }
        );
        const filteredDaos = daos.filter(dao => dao.isDeleted !== true);
        return filteredDaos.map(daoToModel);
    }

    async getVisualWithMD5AndCommentId(binderId: string, md5: string, commentId?: string): Promise<Visual> {
        const daoOption = await this.fetchOne({
            binderId,
            md5,
            ...(commentId ? { commentId } : {})
        });
        if (daoOption.isNothing()) {
            throw new ImageNotFound(`${binderId} + md5: ${md5}`);
        }
        return daoToModel(daoOption.get());
    }

    async listBinderVisuals(
        binderId: string,
        usage: VisualUsage,
        options?: { ignoreStatus?: boolean }
    ): Promise<Array<Visual>> {
        const queryBuilder = this.model.find({ binderId }).setOptions({ sanitizeFilter: true });
        if (!options?.ignoreStatus) {
            queryBuilder.where({ status: mongoose.trusted({ $in: [VisualStatus.COMPLETED, VisualStatus.PROCESSING_BACKGROUND] }) });
        }
        // If VisualUsage is BinderChunk, then we're also looking for documents with no "usage" set
        // because old documents don't have a "usage" attribute, and they were all for binders
        if (usage === VisualUsage.BinderChunk) {
            queryBuilder.or([
                { usage: mongoose.trusted({ $exists: false }) },
                { usage }
            ]);
        } else {
            queryBuilder.where({ usage });
        }
        const daos = await queryBuilder.exec();
        const filteredDaos = daos.filter(dao => dao.isDeleted !== true);
        return filteredDaos.map(daoToModel);
    }

    async listBinderDeletedVisuals(binderId: string): Promise<Visual[]> {
        const daos = await this.findEntities({ binderId })
        const filteredDaos = daos.filter(dao => dao.isDeleted === true);
        return filteredDaos.map(daoToModel);
    }

    runScroll(doWork: (visual: Visual) => Promise<void>, query: Query = {}, maxTimeMS?: number): Promise<void> {
        return this.forEachMatchingObject(query, visualDAO => {
            return doWork(daoToModel(visualDAO));
        }, maxTimeMS);
    }

    async queryVisuals(query: Query, limit: number): Promise<Visual[]> {
        return (await this.findEntities(query, { limit })).map(daoToModel);
    }

    countVisuals(query: Query<VisualDAO> = {}): Promise<number> {
        return this.model.countDocuments(query).setOptions({ sanitizeFilter: true }).exec();
    }

    restoreVisual(binderId: string, visualId: VisualIdentifier, fileName: string): Promise<void> {
        return this.deleteVisual(binderId, visualId, false, fileName);
    }

    private singleVisualQuery(binderId: string, visualId: VisualIdentifier): Query {
        return { binderId, imageId: visualId.value() };
    }

    private multipleVisualsQuery(binderIds?: string[], visualIds?: VisualIdentifier[]): Query {
        return {
            ...(binderIds ? { binderId: mongoose.trusted({ $in: binderIds.map(String) }) } : {}),
            ...(visualIds ? { imageId: mongoose.trusted({ $in: visualIds.map(v => v.value()) }) } : {})
        };
    }

    private async removeExtraFormatsFromUpdate(binderId: string, visualId: VisualIdentifier, update: VisualUpdate): Promise<VisualUpdate> {
        const { extraFormats } = update;
        if (!extraFormats) {
            return update;
        }

        const currentVisual = await this.getVisual(binderId, visualId);

        const isSameFormatType = (a: VisualFormat, b: VisualFormat) => a.format === b.format;
        const isNearbyKeyFrame = (a: VisualFormat, b: VisualFormat) => (
            typeof a.keyFramePosition === "number" &&
            typeof b.keyFramePosition === "number" &&
            Math.abs(a.keyFramePosition - b.keyFramePosition) <= TRIMMING_MATCH_TOLERANCE_SEC
        );
        const isSameFormat = (a: VisualFormat, b: VisualFormat) => isSameFormatType(a, b) && isNearbyKeyFrame(a, b);

        const currentFormatsToKeep = currentVisual.formats.filter(
            visualFormat => !extraFormats.some(extraFormat => isSameFormat(visualFormat, extraFormat))
        );

        const dedupedNewFormats = extraFormats.filter(
            (format, i) => !extraFormats.some((otherFormat, j) => i !== j && isSameFormat(format, otherFormat))
        );

        const newFormats = [...currentFormatsToKeep, ...dedupedNewFormats];
        
        return {
            ...omit(["extraFormats"], update),
            replaceFormats: newFormats
        }
    }

    async updateVisual(binderId: string, visualId: VisualIdentifier, update: VisualUpdate): Promise<Visual> {
        const updateWithoutExtraFormats = await this.removeExtraFormatsFromUpdate(binderId, visualId, update);
        const updatedVisualDAO = await this.findOneAndUpdate(
            this.singleVisualQuery(binderId, visualId),
            visualToMongoUpdate(updateWithoutExtraFormats),
            { new: true },
        );
        if (updatedVisualDAO == null) {
            throw new ImageNotFound(`${binderId}/${visualId.value()}`);
        }
        return daoToModel(updatedVisualDAO);
    }
}

export interface BinderVisualRepositoryFactory {
    build(logger: Logger): MongoBinderVisualRepository;
}

export class MongoBinderVisualRepositoryFactory extends MongoRepositoryFactory<VisualDAO> implements BinderVisualRepositoryFactory {

    build(logger: Logger): MongoBinderVisualRepository {
        return new MongoBinderVisualRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getScheme(this.collection.name);
        this.model = this.collection.connection.model<VisualDAO>("MongoVisualDAO", schema);
    }

}
