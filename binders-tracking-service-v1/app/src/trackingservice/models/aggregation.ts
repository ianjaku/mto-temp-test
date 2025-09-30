/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mongoose from "mongoose";
import { IIdRangeFilter, IRangeFilter } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AggregatorType } from "@binders/client/lib/clients/trackingservice/v1/contract";

export const MONGOOSE_SCHEMA = {
    userActionType: { // @TODO: remove after "happy new year release" is live
        type: Number,
    },
    aggregatorType: {
        type: Number,
        // required: true, // @TODO: uncomment after "happy new year release" is live
    },
    timestamp: {
        type: Date,
        required: true,
    },
    accountId: {
        type: String,
        required: true,
    },
    data: {
        rangeStart: {
            type:Date,
            required: true,
        },
        rangeEnd: {
            type: Date,
            required: true,
        },
        aggregationType: {
            type: String,
            required: true,
        },
    },
};

export interface IAggregationFilter {
    accountIds?: string[];
    aggregatorTypes?: AggregatorType[];
    range?: IRangeFilter;
    idRange?: IIdRangeFilter;
}

export interface IAggregationData {
    rangeStart: Date;
    rangeEnd: Date;
    aggregationType: "full" | "individual";
}

export interface IAggregation {
    aggregatorType: AggregatorType;
    timestamp: Date;
    data: IAggregationData;
    accountId: string;
}

export interface IAggregationDAO extends mongoose.Document {
    _id: string;
    accountId: string;
    userActionType: number; // @TODO: remove after "happy new year release" is live
    aggregatorType: number;
    timestamp: Date;
    data: IAggregationData;
}

export class Aggregation implements IAggregation {
    private id?: string;

    constructor(
        readonly aggregatorType: AggregatorType, 
        readonly timestamp: Date, 
        readonly accountId: string,
        readonly data: IAggregationData,
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        id?: any,
    ) {
        this.id = id;
    }

    static parse(dao: IAggregationDAO): Aggregation {
        return new Aggregation(
            dao.aggregatorType, 
            new Date(dao.timestamp), 
            dao.accountId, 
            dao.data,
            dao._id,
        );
    }

    toDAO(): IAggregationDAO {
        const daoObj = <IAggregationDAO>{
            aggregatorType: this.aggregatorType,
            timestamp: this.timestamp,
            accountId: this.accountId,
            data: this.data,
        };

        return daoObj;
    }

}