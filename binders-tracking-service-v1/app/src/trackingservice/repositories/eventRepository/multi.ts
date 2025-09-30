import {
    BatchProcessSearchOptions,
    EventRepository,
    EventsByDocumentId,
    MigrationPhase,
    MultiTrackingRepositoryFactory,
    TimeRange
} from ".";
import {
    Event as ClientEvent,
    IEventFilter,
    ILanguageStatistics,
    SearchOptions,
    getAllDocumentEvents
} from  "@binders/client/lib/clients/trackingservice/v1/contract";
import { Event, IEventDAO } from "../../models/event";
import { splitEvery, sum } from "ramda";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Query } from "@binders/binders-service-common/lib/mongo/repository";
import { subWeeks } from "date-fns";

type RepoOperation<T> = (repo: EventRepository) => Promise<T>;

type ReadWrite = "read" | "write";
type ResultCombinator<T> = (ts: T[]) => T;

function defaultCombine<T>(ts: T[][]): T[] {
    return ts.flat(1);
}

function pickFirst<T>(ts: T[]) {
    return ts[0];
}

function combineLanguageStatistics(statsArray: ILanguageStatistics[][]): ILanguageStatistics[] {
    const byLanguage: { [languageCode: string]: ILanguageStatistics } = {};
    for (const stats of statsArray) {
        for (const stat of stats) {
            const key = `${stat.languageCode}-${!!stat.isMachineTranslation}`;
            if (!(key in byLanguage)) {
                byLanguage[key] = stat;
            } else {
                byLanguage[key] = {
                    ...byLanguage[key],
                    amount: byLanguage[key].amount + stat.amount
                };
            }
        }
    }
    return Object.values(byLanguage);
}

function pickLatestEvents(limit: number): (events: Event[][]) => Event[] {
    return (events: Event[][]) => {
        const allEvents = defaultCombine(events);
        allEvents.sort((l, r) => r.timestamp.getTime() - l.timestamp.getTime());
        return allEvents.slice(0, limit);
    }
}

type DispatchOptions<T> = {
    rw: ReadWrite;
    timeRange?: TimeRange;
    combinator: ResultCombinator<T>;
    sequential?: boolean;
}


function timeRangeFromFilter(filter: IEventFilter): TimeRange | undefined {
    if (!filter.range) {
        return undefined;
    }
    return {
        start: filter.range.rangeStart,
        end: filter.range.rangeEnd
    };
}

function defaultWriteOptions<T>(): DispatchOptions<T> {
    return {
        rw: "write",
        combinator: d => pickFirst<T>(d)
    }
}

function mergeClientEvents(options?: SearchOptions): (events: ClientEvent[][]) => ClientEvent[] {
    return (events: ClientEvent[][]) => {
        const combinedEvents = defaultCombine(events);
        if (options && options.orderBy) {
            const cmp = options.sortOrder === "ascending" ?
                (a, b) => a.timestamp - b.timestamp :
                (a, b) => b.timestamp - a.timestamp;
            combinedEvents.sort(cmp);
        }
        return combinedEvents;
    }
}

const MAX_CONCURRENT_QUERIES = 5;

export class EventRepositoryMultipleCollections implements EventRepository {

    constructor(private logger: Logger, private factory: MultiTrackingRepositoryFactory) {
    }


    private getMonolith() {
        return this.factory.getMonolith(this.logger);
    }

    private getLatestCollectionRepo() {
        return this.factory.getCurrent(this.logger);
    }

    private getSingleCollectionRepos(timeRange?: TimeRange) {
        return this.factory.getByTimeRange(this.logger, timeRange);
    }

    private async selectRepos(rw: ReadWrite, timeRange?: TimeRange): Promise<EventRepository[]> {
        if (rw === "read") {
            if (this.factory.migrationPhase === MigrationPhase.BACK_FILLING_MULTI_COLLECTIONS) {
                return [await this.getMonolith()];
            } else {
                return this.getSingleCollectionRepos(timeRange);
            }
        } else {
            if (this.factory.migrationPhase === MigrationPhase.BACK_FILLING_MULTI_COLLECTIONS) {
                return [await this.getMonolith(), await this.getLatestCollectionRepo()];
            } else {
                return [await this.getLatestCollectionRepo()];
            }
        }
    }

    private async dispatch<T>(op: RepoOperation<T>, options: DispatchOptions<T>): Promise<T> {
        const repos = await this.selectRepos(options.rw, options.timeRange);
        const results: T[] = [];
        if (!options.sequential) {
            const splitRepos = splitEvery(MAX_CONCURRENT_QUERIES, repos);
            for (let i = 0; i < splitRepos.length; i++) {
                const newResults = await Promise.all<T>(splitRepos[i].map(op));
                for (let j = 0; j < newResults.length; j++) {
                    results.push(newResults[j]);
                }
            }
        } else {
            for (let i = 0; i < repos.length; i++) {
                this.logger.info(`Processing repo ${i + 1} / ${repos.length}`, "multi-event-serial-dispatch");
                const result = await (op(repos[i]));
                results.push(result);
            }
        }
        return options.combinator(results);
    }

