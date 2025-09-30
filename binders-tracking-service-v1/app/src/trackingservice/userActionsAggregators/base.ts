import {
    AggregationResult,
    AggregatorType,
    EventType,
    EventsInRangeResult,
    IEventFilter,
    IUserAction
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Aggregation } from "../models/aggregation";
import { IUserActionsRepository } from "../repositories/userActionsRepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MongoAggregationsRepository } from "../repositories/aggregationsRepository";
import { TrackingService } from "../service";
import moment from "moment";

/**
    New Aggregators should extend the {@link UserActionsAggregator} base class and implement {@link IUserActionsAggregator}.
    This base class provides the skeleton for the aggregator, and also defines an <code>eventCountLimit</code>.
    It is important that aggregators take this limit into account when searching for events
    (preferably by using the {@link findEventsInRange} method)
    The {@link AggregationResult} produced by the aggregate method should also include a lastEventTimestamp</code>.
    This is then used in the save method to save the aggregated range, so the next aggregation can take it from there

    more info: https://bindersmedia.atlassian.net/wiki/spaces/SD/pages/37486593/Account+analytics
*/
export interface IUserActionsAggregator {
    aggregatorType: AggregatorType;
    accountId: string;
    aggregate: () => Promise<AggregationResult>;
    run: () => Promise<AggregationResult>;
    save: (aggregationResult: AggregationResult) => Promise<void>;
}

const DEFAULT_EVENT_COUNT_LIMIT = 50000;

export abstract class UserActionsAggregator implements IUserActionsAggregator {
    static eventTypes: EventType[];
    aggregatorType: AggregatorType;

    constructor(
        public readonly userActionsRepository: IUserActionsRepository,
        public readonly aggregationsRepository: MongoAggregationsRepository,
        public readonly aggregationType: "full" | "individual",
        public readonly trackingService: TrackingService,
        public readonly accountId: string,
        public readonly eventFilter: IEventFilter = {},
        protected readonly logger: Logger,
        public readonly eventCountLimit = DEFAULT_EVENT_COUNT_LIMIT,
    ) {
    }

    aggregate: () => Promise<AggregationResult>;

    findEventsInRange = async (
        accountId: string,
        eventFilter: IEventFilter, // contains range
    ): Promise<EventsInRangeResult> => {
        const events = await this.trackingService.findEventsInRange(
            accountId,
            eventFilter,
            { maxResults: this.eventCountLimit }
        );
        const lastEventTimestamp = [...events].pop()?.timestamp;
        return {
            events,
            lastEventTimestamp,
        };
    }

    run = async (): Promise<AggregationResult> => {
        const aggregationResult = await this.aggregate();
        const {
            toAdd = [],
            toComplete = [],
        } = aggregationResult;
        aggregationResult.rangeUsed = this.eventFilter.range;
        this.logger.info(`Aggregator of type ${this.aggregatorType} generated ${toAdd.length} userActions to add, ${toComplete} to complete.`, "aggregations");
        await this.insertUserActions(toAdd);
        await this.updateIncompleteUserActions(toComplete);
        await this.save(aggregationResult);
        return aggregationResult;
    }

    async save(aggregationResult: AggregationResult): Promise<void> {
        const origRangeEndMoment = moment(this.eventFilter.range.rangeEnd);
        const lastProcessedEventMoment = moment(new Date(aggregationResult.lastEventTimestamp)); // this is the timestamp

        let rangeEnd = origRangeEndMoment.toDate();

        if (lastProcessedEventMoment.isBefore(origRangeEndMoment)) {
            rangeEnd = lastProcessedEventMoment.toDate();
        }
        await this.aggregationsRepository.saveAggregation(new Aggregation(
            this.aggregatorType,
            new Date(),
            this.accountId,
            {
                rangeStart: this.eventFilter.range.rangeStart,
                rangeEnd,
                aggregationType: this.aggregationType,
            },
        ));
    }

    async insertUserActions(userActions: IUserAction[]): Promise<void> {
        if (userActions.length > 0) {
            await this.userActionsRepository.multiInsertUserAction(userActions);
        }
    }

    async updateIncompleteUserActions(userActions: IUserAction[]): Promise<void> {
        if (userActions.length > 0) {
            await this.userActionsRepository.multiUpdateUserAction(userActions);
        }
    }
}
