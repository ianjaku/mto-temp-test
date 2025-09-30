import * as mongoose from "mongoose";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";


export const MONGOOSE_SCHEMA = {
    time: {
        type: Date,
        required: true
    },
    accountId: {
        type: String,
        required: true
    },
    eventType: {
        type: Number,
        required: true
    }
};


export interface ILastAccountEventMapping {
    time: Date,
    accountId: string;
    eventType: EventType;
}

export interface ILastAccountEventMappingDAO extends mongoose.Document {
    time: Date,
    accountId: string;
    eventType: number;
}


export class LastAccountEventMapping implements ILastAccountEventMapping {
    constructor(readonly time: Date, readonly accountId: string, readonly eventType: EventType) {
    }

    static parse(dao: ILastAccountEventMapping): LastAccountEventMapping {
        return new LastAccountEventMapping(dao.time, dao.accountId, dao.eventType);
    }


    toDAO(): ILastAccountEventMappingDAO {
        const daoObj = <ILastAccountEventMappingDAO>{
            time: this.time,
            accountId: this.accountId,
            eventType: this.eventType,
        };
        return daoObj;
    }
}