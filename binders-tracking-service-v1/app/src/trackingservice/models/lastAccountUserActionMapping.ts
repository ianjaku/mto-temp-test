import * as mongoose from "mongoose";

export const MONGOOSE_SCHEMA = {
    accountId: {
        type: String,
        required: true
    },
    readDate: {
        type: Date,
    },
    editDate: {
        type: Date,
    }
};

export interface ILastAccountUserActionsMapping {
    accountId: string;
    readDate?: Date;
    editDate?: Date;
}

export interface ILastAccountUserActionsMappingDAO extends mongoose.Document {
    accountId: string;
    readDate?: Date;
    editDate?: Date;
}

export class LastAccountUserActionsMapping implements ILastAccountUserActionsMapping {

    constructor(readonly accountId: string, readonly readDate?: Date, readonly editDate?: Date) {}

    static parse(dao: ILastAccountUserActionsMappingDAO): LastAccountUserActionsMapping {
        return new LastAccountUserActionsMapping(dao.accountId, dao.readDate, dao.editDate);
    }

    toDao(): ILastAccountUserActionsMappingDAO {
        return <ILastAccountUserActionsMappingDAO>{
            accountId: this.accountId,
            ...this.readDate && { readDate: this.readDate },
            ...this.editDate && { editDate: this.editDate },
        };
    }
}
