import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendUserServiceClient
} from "../../apiclient/backendclient";
import { DeviceTargetUserLink, MailMessage, User, UserCreationMethod, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import UUID from "@binders/client/lib/util/uuid";
import { UnCachedBackendAuthorizationServiceClient } from "../../authorization/backendclient";
import { UserIdWithToken } from "@binders/client/lib/clients/credentialservice/v1/contract";

// Logins ending in this address will be filtered out when sending emails during testing
export const TEST_EMAIL_ADDRESS_ENDINGS = "@testing-email.example.com";

export type CreateUserParams = {
    firstName?: string;
    lastName?: string;
    login?: string;
    displayName?: string;
    password?: string;
    type?: UserType
    creationMethod?: UserCreationMethod;
};

export const createUniqueTestLogin = (prefix?: string): string => {
    return `${prefix ? prefix + "-" : ""}${UUID.random().toString()}${TEST_EMAIL_ADDRESS_ENDINGS}`;
}

export const createUniqueDomain = (): string => {
    return `${UUID.random().toString()}.test.manual.to`;
}

export const createUniqueAccountName = (prefix = "Test"): string => {
    return `${prefix} Account #${UUID.random().toString().split("-").at(-1)}`;
}

export class TestUserFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    async getUserByLogin(login: string): Promise<User> {
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return await userClient.getUserByLogin(login);
    }

    async create(
        values?: CreateUserParams,
        options?: {
            dontAddToAccount?: boolean // Users that are not part of a test account, will not be cleaned up automatically
        }
    ): Promise<User> {
        const login = values?.login ?? `${UUID.random().toString()}@testing-email.example.com`;
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const user = await userClient.createUser(
            login,
            values?.displayName ?? login,
            values?.firstName ?? "John",
            values?.lastName ?? "Doe",
            values?.type ?? UserType.Individual,
        );
        if (values?.creationMethod) {
            await userClient.updateUser({ ...user, creationMethod: values.creationMethod });
        }
        if (values?.password) {
            const credClient = await BackendCredentialServiceClient.fromConfig(this.config, "testing");
            // It's an existing user, but they don't have a password yet
            await credClient.createCredential(user.id, user.login, values?.password);
        }
        const accountClient = await BackendAccountServiceClient.fromConfig(
            this.config,
            "testing"
        );
        if (!options?.dontAddToAccount) {
            await accountClient.addMember(
                this.accountId,
                user.id,
                ManageMemberTrigger.INTEGRATION_TEST,
                true // Don't give the user view permissions on the root colletion by default
            );
        }

        return user;
    }

    async createRoot(
        values?: CreateUserParams,
    ): Promise<User> {
        const getBindersMediaAccountId = () => Promise.resolve("aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6");
        const bindersAccount = await getBindersMediaAccountId();
        const user = await this.create(values);
        const authorizationClient = await UnCachedBackendAuthorizationServiceClient
            .fromConfig(
                this.config,
                "testing"
            );
        await authorizationClient.addAccountAdmin(bindersAccount, user.id);
        return user;
    }

    async createAdmin(
        values?: CreateUserParams,
    ): Promise<User> {
        const user = await this.create(values);
        const authorizationClient = await UnCachedBackendAuthorizationServiceClient
            .fromConfig(
                this.config,
                "testing"
            );
        await authorizationClient.addAccountAdmin(this.accountId, user.id);
        return user;
    }

    async deleteUser(userId: string) {
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await userClient.deleteUser(userId);
    }

    async setDeviceTargetUsers(
        deviceId: string,
        deviceTargetIds: string[]
    ): Promise<DeviceTargetUserLink[]> {
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        const user = await userClient.getUser(deviceId);
        await userClient.updateUser({ ...user, type: UserType.Device }, this.accountId);
        return await userClient.assignDeviceTargetUsers(
            this.accountId,
            deviceId,
            deviceTargetIds
        );
    }

    async addTag(
        userId: string,
        params: {
            context: string,
            name: string,
            type: string,
            value: string
        }
    ): Promise<void> {
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await userClient.insertUserTag({
            id: userId,
            ...params
        });
    }

    async getMockedEmails(targetEmail: string): Promise<MailMessage[]> {
        const userClient = await BackendUserServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return userClient.getMockedEmails(targetEmail);
    }

    async getUserToken(userId: string): Promise<UserIdWithToken> {
        const credClient = await BackendCredentialServiceClient.fromConfig(this.config, "testing");
        const [token] = await credClient.getUsersTokens([userId]);
        return token;
    }

    async anonymizeUser(login: string): Promise<void> {
        const userClient = await BackendUserServiceClient.fromConfig(this.config, "testing");
        const user = await userClient.getUserByLogin(login);
        user.login = `${user.id}@anonymous.manual.to`;
        await userClient.updateUser(user);
        const credClient = await BackendCredentialServiceClient.fromConfig(this.config, "testing");
        await credClient.anonymizeCredential(user.id);
    }
}
