import {
    Event as ClientEvent,
    EventType,
    IEventFilter,
    ILanguageStatistics,
    SearchOptions
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Event, IEventDAO } from "../../models/event";
import { EventRepository, EventsByDocumentId } from ".";
import { MongoRepository, Query } from "@binders/binders-service-common/lib/mongo/repository";
import { applyRange, queryFromEventFilter, queryFromEventFilterAndAccount } from "../builder";
import { BatchProcessSearchOptions } from ".";
import { mapSearchOptions } from "../shared";

export class MongoEventRepositorySingleCollection extends MongoRepository<IEventDAO> implements EventRepository {

    async batchProcessEvents(eventFilter: IEventFilter, doWork: (eventDaos: IEventDAO[], i: number) => Promise<void>, searchOptions: BatchProcessSearchOptions): Promise<void> {
        const query = queryFromEventFilter(eventFilter);
        await this.batchProcess(query, doWork, { batchSize: 2500, searchOptions });
    }

    async countEvents(eventFilter: IEventFilter): Promise<number> {
        const query = queryFromEventFilter(eventFilter);
        return this.model.countDocuments(query).setOptions({ sanitizeFilter: true });
    }

    async getLatestEvents(limit: number): Promise<Event[]> {
        const eventDAOs = await this.model.find({}).setOptions({ sanitizeFilter: true }).sort({ _id: -1 }).limit(limit);
        return eventDAOs.map(e => Event.parse(e));
    }

    async getFirstEvents(limit: number): Promise<Event[]> {
        const eventDAOs = await this.model.find({}).setOptions({ sanitizeFilter: true }).sort({ _id: 1 }).limit(limit);
        return eventDAOs.map(e => Event.parse(e));
    }

    logEvent(event: Event): Promise<Event> {
        return this.insertEntity(event.toDAO()).then(Event.parse);
    }

    async logEvents(events: Event[], inclId = false): Promise<string[]> {
        try {
            const insertedDAOs = await this.insertMany(events.map(event => event.toDAO(inclId)), { ordered: false });
            return insertedDAOs.map(dao => dao._id);
        }
        catch (err) {
            const { code, writeErrors, insertedIds: insertedIdsArr } = err;
            const insertedIds = (insertedIdsArr || []).map(idInfo => idInfo._id);
            if (writeErrors && writeErrors.length) {
                if (writeErrors.some(writeError => writeError.code !== 11000)) {
                    this.logger.error(writeErrors.filter(e => e.code !== 11000).map(e => e.message || e).join(), "stats");
                }
                return insertedIds;
            }
            if (code && code === 11000) {
                return insertedIds;
            }
            this.logger.error(err.message || err, "stats");
            return insertedIds;
        }
    }

    async findEventsInRange(): Promise<ClientEvent[]> {
        // Not implemented - handled in multi
        return [];
    }

    async findEvents(accountId: string, eventFilter: IEventFilter, options: SearchOptions = {}): Promise<ClientEvent[]> {
        const query = queryFromEventFilterAndAccount(accountId, eventFilter);
        const clientSearchOptions = { orderBy: "timestamp", order: "ascending", ...options }

        const mongoOptions = mapSearchOptions(clientSearchOptions);

        if (eventFilter.aggregateBySession) {
            return this.findEventsGroupsBySessionId(accountId, eventFilter, options);
        }
        try {
            const results = await this.findEntities(query, mongoOptions);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return results.map((result: any) => {
                const {
                    event_type: eventType,
                    user_id: userId,
                    account_id: accountId,
                    data,
                    timestamp,
                    timestampLogged,
                } = result;
                return {
                    userId,
                    accountId,
                    eventType,
                    data,
                    timestamp,
                    timestampLogged,
                }
            });
        }
        catch (err) {
            this.logger?.error(err.message || err, "stats");
            throw err;
        }
    }

    async findEventsGroupsBySessionId(
        accountId: string,
        eventFilter: IEventFilter,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _options: SearchOptions = {}
    ): Promise<ClientEvent[]> {
        const query = queryFromEventFilterAndAccount(accountId, eventFilter);
        try {
            const results = await this.model.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: {
                            sessionId: "$data.sessionId",
                            eventType: "$event_type",
                            accountId: "$account_id",
                            userId: "$user_id",
                            data: "$data",
                        },
                        timestamp: { $min: "$timestamp" },
                        timestampLogged: { $max: "$timestamp" }
                    },
                }
            ])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return results.map((result: any) => {
                const {
                    _id: {
                        eventType,
                        userId,
                        accountId,
                        data,
                    },
                    timestamp,
                    timestampLogged,
                } = result;
                return {
                    userId,
                    accountId,
                    eventType,
                    data,
                    timestamp,
                    timestampLogged,
                }
            });
        }
        catch (err) {
            this.logger?.error(err.message || err, "stats");
            throw err;
        }
    }

    async documentEventsInRange(): Promise<EventsByDocumentId> {
        // Not implemented - handled in multi
        return new Map<string, Event[]>();
    }

    languages(collectionId: string, filter: IEventFilter): Promise<ILanguageStatistics[]> {
        return this.model
            .aggregate([
                {
                    $match: {
                        event_type: EventType.CHOOSE_LANGUAGE,
                        "data.collectionId": collectionId,
                        ...applyRange(filter),
                    }
                },
                {
                    $group: {
                        _id: "$data.language",
                        amount: { $sum: 1 }
                    }
                },
                { $sort: { amount: -1 } }
            ])
            .then(result => {
                return result.map((stat: { _id: string, amount: number }) => (
                    { languageCode: stat._id, amount: stat.amount })
                );
            })
            .catch(err => {
                this.logger.error(err.message || err, "stats");
                throw err;
            });
    }

    deleteEvents(query: Query): Promise<number> {
        return this.deleteMany(query)
    }

    async bulkUpdate(query: Query, updateObj: Record<string, string>): Promise<number> {
        const updateResult = await this.updateMany(query, updateObj);
        return updateResult.updateCount;
    }
}
