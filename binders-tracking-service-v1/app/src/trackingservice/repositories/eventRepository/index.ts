import * as mongoose from "mongoose";
import {
    Event as ClientEvent,
    IEventFilter,
    ILanguageStatistics,
    SearchOptions
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Event, IEventDAO, MONGOOSE_SCHEMA } from "../../models/event";
import { MongoEventRepoMappingRepository, MongoEventRepoMappingRepositoryFactory } from "../eventRepoMappingRepository";
import { Config } from "@binders/client/lib/config/config";
import { EventRepositoryMultipleCollections } from "./multi";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { MongoEventRepositorySingleCollection } from "./single";
import { SearchOptions as MongoRepoSearchOptions } from "@binders/binders-service-common/lib/mongo/repository";
import { MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";

export interface BatchProcessSearchOptions extends MongoRepoSearchOptions {
    sequential?: boolean;
}

/**
 * A mapping between a document id and its events
 */
export type EventsByDocumentId = Map<string, Event[]>;

export interface EventRepository {
    logEvent(event: Event): Promise<Event>;
    logEvents(events: Event[], inclId?: boolean): Promise<string[]>;

    // exposed via findEvents
    // used by user action aggregations
    findEvents(accountId: string, eventFilter: IEventFilter, options?: SearchOptions): Promise<ClientEvent[]>;

    findEventsInRange(accountId: string, eventFilter: IEventFilter, options?: SearchOptions): Promise<ClientEvent[]>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteEvents(query: any): Promise<number>;

    // exposed via allCollectionStatistics
    // editor-v2: used in collection analytics viewer
    languages(collectionId: string, filter: IEventFilter): Promise<ILanguageStatistics[]>;

    // not exposed
    // used in user action aggregations
    documentEventsInRange(
        accountId: string,
        documentIds: string[],
        filter: IEventFilter,
        options?: SearchOptions,
    ): Promise<EventsByDocumentId>;

    // used in script splitTrackingCollection + rotation + user online.csv
    countEvents(eventFilter: IEventFilter): Promise<number>;
    // used in script splitTrackingCollection + rotation
    getLatestEvents(limit: number): Promise<Event[]>;
    // used in script splitTrackingCollection
    getFirstEvents(limit: number): Promise<Event[]>;
    // used in script splitTrackingCollection + user online.csv
    batchProcessEvents(eventFilter: IEventFilter, processEvent: (eventDaos: IEventDAO[], i: number) => Promise<void>, searchOptions: BatchProcessSearchOptions): Promise<void>;

    // eslint-disable-next-line @typescript-eslint/ban-types
    bulkUpdate(query: Object, updateObj: Record<string, string>): Promise<number>;

}

function getEventSchema(collectionName: string): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

export type TimeRange = {
    start?: Date;
    end?: Date;
}

// Enumeration describing the different migration phases:
// - SINGLE COLLECTION: Here we have a single monolith events collection
// - BACK FILLING: Here we are copying the monolith into multiple smaller collections.
//       Reads occur on the monolith, writes happen on both the monolith and the partials.
// - MULTI: Here we are finished with the migration and use only the partials for both reads and writes
export enum MigrationPhase {
    // Insert into single
    // Read from single
    SINGLE_COLLECTION,
    // Insert into single and multi
    // Read from single
    BACK_FILLING_MULTI_COLLECTIONS,
    // Insert into multi
    // Read from multi
    MULTI_COLLECTIONS
}

const CURRENT_MIGRATION_PHASE = (() => MigrationPhase.MULTI_COLLECTIONS)();

export interface ITrackingRepositoryFactory {
    build(logger: Logger): EventRepository;
}

export class TrackingRepositoryFactory {
    static async fromConfig(config: Config, logger: Logger): Promise<ITrackingRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        const collectionOptions = {
            connectionSettings: {
                timeoutMs: 300000
            }
        };
        if (CURRENT_MIGRATION_PHASE === MigrationPhase.SINGLE_COLLECTION) {
            const eventCollectionConfig = await CollectionConfig.promiseFromConfig(
                config, "tracking", loginOption, collectionOptions
            );
            return new SingleTrackingRepositoryFactory(eventCollectionConfig, logger);
        }
        const eventsRepoMappingRepositoryFactory = await MongoEventRepoMappingRepositoryFactory.fromConfig(config, logger);
        const eventsRepoMappingRepository = eventsRepoMappingRepositoryFactory.build(logger);
        return new MultiTrackingRepositoryFactory(config, eventsRepoMappingRepository, CURRENT_MIGRATION_PHASE);
    }
}

