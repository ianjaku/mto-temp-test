import * as mongoose from "mongoose";
import { AuthenticatedSession, IdentityProviderKind } from "@binders/client/lib/clients/model";
import { SessionIdentifier, UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export const MONGOOSE_SCHEMA = {
    user_id: { type: String, required: true },
    session_id: { type: String, required: true },
    identity_provider: { type: String },
    is_device_user: { type: Boolean },
    user_agent: { type: String, required: false },
    created_on: { type: Date, required: true, default: Date.now },
    account_ids: { type: Array },
};

export interface ISession {
    userId: UserIdentifier;
    sessionId: SessionIdentifier;
    identityProvider: IdentityProviderKind;
    jwt?: string;
    userAgent?: string;
    isDeviceUser?: boolean;
    createdOn: Date;
    accountIds?: string[];
}

export interface ISessionDAO extends mongoose.Document {
    user_id: string;
    session_id: string;
    identity_provider: string;
    user_agent: string;
    created_on: Date;
    is_device_user?: boolean;
    account_ids: string[];
    deviceUserId?: string;
}

export class Session implements ISession {

    constructor(
        readonly sessionId: SessionIdentifier,
        readonly userId: UserIdentifier,
        readonly identityProvider: IdentityProviderKind,
        readonly jwt?: string,
        readonly userAgent?: string,
        readonly isDeviceUser?: boolean,
        readonly createdOn: Date = new Date(),
        readonly accountIds?: string[],

        // If the session was created by a device, then the deviceUserId is the userId of the device
        readonly deviceUserId?: string
    ) { }

    static build(
        sessionId: string,
        userId: string,
        identityProvider: IdentityProviderKind,
        jwt?: string,
        userAgent?: string,
        isDeviceUser?: boolean,
        createdOn: Date = new Date(),
        accountIds?: string[],
        deviceUserId?: string
    ): Session {
        return new Session(
            new SessionIdentifier(sessionId),
            new UserIdentifier(userId),
            identityProvider,
            jwt,
            userAgent,
            isDeviceUser,
            createdOn,
            accountIds,
            deviceUserId
        );
    }

    toDAO(): ISessionDAO {
        return <ISessionDAO>{
            user_id: this.userId.value(),
            session_id: this.sessionId.value(),
            identity_provider: this.identityProvider,
            user_agent: this.userAgent,
            created_on: this.createdOn,
            ...(this.isDeviceUser ? { is_device_user: this.isDeviceUser } : {}),
            account_ids: this.accountIds,
            deviceUserId: this.deviceUserId
        };
    }

    toClient(): AuthenticatedSession {
        return <AuthenticatedSession>{
            userId: this.userId.value(),
            sessionId: this.sessionId.value(),
            identityProvider: this.identityProvider,
            jwt: this.jwt,
            userAgent: this.userAgent,
            isDeviceUser: this.isDeviceUser,
            accountIds: this.accountIds,
            deviceUserId: this.deviceUserId
        };
    }
}
