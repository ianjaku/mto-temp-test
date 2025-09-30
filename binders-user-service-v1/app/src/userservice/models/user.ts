import {
    User as IUser,
    UserCreationMethod,
    UserType
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    Login,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";

export class LoginNotAvailable extends Error {
    constructor(public login: string) {
        super();
        Object.setPrototypeOf(this, LoginNotAvailable.prototype);  // ES5 >= requirement
    }
}

export class UnknownDomain extends Error {
    constructor(msg: string) {
        super(msg);
        Object.setPrototypeOf(this, UnknownDomain.prototype);  // ES5 >= requirement
    }
}

export class InvitationEmailFail {
    public name = "InvitationEmailFail";
    constructor(public reason: string) { }
}

export interface CreateUserProps {
    login: Login,
    displayName: string,
    firstName?: string,
    lastName?: string,
    type?: UserType,
    licenseCount?: number,
    isPasswordless?: boolean,
    creationMethod?: UserCreationMethod,
}

export class User {

    public readonly type: UserType;
    public readonly licenseCount: number;

    constructor(
        public readonly id: UserIdentifier,
        public readonly login: Login,
        public readonly displayName: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly created: Date,
        public readonly updated: Date,
        public readonly lastOnline: Date,
        public readonly bounced: boolean,
        type: UserType,
        licenseCount: number,
        public readonly isPasswordless?: boolean,
        public readonly creationMethod?: UserCreationMethod,
    ) {
        this.type = type || UserType.Individual;
        this.licenseCount = licenseCount || 1;
    }

    static create({
        login,
        displayName,
        firstName = "",
        lastName = "",
        type = UserType.Individual,
        licenseCount = 1,
        isPasswordless = false,
        creationMethod,
    }: CreateUserProps): User {
        const userId = UserIdentifier.generate();
        return new User(
            userId,
            login,
            displayName,
            firstName,
            lastName,
            undefined,
            undefined,
            undefined,
            false,
            type,
            licenseCount,
            isPasswordless,
            creationMethod
        );
    }
}

export class UserSearchResult {
    constructor(readonly hitCount: number, readonly hits: User[]) { }
}

export function userModelToInterface(user: User): IUser {
    return {
        id: user.id.value(),
        login: user.login.value(),
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        created: user.created,
        updated: user.updated,
        lastOnline: user.lastOnline,
        bounced: user.bounced,
        type: user.type,
        licenseCount: user.licenseCount,
        isPasswordless: user.isPasswordless,
        creationMethod: user.creationMethod,
    };
}