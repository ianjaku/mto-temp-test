/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mongoose from "mongoose";

export const MONGOOSE_SCHEMA = {
    timestamp: {
        type: Date,
        required: true,
    },
    accountId: {
        type: String,
        required: true,
    },
    data: {
        languageCodes: {
            type: [String],
            required: true,
        }
    },
};

export interface IMostUsedLanguagesStatData {
    languageCodes: string[],
}

export interface IMostUsedLanguagesStat {
    timestamp: Date;
    data: IMostUsedLanguagesStatData;
    accountId: string;
}

export interface IMostUsedLanguagesStatDAO extends mongoose.Document {
    _id: string;
    accountId: string;
    timestamp: Date;
    data: IMostUsedLanguagesStatData;
}

export class MostUsedLanguagesStat implements IMostUsedLanguagesStat {
    private id?: string;
    constructor(
        readonly accountId: string,
        readonly data: IMostUsedLanguagesStatData,
        readonly timestamp: Date,
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        id?: any,
    ) {
        this.id = id;
    }

    static parse(dao: IMostUsedLanguagesStatDAO): MostUsedLanguagesStat {
        return new MostUsedLanguagesStat(
            dao.accountId,
            dao.data,
            new Date(dao.timestamp),
            dao._id,
        );
    }

    toDAO(): IMostUsedLanguagesStatDAO {
        const daoObj = <IMostUsedLanguagesStatDAO>{
            accountId: this.accountId,
            data: this.data,
            timestamp: this.timestamp,
        };
        return daoObj;
    }

}