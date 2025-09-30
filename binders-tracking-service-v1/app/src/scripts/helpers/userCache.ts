import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

export interface UserDetails {
    login: string;
    displayName: string;
}

export class UserCache {
    private cache: {[uid: string]: UserDetails};

    constructor(private client: UserServiceClient) {
        this.cache = {};
    }

    private hasValue(c) {
        return c && c !== "";
    }

    private getDisplayName(user: User): string {
        if (this.hasValue(user.displayName)) {
            return user.displayName;
        }
        const parts = [];
        if (this.hasValue(user.firstName)) {
            parts.push(user.firstName);
        }
        if (this.hasValue(user.lastName)) {
            parts.push(user.lastName);
        }
        if (parts.length > 0) {
            return parts.join(" ");
        }
        return "";
    }

    async getUserDetails(uid: string): Promise<UserDetails> {
        if (this.cache[uid] === undefined) {
            const user = await this.client.getUser(uid);
            const details = {
                login: user.login,
                displayName: this.getDisplayName(user)
            };
            this.cache[uid] = details;
        }
        return this.cache[uid];
    }
}
