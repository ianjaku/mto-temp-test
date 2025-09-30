import { isAfter, subDays } from "date-fns";

export type AuthTokenProvider = () => Promise<{ token: string; userId: string; expiresOn: Date | string }>;

/**
 * Number of days the log JWT token is available for
 */
export const LOG_TOKEN_EXPIRATION_DAYS = 8;

export class EventQueueAuthStore {

    private authToken: string;
    private expiresOn: Date;
    private userId: string;
    
    constructor(
        private readonly tokenProvider: AuthTokenProvider
    ) {}

    private async fetchNewToken(): Promise<void> {
        const { token, userId, expiresOn } = await this.tokenProvider();
        this.authToken = token;
        this.userId = userId;
        this.expiresOn = new Date(expiresOn);
    }

    private shouldTokenBeRenewed() {
        // The token is valid for 8 days, we want to renew it after 1-2 days
        // This makes sure the user can shut their pc off for 6 more days, and the log event will still be valid
        const renewDate = subDays(this.expiresOn, LOG_TOKEN_EXPIRATION_DAYS - 2);
        return isAfter(new Date(), renewDate);
    }

    public async getAuthToken(userId: string): Promise<string | null> {
        if (userId == null || userId === "public") return null;
        if (this.shouldTokenBeRenewed()) {
            await this.fetchNewToken();
        }
        if (this.authToken == null || userId !== this.userId) {
            await this.fetchNewToken();
        }
        if (this.authToken == null || userId !== this.userId) {
            return null;
        }
        return this.authToken;
    }
}
