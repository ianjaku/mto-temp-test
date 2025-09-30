import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    AuthorizationServiceClient
} from  "@binders/client/lib/clients/authorizationservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);
const authFactory = new ClientFactory(
    config,
    AuthorizationServiceClient,
    "v1"
);
const accFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("Modifying user details", () => {
    it("Allows a regular user to change its name", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const userChanges: Partial<User> = {
                displayName: "display name",
                firstName: "first",
                lastName: "last",
            };

            const user = await fixtures.users.create();
            const userService = await clientFactory.createForFrontend(user.id);

            const updatedUser = await userService.updateUser(
                { ...user, ...userChanges },
                fixtures.getAccountId());
            expect(updatedUser).toEqual(expect.objectContaining(userChanges));
        });
    });

    it("Blocks a regular user to change another user", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const otherUser = await fixtures.users.create();
            const userService = await clientFactory.createForFrontend(user.id);

            await expect(() => userService.updateUser({ ...otherUser, displayName: "xx" }, fixtures.getAccountId()))
                .rejects.toThrow("Unauthorized");
        });
    });

    it("Allows an admin to change another user", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const userChanges: Partial<User> = {
                displayName: "display name",
                firstName: "first",
                lastName: "last",
            };

            const user = await fixtures.users.create();
            const admin = await fixtures.users.createAdmin();
            const userService = await clientFactory.createForFrontend(admin.id);

            const updatedUser = await userService.updateUser(
                { ...user, ...userChanges },
                fixtures.getAccountId());
            expect(updatedUser).toEqual(expect.objectContaining(userChanges));
        });
    });
});

describe("Modifying login user information", () => {
    it("Signs out the modified user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const admin = await fixtures.users.createAdmin();
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, "xxxxxx");
            const session = await credService.loginWithPassword(user.login, "xxxxxx");
            // creating a UAT works only when the user is signed in
            await credService.createUserAccessToken(session.sessionId, user.id);

            const userService = await clientFactory.createForFrontend(admin.id);
            await userService.updateUser(
                {...user, login: `changed-${user.login}`},
                fixtures.getAccountId());

            await expect(() => credService.createUserAccessToken(session.sessionId, user.id))
                .rejects.toThrow("Your session has expired");
        });
    });

    it("Allows backend scripts to modify users", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();

            const userService = await clientFactory.createBackend();
            await userService.updateUser(
                {...user, login: `changed-${user.login}`},
                fixtures.getAccountId());
        });
    });

    it("Changes email and requires user to log in with new credentials", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const userPassword = "xxxxxxx";
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, userPassword);
            await credService.loginWithPassword(user.login, userPassword);
            const newLogin = `changed-${user.login}`;
            const userService = await clientFactory.createBackend();
            await userService.updateUser(
                {...user, login: newLogin},
                fixtures.getAccountId());

            await expect(() => credService.loginWithPassword(user.id, userPassword))
                .rejects.toThrow("Invalid credentials");
            await credService.loginWithPassword(newLogin, userPassword);
        });
    });


    describe("Rejects changing login when", () => {
        it("User with login already exists", async () => {
            return globalFixtures.withFreshAccount(async (fixtures) => {
                const user = await fixtures.users.create();
                const newLogin = `existing-${user.login}`;
                await fixtures.users.create({login: newLogin});

                const userService = await clientFactory.createBackend();
                await expect(() => userService.updateUser(
                    { ...user, login: newLogin },
                    fixtures.getAccountId())
                ).rejects.toThrow("Login already in use");
            });
        });

        it("User tries changing own login", async () => {
            return globalFixtures.withFreshAccount(async (fixtures) => {
                const user = await fixtures.users.createAdmin();

                const userService = await clientFactory.createForFrontend(user.id);
                await expect(() => userService.updateUser(
                    { ...user, login: `new-${user.login}` },
                    fixtures.getAccountId())
                ).rejects.toThrow("Unauthorized");
            });
        });

        it("User does not have admin permissions", async () => {
            return globalFixtures.withFreshAccount(async (fixtures) => {
                const user = await fixtures.users.create();
                const user2 = await fixtures.users.create();

                const userService = await clientFactory.createForFrontend(user.id);
                await expect(() => userService.updateUser(
                    { ...user2, login: `new-${user2.login}` },
                    fixtures.getAccountId())
                ).rejects.toThrow("Unauthorized");
            });
        });

        it("Admin in other account does not have permissions to change user", async () => {
            let user;
            await globalFixtures.withFreshAccount(async (fixtures) => {
                user = await fixtures.users.create();
            });
            return await globalFixtures.withFreshAccount(async (fixtures) => {
                const admin = await fixtures.users.createAdmin();

                const userService = await clientFactory.createForFrontend(admin.id);
                await expect(() => userService.updateUser(
                    { ...user, login: `new-${user.login}` },
                    fixtures.getAccountId())
                ).rejects.toThrow("Unauthorized");
            });
        });

        it("Admins do not have permissions to change a @manual.to login", async () => {
            return globalFixtures.withFreshAccount(async (fixtures) => {
                const admin = await fixtures.users.createAdmin();
                const user = await fixtures.users.create({login: `${Date.now()}@manual.to`});

                const userService = await clientFactory.createForFrontend(admin.id);
                await expect(() => userService.updateUser(
                    { ...user, login: `new-${user.login}` },
                    fixtures.getAccountId())
                ).rejects.toThrow("Unauthorized");
            });
        });

        it("Admin needs permission in all of user's accounts", async () => {
            let user;
            let user2;
            await globalFixtures.withFreshAccount(async (fixtures) => {
                user = await fixtures.users.create();
                user2 = await fixtures.users.create();
            });
            return await globalFixtures.withFreshAccount(async (fixtures) => {
                const accountService = await accFactory.createBackend();
                await accountService.addMember(fixtures.getAccountId(), user.id, ManageMemberTrigger.INTEGRATION_TEST);
                await accountService.addMember(fixtures.getAccountId(), user2.id, ManageMemberTrigger.INTEGRATION_TEST);
                const authService = await authFactory.createBackend();
                await authService.addAccountAdmin(fixtures.getAccountId(), user2.id);

                const userService = await clientFactory.createForFrontend(user2.id);
                await expect(() => userService.updateUser(
                    { ...user, login: `new-${user.login}` },
                    fixtures.getAccountId())
                ).rejects.toThrow("Unauthorized");
            });
        });
    });
});
