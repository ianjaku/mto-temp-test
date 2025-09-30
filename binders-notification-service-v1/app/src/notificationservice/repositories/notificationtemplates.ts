import * as mongoose from "mongoose";
import {
    CustomNotification,
    RelativeDate
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from  "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { NotificationTemplate } from "./models/notificationtemplate";
import {
    NotificationTemplateIdentifier
} from  "@binders/binders-service-common/lib/authentication/identity";


export interface INotificationTemplateDocument extends mongoose.Document {
    templateId: string;
    accountId: string;
    templateData: Partial<CustomNotification>;
    templateName: string;
    scheduledDate?: Date | RelativeDate;
    scheduledTime?: Date;
}

function daoToModel(dao: INotificationTemplateDocument): NotificationTemplate {
    return new NotificationTemplate(
        new NotificationTemplateIdentifier(dao.templateId),
        dao.accountId,
        dao.templateData,
        dao.templateName,
        dao.scheduledDate,
        dao.scheduledTime
    );
}

function modelToDao(model: NotificationTemplate): INotificationTemplateDocument {
    return <INotificationTemplateDocument>{
        templateId: model.templateId.value(),
        accountId: model.accountId,
        templateData: model.templateData,
        templateName: model.templateName,
        scheduledDate: model.scheduledDate,
        scheduledTime: model.scheduledTime
    };
}

function getSchema(collectionName: string) {
    const schema = new mongoose.Schema({
        templateId: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        },
        templateData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        templateName: {
            type: String,
            required: true
        },
        scheduledDate: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        scheduledTime: {
            type: Date,
            default: null
        },
        created: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
    return schema;
}

export interface INotificationTemplateRepository {
    insert(tmpl: NotificationTemplate): Promise<NotificationTemplate>;
    delete(id: string): Promise<void>;
    allTemplatesForAccount(accountId: string): Promise<NotificationTemplate[]>;
}

export class NotificationTemplateRepository
    extends MongoRepository<INotificationTemplateDocument>
    implements INotificationTemplateRepository {

    async delete(templateId: string): Promise<void> {
        await this.deleteEntity({ templateId });
    }

    async insert(model: NotificationTemplate): Promise<NotificationTemplate> {
        const dao = modelToDao(model);
        const result = await this.insertEntity(dao);
        return daoToModel(result);
    }

    async allTemplatesForAccount(accountId: string): Promise<NotificationTemplate[]> {
        const daos = await this.findEntities({
            accountId
        });
        return daos.map(daoToModel);
    }

}

export class NotificationTemplateRepositoryFactory
    extends MongoRepositoryFactory<INotificationTemplateDocument> {

    build(logger: Logger): NotificationTemplateRepository {
        return new NotificationTemplateRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({
            accountId: 1,
        });
        schema.index({ templateId: 1 }, { unique: true });
        this.model = this.collection.connection.model<INotificationTemplateDocument> (
            "NotificationTemplatesDAO",
            schema
        );
    }
}
