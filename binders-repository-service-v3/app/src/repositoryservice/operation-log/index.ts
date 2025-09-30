import { ElasticOperation, OperationLog } from "../repositories/models/operationLog";
import {
    IElasticOperationLogRepository,
    OperationLogRepositoryFactory
} from "../repositories/operationlogrepository";
import { CollectionConfig } from "@binders/binders-service-common/lib/mongo/config";
import { IFeatureFlagService } from "@binders/binders-service-common/lib/launchdarkly/server";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface IOperationLog {
    log(operation: ElasticOperation, payload: Record<string, unknown>): Promise<void>;
    getAll(): Promise<OperationLog[]>;
    purgeAll(): Promise<void>;
}

const CATEGORY = "operation-log"

export class OperationLogService implements IOperationLog {
    constructor(
        private readonly repository: IElasticOperationLogRepository,
        private readonly featureFlagsService: IFeatureFlagService,
        private readonly logger: Logger
    ) { }

    async log(operation: ElasticOperation, payload: Record<string, unknown>): Promise<void> {
        try {
            const enableElasticLogOperation = await this.featureFlagsService.getFlag<boolean>(LDFlags.ENABLE_PUBLICATION_LOG_OPERATIONS);
            if (enableElasticLogOperation) {
                this.logger.info(JSON.stringify(payload), CATEGORY)
                const obj = OperationLog.create(operation, JSON.stringify(payload))
                await this.repository.save(obj)
            }
        } catch (error) {
            this.logger.error("Error when logging elastic operation to queue", CATEGORY)
            this.logger.error(JSON.stringify(error), CATEGORY)
            //todo MT-3890
        }
    }

    async getAll(): Promise<OperationLog[]> {
        return this.repository.getAll()
    }

    async purgeAll(): Promise<void> {
        const numberOfDeletedItems = await this.repository.purgeAll()
        this.logger.info(`Deleted ${numberOfDeletedItems} operation logs.`, CATEGORY)
    }   
}


export class OperationLogServiceFactory {
    constructor(private readonly collectionConfig: CollectionConfig) { }

    build(featureFlagService: IFeatureFlagService, logger: Logger): OperationLogService {
        const factory = new OperationLogRepositoryFactory(this.collectionConfig, logger)
        const repo = factory.build(logger)
        return new OperationLogService(repo, featureFlagService, logger)
    }
}
