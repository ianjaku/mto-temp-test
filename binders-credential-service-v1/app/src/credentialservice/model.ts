import { Login, UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";

export interface Credential {
    userId: UserIdentifier;
    blocked: boolean;
}

export class InvalidToken extends Error {
    static NAME = "InvalidToken";

    constructor(message: string) {
        super();
        this.message = message;
        this.name = InvalidToken.NAME;
    }
}

export class LoginNotFound extends Error {
    static NAME = "LoginNotFound";

    constructor(login: string) {
        super();
        this.message = `Login ${login} not found`;
        this.name = LoginNotFound.NAME;
        Object.setPrototypeOf(this, LoginNotFound.prototype);  // ES5 >= requirement
    }
}

export class UserIdNotFound extends Error {
    constructor(message?: string) {
        super();
        this.message = message ?? "UserId not found.";
        Object.setPrototypeOf(this, UserIdNotFound.prototype);  // ES5 >= requirement
    }
}

export class InvalidCredential extends Error {
    constructor(message?: string) {
        super();
        this.message = message ?? "Invalid credential.";
        Object.setPrototypeOf(this, InvalidCredential.prototype);  // ES5 >= requirement
    }
}

export class LoginAndPassword implements Credential {
    constructor(
        public userId: UserIdentifier,
        public blocked: boolean,
        public login: Login,
        public passwordHash: PasswordHash,
        public lastPasswordChange: Date
    ) {}

    validate(plainTextPassword: string): Promise<boolean> {
        if (this.blocked) {
            return Promise.resolve(false);
        } else {
            return this.passwordHash.validate(plainTextPassword);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static generate(login: Login, password: PasswordHash) {
        const user = UserIdentifier.generate();
        return new LoginAndPassword(user, false, login, password, new Date());
    }
}

export abstract class PasswordHash {
    abstract getAlgorithm(): number;
    abstract validate(clearTextPassword: string): Promise<boolean>;
    abstract serializeDetails(): string;

    serialize(): string {
        return JSON.stringify({
            algorithm: this.getAlgorithm(),
            details: this.serializeDetails()
        });
    }
}

export class PlainTextPassword extends PasswordHash {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    getAlgorithm() {
        return PasswordHashAlgorithms.PLAINTEXT;
    }

    constructor(public clearText: string) {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    validate(clearTextPassword: string) {
        return Promise.resolve(clearTextPassword === this.clearText);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    serializeDetails() {
        return this.clearText;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static fromSerializedDetails(serializedDetails: string) {
        return new PlainTextPassword(serializedDetails);
    }
}

export enum PasswordHashAlgorithms {
    PLAINTEXT,
    BCRYPT
}