export class MultiTrackingRepositoryFactory implements ITrackingRepositoryFactory {

    private mongoLoginOption: Maybe<string>;
    private repositories: Map<string, MongoEventRepositorySingleCollection>;

    constructor(readonly config: Config, readonly eventsRepoMappingRepository: MongoEventRepoMappingRepository,
        readonly migrationPhase: MigrationPhase) {
        this.mongoLoginOption = getMongoLogin("tracking_service");
        this.repositories = new Map();
    }

    static async getCurrent(config: Config, logger: Logger, eventRepoMappingRepository: MongoEventRepoMappingRepository): Promise<EventRepository> {
        const rf = new MultiTrackingRepositoryFactory(config, eventRepoMappingRepository, CURRENT_MIGRATION_PHASE);
        return rf.getCurrent(logger);
    }

    async getRepositoryByName(name: string, logger: Logger): Promise<EventRepository> {
        logger.info(`getting repository ${name}`, "mongo-connection")
        let repositoriesInMap = "";
        if (this.repositories.has(name)) {
            return this.repositories.get(name);
        }
        let poolCount = 0;
        this.repositories.forEach((_, key: string) => {
            repositoriesInMap += `${key} \n`;
            poolCount++;
        })

        logger.info(`current number of pools: ${poolCount}`, "mongo-connection");
        logger.info(`current repository state ${repositoriesInMap}`, "mongo-connection")
        // logger.info(`Trace: ${new Error().stack}`,"mongo-connection")

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const options = name ? { transformCollectionName: ((_name: string) => name) } : undefined;

        const collectionConfig = await CollectionConfig.promiseFromConfig(
            this.config, "tracking", this.mongoLoginOption, options);
        const factory = new SingleTrackingRepositoryFactory(collectionConfig, logger);
        const repo = factory.build(logger);
        this.repositories.set(name, repo);
        return repo;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new EventRepositoryMultipleCollections(logger, this)
    }

    async getCurrent(logger: Logger): Promise<EventRepository> {
        const currentName = await this.eventsRepoMappingRepository.currentEventsRepo();
        return this.getRepositoryByName(currentName, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async getMonolith(logger: Logger) {
        return this.getRepositoryByName(undefined, logger);
    }

    async getByTimeRange(logger: Logger, timeRange?: TimeRange): Promise<EventRepository[]> {
        const names = await this.getCollectionNames(timeRange);
        return Promise.all(names.map(name => this.getRepositoryByName(name, logger)));
    }

    private async getCollectionNames(timeRange?: TimeRange): Promise<string[]> {
        const start = timeRange && timeRange.start;
        const end = timeRange && timeRange.end;
        return this.eventsRepoMappingRepository.eventReposForTimeRange(start, end);
    }
}

export class SingleTrackingRepositoryFactory extends MongoRepositoryFactory<IEventDAO> implements ITrackingRepositoryFactory {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoEventRepositorySingleCollection(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected updateModel() {
        const schema = getEventSchema(this.collection.name);
        schema.index({ user_id: 1 }, { unique: false });
        schema.index({ event_type: 1 }, { unique: false });
        schema.index({ account_id: 1 });
        schema.index({ account_id: 1, event_type: 1 });
        schema.index({ account_id: 1, event_type: 1, timestampLogged: 1 });
        schema.index({ timestamp: 1, user_id: 1, event_type: 1 }, { unique: true });
        this.model = this.collection.connection.model<IEventDAO>("EventDAO", schema);
    }

}
