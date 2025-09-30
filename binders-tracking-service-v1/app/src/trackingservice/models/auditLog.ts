import * as mongoose from "mongoose";
import { AccountIdentifier, UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { AuditLogData, AuditLogType } from "@binders/client/lib/clients/trackingservice/v1/contract";

export const MONGOOSE_SCHEMA = {
    userId: {
        type: String,
        required: false
    },
    accountId: {
        type: String,
        required: false
    },
    logType: {
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
    userAgent: {
        type: {
            string: {
                type: String,
                required: false,
            },
            isMobile: {
                type: Boolean,
                required: false,
                default: false,
            },
            browser: {
                type: String,
                required: false,
            },
            browserVersion: {
                type: {
                    major: String,
                    minor: String,
                    patch: String,
                },
                default: {
                    major: "0",
                    minor: "0",
                    patch: "0",
                }
            },
            os: {
                type: String,
                required: false,
            },
            device: {
                type: String,
                required: false,
            },
            deviceVersion: {
                type: String,
                required: false,
            },
        },
        required: true,
    },
    ip: String,
    data: {
        type: Object,
        required: false
    },
};

export interface IAuditLog {
    userId?: UserIdentifier;
    accountId?: AccountIdentifier;
    logType: AuditLogType;
    timestamp: Date;
    timestampLogged?: Date;
    userAgent?: {
        string?: string;
        isMobile?: boolean;
        browser?: string;
        browserVersion?: {
            major?: string;
            minor?: string;
            patch?: string;
        };
        os?: string;
        device?: string;
        deviceVersion?: string;
    };
    ip?: string;
    data?: AuditLogData;
}

export interface IAuditLogDAO extends mongoose.Document {
    _id: string;
    logType: number;
    userId?: string;
    accountId: string;
    timestamp: Date;
    timestampLogged?: Date;
    userAgent: {
        string?: string;
        isMobile?: boolean;
        browser?: string;
        browserVersion?: {
            major?: string;
            minor?: string;
            patch?: string;
        }
        os?: string;
        device?: string;
        deviceVersion?: string;
    };
    ip?: string;
    data?: AuditLogData;
}

export class AuditLog<T = AuditLogData> implements IAuditLog {
    id?: string;
    userId?: UserIdentifier;
    accountId?: AccountIdentifier;

    constructor(
        readonly logType: AuditLogType,
        readonly timestamp: Date,
        readonly timestampLogged: Date,
        // eslint-disable-next-line @typescript-eslint/ban-types
        readonly userAgent?: object,
        readonly ip?: string,
        readonly data?: T,
        accountId?: string,
        userId?: string,
        id?: string,
    ) {
        this.id = id;
        this.userId = userId && new UserIdentifier(userId);
        this.accountId = accountId && new AccountIdentifier(accountId);
    }

    static parse(dao: IAuditLogDAO): AuditLog {
        return new AuditLog(
            dao.logType,
            new Date(dao.timestamp),
            new Date(dao.timestampLogged),
            dao.userAgent,
            dao.ip,
            dao.data,
            dao.accountId,
            dao.userId,
            dao._id,
        );
    }

    static fromDAO(dao: IAuditLogDAO): AuditLog {
        return new AuditLog(
            dao.logType,
            dao.timestamp,
            dao.timestampLogged,
            dao.userAgent,
            dao.ip,
            dao.data,
            dao.accountId,
            dao.userId,
            dao.id
        );
    }

    toDAO(): IAuditLogDAO {
        const daoObj = <IAuditLogDAO> {
            logType: this.logType,
            timestamp: this.timestamp,
            timestampLogged: this.timestampLogged,
            userAgent: this.userAgent,
            ip: this.ip,
        };

        if (this.userId) {
            daoObj.userId = this.userId.value();
        }

        if (this.accountId) {
            daoObj.accountId = this.accountId.value();
        }

        if (this.data) {
            daoObj.data = this.data;
        }

        return daoObj;
    }

}