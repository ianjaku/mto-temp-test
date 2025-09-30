import { RedisClient, RedisClientBuilder } from "../redis/client";
import { AuthenticatedSession } from "@binders/client/lib/clients/model"
import { Config } from "@binders/client/lib/config/config"
import { UserIdentifier } from "./identity";

export interface SessionRepository {
    saveSession(session: AuthenticatedSession): Promise<AuthenticatedSession>;
    getSessions(userId: UserIdentifier): Promise<AuthenticatedSession[]>;
    validateSession(session: AuthenticatedSession): Promise<boolean>;
    endSession(session: AuthenticatedSession): Promise<void>;
    endSessionByIds(userId: string, sessionId: string): Promise<void>;
}

export class RedisSessionRepository implements SessionRepository {

    constructor(protected client: RedisClient) {
    }

    private buildHashKey(userId: string) {
        return `user-sess-${userId}`;
    }

    async saveSession(session: AuthenticatedSession): Promise<AuthenticatedSession> {
        const hashKey = this.buildHashKey(session.userId);
        const propKey = session.sessionId;
        const propValue = Date.now();
        await this.client.hset(hashKey, propKey, propValue.toString());
        return session;
    }

    async getSessions(userIdObject: UserIdentifier): Promise<AuthenticatedSession[]> {
        const userId = userIdObject.value();
        const hashKey = this.buildHashKey(userId);
        const storedValues = await this.client.hgetall(hashKey);
        return Object.keys(storedValues)
            .map(propKey => ({ userId, sessionId: propKey, identityProvider: null }));
    }

    async validateSession(session: AuthenticatedSession): Promise<boolean> {
        if (!session) {
            return false;
        }
        const hashKey = this.buildHashKey(session.userId);
        const storedValue = await this.client.hget(hashKey, session.sessionId);
        return storedValue != null;
    }

    async endSession(session: AuthenticatedSession): Promise<void> {
        if (!session?.userId) {
            return;
        }
        const hashKey = this.buildHashKey(session.userId);
        const sessionToEnd = session.sessionId;
        await this.client.hdel(hashKey, sessionToEnd);
    }

    async endSessionByIds(userId: string, sessionId: string): Promise<void> {
        const hashKey = this.buildHashKey(userId);
        await this.client.hdel(hashKey, sessionId);
    }

    static fromConfig(config: Config): RedisSessionRepository {
        const client = RedisSessionRepository.redisClientFromConfig(config);
        return new RedisSessionRepository(client);
    }

    static redisClientFromConfig(config: Config): RedisClient {
        return RedisClientBuilder.fromConfig(config, "sessions")
    }
}

