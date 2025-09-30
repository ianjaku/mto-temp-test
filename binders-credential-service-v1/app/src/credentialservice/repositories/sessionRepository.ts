import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { ISessionDAO, MONGOOSE_SCHEMA, Session } from "../models/session";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { IBrowserInfoReport } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { IdentityProviderKind } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import {
    SessionRepository
} from "@binders/binders-service-common/lib/authentication/sessionrepository";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { parseUserAgent } from "../userAgentParser";

export class MultiSessionRepository implements SessionRepository {
    constructor(private readonly targets: SessionRepository[]) {
        if (targets.length < 1) {
            throw new Error("We need at least one repository as target");
        }
    }

    private mapTargets<T>(f: (target: SessionRepository) => Promise<T>) {
        return Promise.all(this.targets.map(f))
            .then(ts => ts.shift());
    }

    saveSession(session: AuthenticatedSession): Promise<AuthenticatedSession> {
        return this.mapTargets(t => t.saveSession(session));
    }

    getSessions(userId: UserIdentifier): Promise<AuthenticatedSession[]> {
        return this.targets[0].getSessions(userId);
    }

    validateSession(session: AuthenticatedSession): Promise<boolean> {
        return this.targets[0].validateSession(session);
    }

    async endSession(session: AuthenticatedSession): Promise<void> {
        await this.mapTargets(t => t.endSession(session));
    }

    async endSessionByIds(userId: string, sessionId: string): Promise<void> {
        await this.mapTargets(t => t.endSessionByIds(userId, sessionId));
    }
}

interface ISessionBackendRepository {
    getBrowserUsageReport(cutoffDate?: Date): Promise<IBrowserInfoReport>;
}


export interface UserSessionByIdentityProvider {
    userId: string;
    identityProvider: IdentityProviderKind;
    count: number;
    last: Date;
}

export class MongoSessionRepository extends MongoRepository<ISessionDAO> implements SessionRepository, ISessionBackendRepository {
    saveSession(session: AuthenticatedSession): Promise<AuthenticatedSession> {
        const modelSession = Session.build(
            session.sessionId,
            session.userId,
            session.identityProvider,
            session.jwt,
            session.userAgent,
            session.isDeviceUser,
            undefined,
            session.accountIds,
        );
        return this.insertEntity(modelSession.toDAO())
            .then(() => session);
    }

    async groupByIdentityProvider(userIds: string[], cutoffDate: Date): Promise<UserSessionByIdentityProvider[]> {
        const result = await this.aggregate([
            { $match: { user_id: { $in: userIds }, created_on: { $gte: cutoffDate } } },
            { $group: { _id: { user_id: "$user_id", identity_provider: "$identity_provider" }, count: { $sum: 1 }, last: { $max: "$created_on" } } }
        ]);
        const userSessions: UserSessionByIdentityProvider[] = [];
        for (const data of result) {
            const { _id, count, last } = data as { _id: { user_id: string, identity_provider: string }, count: number, last: Date };
            const { user_id, identity_provider } = _id;
            const userSession = { userId: user_id, identityProvider: identity_provider as IdentityProviderKind, count, last };
            userSessions.push(userSession);
        }
        return userSessions;
    }

    async getBrowserUsageReport(cutoffDate?: Date): Promise<IBrowserInfoReport> {
        const result = {
            browsers: {},
            browserVersions: {},
            mobileDevices: {},
            mobileDesktop: { mobile: 0, desktop: 0 },
            os: {}
        };

        const gatherData = async (sessions: ISessionDAO[]) => {
            const userAgents = sessions.map(({ user_agent }) => user_agent ? parseUserAgent(user_agent) : undefined).filter(ua => !!ua);
            userAgents.reduce((partialResult, ua) => {
                const { deviceType, browserName, browserVersion, os, mobileModel } = ua;
                this.incrementFieldCount(partialResult.browsers, browserName);
                this.incrementFieldCount(partialResult.mobileDevices, mobileModel);
                this.incrementFieldCount(partialResult.os, os);
                const device = deviceType === "mobile" ? "mobile" : "desktop";
                this.incrementFieldCount(partialResult.mobileDesktop, device);
                this.incrementBrowserVersionCount(partialResult, browserName, browserVersion);
                return partialResult;
            }, result);
        }
        const query = cutoffDate ?
            { created_on: mongoose.trusted({ $gte: new Date(cutoffDate) }) } :
            {};
        await this.batchProcess(query, gatherData, { batchSize: 1000 });
        return result;
    }

    private incrementFieldCount(collector: Record<string, number>, field: string) {
        if (field) {
            if (!collector[field]) {
                collector[field] = 0;
            }
            collector[field] += 1;
        }
    }

    private incrementBrowserVersionCount(collector: Record<string, unknown>, browserName: string, browserVersion: string) {
        if (browserName) {
            if (!collector.browserVersions[browserName]) {
                collector.browserVersions[browserName] = {};
            }
            const version = simplifyBrowserVersion(browserVersion);
            this.incrementFieldCount(collector.browserVersions[browserName], version);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getSessions(userId?: UserIdentifier): Promise<AuthenticatedSession[]> {
        const daos = await this.findEntities({ user_id: userId.value() })
        return daos.map(dao => {
            return {
                userId: dao.user_id,
                sessionId: dao.session_id,
                identityProvider: dao.identity_provider as IdentityProviderKind,
                sessionStart: dao.created_on
            }
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    validateSession(session: AuthenticatedSession): Promise<boolean> {
        throw new Error("MongoSessionRepository.validateSession not implemented.");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async endSession(session: AuthenticatedSession): Promise<void> {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async endSessionByIds(userId: string, sessionId: string): Promise<void> {
        return;
    }
}

const VERSION_MATCHER = /^(?<major>\d+)(?:\.(?<minor>\d+))?.*$/;
const simplifyBrowserVersion = (browserVersion: string): string => {
    const match = VERSION_MATCHER.exec(browserVersion);
    if (match == null) {
        return "unknown";
    }
    return `${match.groups.major}.${match.groups.minor ?? 0}`;
}

export class MongoSessionRepositoryFactory extends MongoRepositoryFactory<ISessionDAO> {
    getSessionSchema(collectionName: string): mongoose.Schema {
        return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
    }

    build(logger: Logger): MongoSessionRepository {
        return new MongoSessionRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = this.getSessionSchema(this.collection.name);
        this.model = this.collection.connection.model<ISessionDAO>("SessionDAO", schema);
    }

    static async fromConfig(config: BindersConfig, logger: Logger): Promise<MongoSessionRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        const collectionConfig = await CollectionConfig.promiseFromConfig(config, "sessions", loginOption);
        return new MongoSessionRepositoryFactory(collectionConfig, logger)
    }
}
