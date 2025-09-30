import * as mongoose from "mongoose";

export const MONGOOSE_SCHEMA = {
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        index: true,
    },
    collectionName: {
        type: String,
        required: true
    },
};

export interface IEventRepoMapping {
    start: Date,
    end?: Date;
    collectionName: string;
}
export interface IEventRepoMappingDAO extends mongoose.Document {
    start: Date,
    end?: Date;
    collectionName: string;
}

export class EventRepoMapping implements IEventRepoMapping {
    constructor(readonly collectionName: string, readonly start: Date, readonly end?: Date) {
    }

    static parse(dao: IEventRepoMapping): EventRepoMapping {
        return new EventRepoMapping(dao.collectionName, new Date(dao.start), dao.end && new Date(dao.end));
    }

    toDAO(): IEventRepoMappingDAO {
        return <IEventRepoMappingDAO>{
            start: this.start,
            end: this.end,
            collectionName: this.collectionName,
        };
    }
}

export const getCollectionName = (start: Date): string => `events_${new Date(start).getTime()}`;
