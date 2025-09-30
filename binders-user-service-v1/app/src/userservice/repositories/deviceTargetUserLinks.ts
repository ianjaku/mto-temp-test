import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { DeviceTargetUserLink } from "@binders/client/lib/clients/userservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface DeviceTargetUserLinksFilter {
    accountId: string;
}

export interface DeviceTargetUserLinkRepository {
    setDeviceTargetUsers(accountId: string, deviceUserId: string, deviceTargetUserIds: string[], usergroupIntersections: string[][]): Promise<void>;
    clearEntriesFor(accountId: string, userId: string): Promise<void>;
    findDeviceTargetUserLinks(filter: DeviceTargetUserLinksFilter): Promise<DeviceTargetUserLink[]>;
    getDeviceTargetUserLink(accountId: string, userId: string): Promise<DeviceTargetUserLink>;
}

export interface DeviceTargetUserLinkDocument extends mongoose.Document, DeviceTargetUserLink {
}

function getDeviceTargetUserLinkSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            required: true,
        },
        deviceUserId: {
            type: String,
            require: true
        },
        userIds: {
            type: Array,
            require: true
        },
        usergroupIntersections: {
            type: Array,
            default: () => [],
        },
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export class MongoDeviceTargetUserLinkRepositoryFactory extends MongoRepositoryFactory<DeviceTargetUserLinkDocument> {

    build(logger: Logger): MongoDeviceTargetUserLinkRepository {
        return new MongoDeviceTargetUserLinkRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getDeviceTargetUserLinkSchema(this.collection.name);
        schema.index({ accountId: 1, deviceUserId: 1 }, { unique: true });
        this.model = this.collection.connection.model<DeviceTargetUserLinkDocument>("DeviceTargetUserLink", schema);
    }
}

export class MongoDeviceTargetUserLinkRepository extends MongoRepository<DeviceTargetUserLinkDocument> implements DeviceTargetUserLinkRepository {
    async setDeviceTargetUsers(accountId: string, deviceUserId: string, deviceTargetUserIds: string[], usergroupIntersections: string[][]): Promise<void> {
        await this.upsert(
            { deviceUserId, accountId },
            ({ userIds: deviceTargetUserIds, usergroupIntersections }) as DeviceTargetUserLinkDocument,
        );
    }

    async clearEntriesFor(accountId: string, userId: string): Promise<void> {
        await Promise.all([
            // Remove all entries where the user is a device target user
            this.updateMany(
                {
                    accountId,
                    userIds: mongoose.trusted({ $in: [String(userId)] }),
                },
                { $pull: { userIds: userId } },
            ),
            // Remove all entries where the user is the device user
            this.deleteMany({ accountId, deviceUserId: userId })
        ]);
    }

    async findDeviceTargetUserLinks(filter: DeviceTargetUserLinksFilter): Promise<DeviceTargetUserLink[]> {
        const { accountId } = filter;
        return this.findEntities({
            accountId,
        });
    }

    async getDeviceTargetUserLink(accountId: string, userId: string): Promise<DeviceTargetUserLink> {
        const result = await this.fetchOne({
            accountId,
            deviceUserId: userId
        })
        if (result.isJust()) {
            return result.get();
        }
        return null;
    }

}
