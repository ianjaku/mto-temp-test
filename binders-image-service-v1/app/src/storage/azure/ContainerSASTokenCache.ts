
interface CachedToken {
    token: string;
    expiry: number;
}

const CLEANUP_INTERVAL = 60 * 1000;

export class ContainerSASTokenCache {

    private cachedTokens: Record<string, CachedToken>;
    private nextCleanup: number;

    constructor() {
        this.cachedTokens = {};
        this.updateCleanup(Date.now());
    }

    addToken(container: string, token: string, expiry: number): void {
        this.cachedTokens[container] = { token, expiry };
    }

    getToken(container: string): string | undefined {
        const now = Date.now();
        if (now > this.nextCleanup) {
            this.cleanup(now);
        }
        const token = this.cachedTokens[container];
        if (!token) {
            return undefined;
        }
        return token.token;
    }

    private cleanup(now: number): void {
        for(const container in this.cachedTokens) {
            const token = this.cachedTokens[container];
            if(token.expiry < now) {
                delete this.cachedTokens[container];
            }
        }
        this.updateCleanup(now);
    }

    private updateCleanup(now: number): void {
        this.nextCleanup = now + CLEANUP_INTERVAL;
    }
}