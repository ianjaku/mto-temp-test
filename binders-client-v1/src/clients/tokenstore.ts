// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _isExternalUser = (<any> window).bindersConfig.isExternalUser;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _initialAccessToken = (<any> window).bindersConfig.api.token;

function extractInitialDeviceToken () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const impersonationInfo = (<any> window).impersonation;
    if (!impersonationInfo) {
        return null;
    }
    const { deviceToken } = JSON.parse(impersonationInfo);
    return deviceToken;
}

const _initialDeviceToken = extractInitialDeviceToken();

interface Tokens {
    user: string;
    device?: string;
}

class TokenStore {

    private currentTokens: Tokens | null = null;
    private updatingToken = false;
    private tokenUpdateListeners: ((tokens: Tokens | null) => void)[] = [];
    private tokensRefresher: NodeJS.Timeout | null = null;

    constructor() {
        this.currentTokens = {
            user: _initialAccessToken,
            device: _initialDeviceToken
        };
        this.startTokensRefresher();
    }

    public hasInternalToken() {
        return this.hasAnyToken() && !_isExternalUser;
    }

    public hasAnyToken(): boolean {
        return this.currentTokens?.user != null;
    }

    public isPublic() {
        return this.hasAnyToken() == null ||
            (this.hasAnyToken() != null && _isExternalUser);
    }

    /**
     * allowExternal:
     *  True -> Always fetch the token, even when on an account without access
     *  False -> If on an account without access, return null
     */
    public async fetchToken(
        allowExternalToken = false,
        useDeviceToken = true
    ): Promise<string | null> {
        if (_isExternalUser && !allowExternalToken) return null;
        if (this.updatingToken) {
            await this.waitForTokensUpdate();
        } else {
            if (!this.hasAnyToken() || hasJWTExpired(this.currentTokens.user)) {
                await this.fetchNewTokens();
            }
        }
        return this.pickToken(useDeviceToken);
    }

    private pickToken(useDeviceToken: boolean): string {
        if (useDeviceToken) {
            return this.currentTokens?.device || this.currentTokens.user;
        }
        return this.currentTokens.user;
    }

    private async fetchNewTokens(): Promise<string | null> {
        try {
            this.setUpdatingTokens(true);
            const tokens = await this.fetchTokensFromApi();
            if (tokens == null) return null;
            this.setCurrentTokens(tokens);
            return tokens;
        } finally {
            this.startTokensRefresher();
            this.setUpdatingTokens(false);
            this.updateListeners();
        }
    }

    private async fetchTokensFromApi() {
        const response = await fetch("/auth/access-tokens", { method: "POST" });
        const result = await response.json();
        return result.tokens;
    }

    private setCurrentTokens(tokens: Tokens | null): void {
        this.currentTokens = tokens;
    }

    private startTokensRefresher() {
        this.clearTokensRefresher();
        if (this.currentTokens == null) return
        const msBeforeExpiry = getMSBeforeJWTExpires(this.currentTokens.user);
        this.tokensRefresher = setTimeout(async () => {
            if (this.updatingToken) return;
            const token = await this.fetchTokensFromApi();
            if (token == null) return null;
            this.setCurrentTokens(token);
            this.startTokensRefresher();
        // Expire 1 minute before the actual token expires
        }, msBeforeExpiry - 60 * 1000);
    }

    private clearTokensRefresher() {
        if (this.tokensRefresher != null) {
            clearTimeout(this.tokensRefresher);
            this.tokensRefresher = null;
        }
    }

    private setUpdatingTokens(value: boolean) {
        this.updatingToken = value;
        if (value) {
            this.updateListeners();
        }
    }

    private updateListeners() {
        const updateListeners = this.tokenUpdateListeners;
        this.tokenUpdateListeners = [];
        updateListeners.forEach(ul => ul(this.currentTokens));
    }

    private async waitForTokensUpdate(): Promise<Tokens | null> {
        return new Promise((resolve) => {
            this.tokenUpdateListeners.push(
                (tokens: Tokens | null) => {
                    resolve(tokens);
                }
            );
        });
    }
}

const readJWT = (jwt: string): Record<string, unknown> => {
    if (jwt == null || !jwt.includes(".")) return null;
    const base64 = jwt.split(".")[1];
    const json = atob(base64);
    return JSON.parse(json);
}

/**
 * @param offsetMS Reduces the expiration time by offsetMS
 *                 The default value is 10000.
 *                 Meaning this function will return false, 10 seconds before the token expires.
 */
const hasJWTExpired = (jwt: string, offsetMS = 10000): boolean => {
    const content = readJWT(jwt);
    if (content == null) return true;
    const exp = content.exp as number;
    const expired = Date.now() >= exp * 1000 - offsetMS;
    return expired;
}

const getMSBeforeJWTExpires = (jwt: string): number => {
    const content = readJWT(jwt);
    if (content == null) return 0;
    const exp = content.exp as number;
    return Math.max(exp * 1000 - Date.now(), 0);
}


export default new TokenStore();
