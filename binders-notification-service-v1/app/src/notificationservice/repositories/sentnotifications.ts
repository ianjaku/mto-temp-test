import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    NotificationKind,
    NotifierKind,
    SentNotification,
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";


export interface ISentNotificationDao {
    accountId: string;
    kind: NotificationKind;
    messageData: SentNotification["messageData"];
    sentAt: Date;
    sentToNotifier: NotifierKind;
    /** @depricated use sentToIds instead */
    sentToId: string;
    sentToIds: string[];
    // An object with the itemId, actorId, ... when applicable (depends on the kind)
    notificationMetadata: unknown;
    // Template variables filled into the messageData example: "[[actor]]" + { actor: "John Doe" } = "John Doe"
    templateVariables?: {
        [userId: string]: {
            [variableName: string]: string
        }
    };
}

export interface ISentNotificationDocument extends mongoose.Document, ISentNotificationDao { }

export function daoToDto(dao: ISentNotificationDao): SentNotification {
    return {
        accountId: dao.accountId,
        kind: dao.kind,
        messageData: dao.messageData,
        sentAt: dao.sentAt,
        sentToNotifier: dao.sentToNotifier,
        sentToId: dao.sentToId,
        sentToIds: dao.sentToIds,
        notificationMetadata: dao.notificationMetadata
    }
}

export function documentToDao(document: ISentNotificationDocument): ISentNotificationDao {
    return {
        accountId: document.accountId,
        kind: document.kind,
        messageData: document.messageData,
        sentAt: document.sentAt,
        sentToNotifier: document.sentToNotifier,
        sentToId: document.sentToId,
        sentToIds: document.sentToIds,
        notificationMetadata: document.notificationMetadata,
        templateVariables: document.templateVariables
    }
}

function getSchema(collectionName: string) {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        kind: {
            type: String,
            required: true
        },
        messageData: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        sentAt: {
            type: Date,
            required: true
        },
        sentToNotifier: {
            type: String,
            required: true
        },
        sentToId: {
            type: String,
        },
        sentToIds: {
            type: [String],
            required: true
        },
        templateVariables: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        notificationMetadata: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        }
    }, { collection: collectionName });
    return schema;
}

export interface ISentNotificationRepository {
    insert(sentNotification: SentNotification): Promise<SentNotification>;
    find(
        accountId: string,
        itemIds: string[]
    ): Promise<SentNotification[]>;
    deleteAllForAccount(accountId: string): Promise<void>;
}

export class SentNotificationRepository
    extends MongoRepository<ISentNotificationDocument>
    implements ISentNotificationRepository {

    async find(
        accountId: string,
        itemIds: string[]
    ): Promise<SentNotification[]> {
        const documents = await this.findEntities({
            accountId,
            "notificationMetadata.itemId": mongoose.trusted({
                $in: itemIds.map(String)
            })
        }, { orderByField: "sentAt", sortOrder: "descending", limit: 1000 });

        let daos = documents.map(documentToDao);
        daos = this.splitSentNotificationsWithMultipleSentToIds(daos);
        return daos.map(dao => {
            const daoWithVariables = this.applyTemplateVariables(dao)
            return daoToDto(daoWithVariables);
        });
    }

    private splitSentNotificationsWithMultipleSentToIds(
        sentNotifications: ISentNotificationDao[]
    ): ISentNotificationDao[] {
        return sentNotifications.map<ISentNotificationDao | ISentNotificationDao[]>(sentNotification => {
            if (!sentNotification.sentToIds) {
                return {
                    ...sentNotification,
                    sentToIds: [sentNotification.sentToId]
                };
            }
            if (sentNotification.sentToIds.length === 0) {
                return {
                    ...sentNotification,
                    sentToIds: [sentNotification.sentToId]
                };
            }
            if (sentNotification.sentToIds.length === 1) {
                return {
                    ...sentNotification,
                    sentToId: sentNotification.sentToIds[0]
                };
            }
            return sentNotification.sentToIds.map<ISentNotificationDao>(sentToId => ({
                ...sentNotification,
                sentToId,
                sentToIds: [sentToId]
            }));
        }).flat();
    }

    /**
     * Expects sentToIds to always have a length of 1
     */
    private applyTemplateVariables(sentNotification: ISentNotificationDao): ISentNotificationDao {
        if (sentNotification.templateVariables == null) return sentNotification;
        if (typeof sentNotification.messageData !== "object") return sentNotification;
        if (sentNotification.sentToIds.length !== 1) {
            throw new Error(`Expected sentToIds to have a length of 1, but got ${sentNotification.sentToIds.length}`);
        }

        const templateVariablesForUser = sentNotification.templateVariables[sentNotification.sentToIds[0]];
        if (templateVariablesForUser == null) return sentNotification;

        const newMessageData = Object.keys(sentNotification.messageData).reduce<Partial<SentNotification["messageData"]>>(
            (newMessageData, key) => {
                if (key === "inlineAttachments") {
                    return newMessageData;
                }
                newMessageData[key] = this.applyTemplateVariablesToString(
                    sentNotification.messageData[key],
                    templateVariablesForUser
                );
                return newMessageData;
            },
            {}
        );

        return {
            ...sentNotification,
            messageData: newMessageData
        } as ISentNotificationDao
    }

    private applyTemplateVariablesToString(str: string, templateVariables: Record<string, string>): string {
        return Object.keys(templateVariables).reduce<string>((str, templateVariableKey) => {
            return this.replaceAll(str, `[[${templateVariableKey}]]`, templateVariables[templateVariableKey]);
        }, str);
    }

    private replaceAll(text: string, replacedValue: string, replacement: string): string {
        const changedText = text.replace(replacedValue, replacement);
        if (text === changedText) return text;
        return this.replaceAll(changedText, replacedValue, replacement);
    }

    async insert(
        sentNotification: SentNotification,
        templateVariables?: { [userId: string]: { [variableName: string]: string } }
    ): Promise<SentNotification> {
        if (sentNotification.sentToId != null) {
            const sentToIds = sentNotification.sentToIds || [];
            if (!sentToIds.includes(sentNotification.sentToId)) {
                sentToIds.push(sentNotification.sentToId);
            }
            sentNotification.sentToIds = sentToIds;
            sentNotification.sentToId = null;
        }
        const result = await this.insertEntity({
            ...sentNotification,
            templateVariables
        } as ISentNotificationDocument);
        return daoToDto(result);
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.deleteMany({ accountId });
    }
}

export class SentNotificationRepositoryFactory
    extends MongoRepositoryFactory<ISentNotificationDocument> {

    build(logger: Logger): SentNotificationRepository {
        return new SentNotificationRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getSchema(this.collection.name);
        schema.index({
            accountId: 1,
            "notificationMetadata.itemId": 1
        });
        this.model = this.collection.connection.model<ISentNotificationDocument>(
            "SentNotificationDAO",
            schema
        );
    }
}
