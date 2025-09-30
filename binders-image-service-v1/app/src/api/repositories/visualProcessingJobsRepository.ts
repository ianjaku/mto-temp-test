import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import {
    ProcessingStep,
    VisualProcessingJob
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export const MAX_VIDEO_PROCESSING_RETRIES = 2;

const getSchema = (collectionName: string): mongoose.Schema => {
    const schema = new mongoose.Schema({
        visualId: { type: String, required: true },
        step: { type: String, required: true },
        stepDetails: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
        },
        accountId: { type: String, required: true },
        retries: { type: Number },
        created: { type: Date, default: Date.now },
        updated: { type: Date, default: Date.now },
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

type VisualProcessingJobDAO = VisualProcessingJob & mongoose.Document;

const daoToModel = (dao: VisualProcessingJobDAO): VisualProcessingJob => {
    return {
        visualId: dao.visualId,
        step: dao.step,
        stepDetails: dao.stepDetails,
        created: dao.created,
        updated: dao.updated,
        accountId: dao.accountId,
        retries: dao.retries,
    } as VisualProcessingJob;
};

export type CreateJobDetails = Pick<VisualProcessingJob, "stepDetails" | "accountId">;
export type UpdateJobStepDetails = Pick<VisualProcessingJob, "stepDetails">;
export class MaxReprocessingRetriesError extends Error {
    constructor(visualId: string) {
        super(`Max reprocessing retries (${MAX_VIDEO_PROCESSING_RETRIES}) reached for visualId: ${visualId}`);
    }
}
export class ProcessingJobInProgressError extends Error {
    constructor(visualId: string) {
        super(`Processing job already in progress for visualId: ${visualId}`);
    }
}

type FindJobsRestrictions = {
    visualIds?: string[],
    createdAfter?: Date,
    lastUpdatedBefore?: Date,
    steps?: ProcessingStep[]
    limit?: number
};

export interface VisualProcessingJobsRepository {
    /**
     * Creates a new {@link VisualProcessingJob} for the provided <code>visualId</code>.
     * Will fail if it already exists
     * */
    createJobForVisual(visualId: string, step: ProcessingStep, jobDetails: CreateJobDetails): Promise<VisualProcessingJob>;

    /**
     * Updates the job {@link ProcessingStep} for the visual and updates or clears the job details
     */
    transitionJob(visualId: string, step: ProcessingStep, jobDetails?: Record<string, unknown>, options?: { increaseRetryCount: boolean }): Promise<VisualProcessingJob>;

    /**
     * Updates the job details for the job associated with the <code>visualId</code>
     */
    updateJobStepDetailsForVisual(visualId: string, stepDetails: UpdateJobStepDetails): Promise<void>;

    /**
     * Find jobs satisfying the created & updated limits starting with the oldest
     */
    findJobsWithRestrictions(restrictions: FindJobsRestrictions): Promise<VisualProcessingJob[]>;

    /**
     * Find {@link VisualProcessingJob} by <code>visualId</code>
     */
    findJobForVisual(visualId: string): Promise<VisualProcessingJob | null>;

    /**
     * Delete {@link VisualProcessingJob} by <code>visualId</code>
     */
    deleteJobForVisual(visualId: string): Promise<void>;
}

export class MongoVisualProcessingJobsRepository extends MongoRepository<VisualProcessingJobDAO> implements VisualProcessingJobsRepository {

    async createJobForVisual(visualId: string, step: ProcessingStep, jobDetails: CreateJobDetails): Promise<VisualProcessingJob> {
        const dao = await this.insertEntity({
            visualId,
            step,
            ...jobDetails,
        } as unknown as VisualProcessingJobDAO);
        return daoToModel(dao);
    }

    async transitionJob(
        visualId: string,
        step: ProcessingStep,
        jobDetails: Record<string, unknown> = {},
        options?: { increaseRetryCount: boolean },
    ): Promise<VisualProcessingJob> {
        const dao = await this.findOneAndUpdate({ visualId }, {
            step,
            ...jobDetails,
            ...(options?.increaseRetryCount ? { $inc: { retries: 1 } } : {}),
        }, { new: true }) as unknown as VisualProcessingJobDAO;
        return daoToModel(dao);
    }

    async updateJobStepDetailsForVisual(visualId: string, stepDetails: UpdateJobStepDetails): Promise<void> {
        await this.findOneAndUpdate({ visualId }, { ...stepDetails }, { new: true });
    }

    async findJobsWithRestrictions({
        visualIds,
        createdAfter,
        lastUpdatedBefore,
        steps,
        limit
    }: FindJobsRestrictions): Promise<VisualProcessingJob[]> {
        const query = {
            ...(visualIds ? { visualId: mongoose.trusted({ $in: visualIds.map(String) }) } : {}),
            ...(createdAfter ? { created: mongoose.trusted({ $gt: new Date(createdAfter) }) } : {}),
            ...(lastUpdatedBefore ? { updated: mongoose.trusted({ $lt: new Date(lastUpdatedBefore) }) } : {}),
            ...(steps ? { step: mongoose.trusted({ $in: steps.map(String) }) } : {}),
        };
        const results = await this.findEntities(query, {
            limit,
            orderByField: "created",
            sortOrder: "ascending",
        });
        return results.map(daoToModel);
    }

    async findJobForVisual(visualId: string): Promise<VisualProcessingJob | null> {
        const job = await this.findOne({ visualId });
        return job == null ? null : daoToModel(job);
    }

    async deleteJobForVisual(visualId: string): Promise<void> {
        await this.deleteOne({ visualId });
    }
}

export interface VisualProcessingJobsRepositoryFactory {
    build(logger: Logger): MongoVisualProcessingJobsRepository;
}

export class MongoVisualProcessingJobsRepositoryFactory extends MongoRepositoryFactory<VisualProcessingJobDAO> implements VisualProcessingJobsRepositoryFactory {

    build(logger: Logger): MongoVisualProcessingJobsRepository {
        return new MongoVisualProcessingJobsRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({ visualId: 1 }, { unique: true });
        schema.index({ step: 1 }, { unique: false });
        this.model = this.collection.connection.model<VisualProcessingJobDAO>("VisualProcessingJobDAO", schema);
    }
}
