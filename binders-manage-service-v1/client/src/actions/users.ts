import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { Action } from "../action";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { browserHistory } from "react-router";
import browserRequest from "@binders/client/lib/clients/browserClient";
import config from "../config";
import { getBackendRequestHandler } from "../api/handler";
import { toast } from "../components/use-toast";
import { toastStyles } from "../components/toast";

const userClient = UserServiceClient.fromConfig(config, "v1", browserRequest);
const userBackendClient = UserServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const credentialClient = CredentialServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export abstract class UsersAction implements Action { }

export class UserSaving extends UsersAction {
    constructor(public user: User) {
        super();
    }
}

function handleError(error) {
    // eslint-disable-next-line no-console
    console.error(error);
    toast({ className: toastStyles.error, title: "Server error", description: error.message })
}

export interface UserQuery {
    ids?: string[];
    searchPattern?: string;
}

export async function fetchUsers(query: UserQuery): Promise<User[]> {
    const users = [];
    if (query.ids) {
        users.push(await userBackendClient.findUserDetailsForIds(query.ids));
    }
    if (query.searchPattern) {
        if (query.searchPattern.startsWith("uid-")) {
            const user = await userBackendClient.getUser(query.searchPattern);
            users.push(user);
        } else {
            const regex = query.searchPattern;
            const serviceQuery = {
                login: regex,
                displayName: regex,
                combineWithOr: true,
                ignoreCase: true
            }
            const searchResult = await userBackendClient.searchUsersBackend(serviceQuery, { maxResults: 500 });
            users.push(await searchResult.hits);
        }
    }
    if (users.length === 0) {
        throw new Error("Invalid user query");
    }
    return users.flat();
}

export class UsersActions {

    static createUser(
        login: string,
        displayName: string,
        password: string,
        type: UserType,
        licenseCount: number
    ): void {
        userBackendClient.createUser(login, displayName, "", "", type, licenseCount)
            .then(user => {
                credentialClient.createCredential(user.id, user.login, password)
                    .then(() => {
                        UsersActions.switchToOverview();
                    });
            })
            .catch(handleError);
    }

    static updateUser(user: User): void {
        userBackendClient.updateUser(user)
            .then(updatedUser => {
                toast({ className: toastStyles.info, title: "User updated", description: `User ${updatedUser.displayName} was updated` })
                UsersActions.switchToOverview();
            })
            .catch(handleError);
    }


    static switchToOverview(): void {
        browserHistory.push("/users");
    }

    static switchToCreate(): void {
        browserHistory.push("/users/create");
    }

    static switchToUserEditDetails(userId: string): void {
        browserHistory.push("/users/" + userId);
    }

    static switchToUserEditAccounts(userId: string): void {
        browserHistory.push("/memberships/" + userId);
    }

    static switchToUserEditPassword(userId: string): void {
        browserHistory.push("/users/" + userId + "/password");
    }

    static updatePassword(
        userId: string,
        login: string,
        oldPassword: string,
        newPassword: string
    ): void {
        credentialClient.updatePassword(userId, login, oldPassword, newPassword)
            .then(() => {
                toast({ className: toastStyles.info, title: "Password changed", description: `Password for ${login} was changed` })
                UsersActions.switchToOverview()
            })
            .catch(handleError);
    }

}

export function whoAmI(): Promise<User> {
    return userClient.whoAmI();
}

export default UsersActions;