    logEvent(event: Event): Promise<Event> {
        return this.dispatch(r => r.logEvent(event), defaultWriteOptions<Event>());
    }

    logEvents(events: Event[], inclId?: boolean): Promise<string[]> {
        return this.dispatch(r => r.logEvents(events, inclId), defaultWriteOptions<string[]>());
    }

    /*
        This method looks for events in parallel, in the single event collections, and combines them with given combinator
    */
    findEvents(accountId: string, eventFilter: IEventFilter, options?: SearchOptions): Promise<ClientEvent[]> {
        const dispatchOptions: DispatchOptions<ClientEvent[]> = {
            rw: "read",
            combinator: mergeClientEvents(options),
        }
        return this.dispatch(r => r.findEvents(accountId, eventFilter, options), dispatchOptions);
    }

    /*
        Using the range in eventFilter, this method identifies the single collections to search in, then find events serially.
        This is useful when there's a maxResuls defined (useraction aggregator context)
    */
    async findEventsInRange(
        accountId: string,
        eventFilter: IEventFilter,
        options?: SearchOptions,
    ): Promise<ClientEvent[]> {
        if (!(eventFilter.range)) {
            throw new Error("No range specified in findEventsInRange");
        }
        const singleRepos = await this.getSingleCollectionRepos({
            start: eventFilter.range.rangeStart,
            end: eventFilter.range.rangeEnd
        });
        const events: ClientEvent[] = [];
        for (const repo of singleRepos) {
            const eventsInSingleRepo = await repo.findEvents(accountId, eventFilter, options);
            events.push(...eventsInSingleRepo);
            if (options?.maxResults && events.length >= options.maxResults) {
                break;
            }
        }
        if (options?.maxResults) {
            events.splice(options.maxResults);
        }
        return events;
    }

    languages(collectionId: string, filter: IEventFilter): Promise<ILanguageStatistics[]> {
        const options: DispatchOptions<ILanguageStatistics[]> = {
            rw: "read",
            combinator: combineLanguageStatistics,
            timeRange: timeRangeFromFilter(filter)
        };
        return this.dispatch(r => r.languages(collectionId, filter), options);
    }

    async documentEventsInRange(
        accountId: string,
        documentIds: string[],
        eventFilter: IEventFilter,
        searchOptions?: SearchOptions,
    ): Promise<EventsByDocumentId> {
        eventFilter.documentIds = documentIds;
        eventFilter.eventTypes = getAllDocumentEvents();
        const docEvents = await this.findEventsInRange(accountId, eventFilter, searchOptions);

        return docEvents.reduce((acc, clientEvent) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = Event.fromClientEvent(clientEvent);

            const documentId = event.data["documentId"] as string;
            const binderId = event.data["binderId"];
            if (!binderId) {
                // no binderId found in the document event means the documentId will likely be the binder id instead of the publication id
                // this was happening pre - may 20 2019 for /preview reader routes
                // -> skip these events. We're not deleting them from mongodb just in case it turns out we're also skipping important other events by disregarding them
                return acc;
            }
            const events = acc.get(documentId) || [];
            events.push(event);
            acc.set(documentId, events);
            return acc;
        }, new Map<string, Event[]>());
    }

    countEvents(eventFilter: IEventFilter): Promise<number> {
        const options: DispatchOptions<number> = {
            rw: "read",
            combinator: sum,
            timeRange: timeRangeFromFilter(eventFilter)
        };
        return this.dispatch(r => r.countEvents(eventFilter), options);
    }

    async getLatestEvents(limit: number): Promise<Event[]> {
        if (limit > 1) {
            throw new Error("Method not implemented (should not be in use).");
        }
        const timeRange: TimeRange = {
            start: subWeeks(Date.now(), 1)
        };
        const options: DispatchOptions<Event[]> = {
            rw: "read",
            combinator: pickLatestEvents(limit),
            timeRange
        }
        return this.dispatch(r => r.getLatestEvents(1), options);
    }

    getFirstEvents(_limit: number): Promise<Event[]> {
        throw new Error("Method not implemented (should not be in use).");
    }

    async batchProcessEvents(eventFilter: IEventFilter, processEvent: (eventDaos: IEventDAO[], i: number) => Promise<void>, searchOptions: BatchProcessSearchOptions): Promise<void> {
        const options: DispatchOptions<void> = {
            rw: "read",
            combinator: pickFirst,
            timeRange: timeRangeFromFilter(eventFilter),
            sequential: searchOptions.sequential
        };
        await this.dispatch(
            r => r.batchProcessEvents(eventFilter, processEvent, searchOptions),
            options
        );
    }

    async bulkUpdate(query: Query, updateObj: Record<string, string>): Promise<number> {
        const options: DispatchOptions<number> = {
            rw: "read",
            combinator: sum,
            timeRange: undefined
        }
        return this.dispatch(
            r => r.bulkUpdate(query, updateObj),
            options
        );
    }

    deleteEvents(query: Query): Promise<number> {
        const options: DispatchOptions<number> = {
            rw: "read", // Counterintuitive, but we need to specify read or we just get the latest shard
            combinator: sum,
            timeRange: undefined
        }
        return this.dispatch(r => r.deleteEvents(query), options);
    }
}