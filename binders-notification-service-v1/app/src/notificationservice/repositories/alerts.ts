import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Alert } from "./models/alert";
import { AlertIdentifier, } from "@binders/binders-service-common/lib/authentication/identity";
import { AlertNotFound } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";


export interface IAlertDocument extends mongoose.Document {
    alertId: string;
    message: string;
    adminsOnly: boolean;
    cooldownHours: number;
    startDate: Date;
    endDate: Date;
    accountIds: string[];
    buttonText?: string;
    buttonLink?: string;
}

function daoToModel(dao: IAlertDocument): Alert {
    return new Alert(
        new AlertIdentifier(dao.alertId),
        dao.message,
        dao.adminsOnly,
        dao.cooldownHours,
        dao.startDate,
        dao.endDate,
        dao.accountIds,
        dao.buttonText,
        dao.buttonLink
    );
}

function modelToDao(model: Alert): IAlertDocument {
    return <IAlertDocument>{
        alertId: model.alertId.value(),
        message: model.message,
        adminsOnly: model.adminsOnly,
        cooldownHours: model.cooldownHours,
        startDate: model.startDate,
        endDate: model.endDate,
        accountIds: model.accountIds,
        buttonText: model.buttonText,
        buttonLink: model.buttonLink
    };
}

function getSchema(collectionName: string) {
    const schema = new mongoose.Schema({
        alertId: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        adminsOnly: {
            type: Boolean,
            required: true
        },
        cooldownHours: {
            type: Number,
            required: true
        },
        startDate: {
            type: Date,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        accountIds: {
            type: [String],
            required: true
        },
        buttonText: {
            type: String,
            default: null
        },
        buttonLink: {
            type: String,
            default: null
        }
    }, { collection: collectionName });
    return schema;
}

export interface IAlertRepository {
    insert(alert: Alert): Promise<Alert>;
    put(alert: Alert): Promise<Alert>;
    getActiveAlerts(accountId: string, showAdminonly): Promise<Alert[]>;
    getAllAlerts(): Promise<Alert[]>;
    getAlert(id: AlertIdentifier): Promise<Alert>;
}

export class AlertRepository
    extends MongoRepository<IAlertDocument>
    implements IAlertRepository {

    async getAlert(id: AlertIdentifier): Promise<Alert> {
        return this.fetchOne({
            alertId: id.value(),
        }).then((alertDaoOption) => {
            if (alertDaoOption.isJust()) {
                return daoToModel(alertDaoOption.get());
            } else {
                throw new AlertNotFound(id.value());
            }
        })
    }

    async getActiveAlerts(accountId: string): Promise<Alert[]> {
        const daos = await this.findEntities({
            $and: [
                {
                    $or: [
                        { endDate: mongoose.trusted({ $gt: new Date() }) },
                        { endDate: null }
                    ],
                },
                {
                    $or: [
                        { startDate: mongoose.trusted({ $lte: new Date() }) },
                        { startDate: null }
                    ],
                },
                {
                    $or: [
                        { accountIds: accountId },
                        { accountIds: mongoose.trusted({ $size: 0 }) }
                    ],
                }
            ]
        });
        return daos.map(daoToModel);
    }

    async getAllAlerts(): Promise<Alert[]> {
        const daos = await this.findEntities({});
        return daos.map(daoToModel);
    }

    async put(alert: Alert): Promise<Alert> {
        const dao = modelToDao(alert);
        const result = await this.updateEntity({ alertId: alert.alertId.value() }, dao);
        return daoToModel(result);
    }

    async insert(alert: Alert): Promise<Alert> {
        const dao = modelToDao(alert);
        const result = await this.insertEntity(dao);
        return daoToModel(result);
    }

    async delete(id: AlertIdentifier): Promise<void> {
        if (id == null) return;
        this.deleteEntity({ alertId: id.value() });
    }

}

export class AlertRepositoryFactory
    extends MongoRepositoryFactory<IAlertDocument> {

    build(logger: Logger): AlertRepository {
        return new AlertRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({
            startDate: 1,
        });
        schema.index({
            alertId: 1,
        });
        this.model = this.collection.connection.model<IAlertDocument>(
            "AlertsDAO",
            schema
        );
    }
}
