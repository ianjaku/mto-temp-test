import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    EventRepoMapping,
    IEventRepoMappingDAO,
    MONGOOSE_SCHEMA,
    getCollectionName
} from "../models/eventRepoMapping";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Collection } from "@binders/binders-service-common/lib/mongo/collection";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import moment from "moment";

export interface IEventRepoMappingRepository {
    insertEventRepoMapping(eventRepoMapping: EventRepoMapping): Promise<EventRepoMapping>;
    updateMapping(eventRepoMapping: EventRepoMapping): Promise<EventRepoMapping>;
    completeCurrentEventsRepo(end: Date): Promise<void>;
    completeEventsRepo(collectionName: string, end: Date): Promise<void>;
    currentEventsRepo(): Promise<string>;
    eventReposForTimestamp(timestamp: Date): Promise<string[]>;
}

function getEventRepoMappingSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

const CACHE_TTL_IN_SECONDS = 120;

export class MongoEventRepoMappingRepository extends MongoRepository<IEventRepoMappingDAO> implements IEventRepoMappingRepository {

    private cachedDaos: IEventRepoMappingDAO[];
    private cacheExpires: moment.Moment;

    constructor(model: mongoose.Model<IEventRepoMappingDAO>, collection: Collection, logger: Logger) {
        super(model, collection, logger);
        this.flushCache();
    }


    private flushCache() {
        this.cachedDaos = undefined;
    }

    private async fetchDaos() {
        // Fetch most recent first
        this.logger.info("Fetching repo mapping DAOS from mongo", "repo-mapping");
        this.cachedDaos = await this.findEntities({}, { orderByField: "start", sortOrder: "descending" });
        this.cacheExpires = moment().add(CACHE_TTL_IN_SECONDS, "seconds");
    }

    private isCacheExpired() {
        return moment().isAfter(this.cacheExpires);
    }

    async getDaos(): Promise<EventRepoMapping[]> {
        if (this.cachedDaos === undefined || this.isCacheExpired()) {
            await this.fetchDaos();
        }
        return this.cachedDaos.map(dao => EventRepoMapping.parse(dao));
    }


    async insertEventRepoMapping(eventRepoMapping: EventRepoMapping): Promise<EventRepoMapping> {
        const dao = await this.insertEntity( eventRepoMapping.toDAO());
        this.flushCache();
        return EventRepoMapping.parse(dao);
    }

    async updateMapping(eventRepoMapping: EventRepoMapping): Promise<EventRepoMapping> {
        await this.updateEntity( { collectionName: eventRepoMapping.collectionName }, eventRepoMapping.toDAO());
        this.flushCache();
        return eventRepoMapping;
    }

    async completeCurrentEventsRepo(end: Date): Promise<void> {
        const currentMapping = await this.currentEventsRepo();
        if (currentMapping) {
            await this.completeEventsRepo(currentMapping, end);
        }
    }

    async completeEventsRepo(collectionName: string, end: Date): Promise<void> {
        const matches = await this.findEntities({ collectionName });
        if (matches.length === 0) {
            throw new Error(`Could not find mapping for collection ${collectionName}`);
        }
        if (matches.length > 1) {
            throw new Error(`Found multiple matches for collection ${collectionName}`);
        }
        const toUpdate = matches[0];
        toUpdate.end = end;
        await this.saveEntity({collectionName}, toUpdate);
        this.flushCache();
    }

    async eventReposForTimestamp(timestamp: Date): Promise<string[]> {
        const epoch = timestamp.getTime();
        return (await this.getDaos())
            .filter( dao => ((dao.start.getTime() < epoch) && (!dao.end || dao.end.getTime() < epoch)))
            .map(dao => dao.collectionName);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async getCurrentEventsMapping() {
        const daos = await this.getDaos();
        return daos.length && daos[0];
    }

    async currentEventsRepo(): Promise<string> {
        const currentMapping = await this.getCurrentEventsMapping();
        return currentMapping && currentMapping.collectionName;
    }

    /**
    |  0  |  1  |  2  |  3  |  4
    ------------------------------
    |     |     |     |     |
    |     |   BxxxxxxxxxxE  |
    |     |     |     |     |


    This method needs to return event-repo-ranges 1, 2 and 3.
    (B for Begin and E for End of requested time range)
    (Bi and Ei for begin and end of the event-repo-range i)
    - Range 1 matches because: B > B1 && B < E1 (see overlapAtBeginOfRange)
    - Range 2 matches because: B < B2 && E > E2 (see fullOverlap)
    - Range 3 matches because: E > B3 && E < E3 (see overlapAtEnd)
*/
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async eventReposForTimeRange(start?: Date, end?: Date) {
        const beginRange = (start && start.getTime()) || 0;
        const now = new Date().getTime();
        const endRange = (end && end.getTime()) || now;
        return (await this.getDaos())
            .filter(dao => {
                const daoBegin = dao.start.getTime();
                const daoEnd = (dao.end && dao.end.getTime()) || now;
                const overlapAtBeginOfRange = (beginRange > daoBegin) && (beginRange < daoEnd);
                const fullOverlap = (beginRange < daoBegin) && (endRange >= daoEnd);
                const overlapAtEnd = (endRange > daoBegin) && (endRange <= daoEnd);
                return overlapAtBeginOfRange || fullOverlap || overlapAtEnd;
            })
            .sort((dao1, dao2) => dao1.start.getTime() - dao2.start.getTime())
            .map(dao => dao.collectionName)

    }
}

const sleep = (timeToSleepInMs) => new Promise(resolve => setTimeout(resolve, timeToSleepInMs));

const makeSureWereAlone = async (repo: MongoEventRepoMappingRepository): Promise<boolean> => {
    const timeToSleep = 60 * 1000 * Math.random();
    await sleep(timeToSleep);
    return !(await repo.getCurrentEventsMapping());
}

export const ensurePartialEventsCollection = async (config: Config, logger: Logger): Promise<void> => {
    const factory = await MongoEventRepoMappingRepositoryFactory.fromConfig(config, logger);
    const repo = factory.build(logger);
    const current = await repo.getCurrentEventsMapping();
    if (!current) {
        logger.info("Prepare for first mapping creation", "event-mapping-setup");
        // We have 5 services running and initially there is no mapping yet
        // We need to make sure we only insert one mapping
        const areWeFirst = await makeSureWereAlone(repo);
        if (!areWeFirst) {
            logger.info("Someone beat us to it", "event-mapping-setup");
            factory.getConnection().close();
            return;
        }
        logger.info("Creating first mapping", "event-mapping-setup");
        const start = moment().subtract(1, "h").toDate();
        const collectionName = getCollectionName(start)
        const mapping = new EventRepoMapping(collectionName, start);
        await repo.insertEventRepoMapping(mapping);
        logger.info("Created first mapping", "event-mapping-setup");
    }
    factory.getConnection().close();
}

export class MongoEventRepoMappingRepositoryFactory extends MongoRepositoryFactory<IEventRepoMappingDAO> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoEventRepoMappingRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected updateModel() {
        const schema = getEventRepoMappingSchema(this.collection.name);
        schema.index({ start: 1, end: 1 }, { unique: false });
        this.model = this.collection.connection.model<IEventRepoMappingDAO>("EventRepoMappingDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoEventRepoMappingRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        return CollectionConfig.fromConfig(config, "eventRepoMapping", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoEventRepoMappingRepositoryFactory(collectionConfig, logger));
    }
}
