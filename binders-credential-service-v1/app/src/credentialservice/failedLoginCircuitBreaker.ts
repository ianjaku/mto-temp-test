import { InvalidPassword } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";

export interface IFailedLoginCircuitBreaker {
    test(login: string): Promise<void>;
    reset(login: string): Promise<void>;
}

export const buildLoginCircuitBreaker = (client: RedisClient) => new FailedLoginCircuitBreaker(client);

const TTL = 60 * 10;

class FailedLoginCircuitBreaker implements IFailedLoginCircuitBreaker {
    static VERSION = 2;
    constructor(private redisClient: RedisClient) {

    }

    private getKeyForLogin(login: string): string {
        return `failed-login-${FailedLoginCircuitBreaker.VERSION}-${login}`;
    }

    async test(login: string): Promise<void> {
        const key = this.getKeyForLogin(login);
        const failedAttempts = await this.redisClient.incr(key);
        if (failedAttempts === 1) {
            // Reset after ten minutes
            await this.redisClient.expire(key, TTL);
        }
        if (failedAttempts > 10) {
            throw new InvalidPassword(login);
        }
    }

    async reset(login: string): Promise<void> {
        const key = this.getKeyForLogin(login);
        this.redisClient.set(key, "0", "EX", `${TTL}`, "XX");
    }
}