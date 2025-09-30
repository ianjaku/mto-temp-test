/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mongoose from "mongoose";
import { Event as ClientEvent, EventPayload, EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export const MONGOOSE_SCHEMA = {
    user_id: {
        type: String,
        required: false
    },
    account_id: {
        type: String,
        required: false
    },
    event_type: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
    },
    timestampLogged: {
        type: Date,
        required: true,
    },
    data: {
        type: Object,
        required: false
    },
    accountId: {
        type: String,
    }
};

export interface IEventDAO extends mongoose.Document {
    _id: string;
    user_id?: string;
    account_id?: string;
    event_type: number;
    timestamp: Date;
    timestampLogged?: Date;
    data?: Record<string, unknown>;
}

export interface IEvent {
    userId?: UserIdentifier;
    eventType: EventType;
    timestamp: Date;
    timestampLogged?: Date;
    data?: Record<string, unknown>;
}

export class Event implements IEvent {
    userId?: UserIdentifier;
    id?: string;

    constructor(
        readonly eventType: EventType,
        readonly timestamp: Date,
        readonly timestampLogged: Date,
        readonly data?: Record<string, unknown>,
        readonly accountId?: string,
        userId?: string,
        id?: string,
    ) {
        this.userId = userId && new UserIdentifier(userId);
        this.id = id;
    }

    static parse(dao: IEventDAO): Event {
        return new Event(dao.event_type, new Date(dao.timestamp), new Date(dao.timestampLogged), dao.data, dao.account_id, dao.user_id, dao._id);
    }

    static parseRequest(request: EventPayload): Event {
        const occurrenceMsDiff = request.occurrenceMsDiff || 0;
        const now = new Date();
        const timestamp = new Date(now.getTime() - occurrenceMsDiff);
        return new Event(request.eventType, timestamp, now, request.data, request.accountId, request.userId);
    }

    static fromClientEvent(event: ClientEvent): Event {
        return new Event(
            event.eventType,
            new Date(event.timestamp),
            new Date(event.timestampLogged),
            event.data,
            event.accountId,
            event.userId,
        );
    }

    toDAO(inclId?: boolean): IEventDAO {
        const daoObj = <IEventDAO>{
            ...(inclId ? { _id: this.id } : {}),
            event_type: this.eventType,
            timestamp: this.timestamp,
            timestampLogged: this.timestampLogged,
        };

        if (this.userId) {
            daoObj.user_id = this.userId.value();
        }

        if (this.accountId) {
            daoObj.account_id = this.accountId;
        }

        if (this.data) {
            daoObj.data = this.data;
        }

        return daoObj;
    }
}
