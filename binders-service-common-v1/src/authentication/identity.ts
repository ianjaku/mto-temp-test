import * as validator from "validator";
import { Either } from "@binders/client/lib/monad";
import { EntityIdentifier } from "../model/entities";
import { IUserAction } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import UUID from "@binders/client/lib/util/uuid";

export class UserActionIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "uac-";
    private static UUID_NAMESPACE = "ade68a27-bc2f-4d23-908f-e74b2bd8f246";

    protected assert(id: string): void {
        if (!id) throw new InvalidArgument("Missing user action id");
        if (!id.startsWith(UserActionIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid user action id ${id}`);
        }
    }

    static create(userAction: IUserAction): UserActionIdentifier {
        const values = [
            userAction.userActionType,
            userAction.accountId,
            userAction.end ? new Date(userAction.end).getTime() : "",
            userAction.start ? new Date(userAction.start).getTime() : "",
            userAction.userId ?? "",
        ];
        // We can at most miss 1 data point, otherwise we'll add the data to reduce the chance of collision
        if (values.filter(v => !v).length > 1) {
            values.push(JSON.stringify(userAction.data));
        }
        const uuid = UUID.v5(UserActionIdentifier.UUID_NAMESPACE, values.join(","));
        return new UserActionIdentifier(UserActionIdentifier.PREFIX + uuid.toString());
    }
}

export class UserIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "uid-";

    protected assert(id: string): void {
        if (!id || ! (id.startsWith(UserIdentifier.PREFIX) || id === "public") ) {
            throw new InvalidArgument(`Invalid user id '${id}'`);
        }
    }

    equals(other: UserIdentifier): boolean {
        return this.value() === other.value();
    }

    static isUserId(id: string): boolean {
        return id.startsWith(UserIdentifier.PREFIX);
    }

    static generate(): UserIdentifier {
        const id = UUID.randomWithPrefix(UserIdentifier.PREFIX);
        return new UserIdentifier(id);
    }

    static build(key: string): Either<Error, UserIdentifier> {
        try {
            return Either.right<Error, UserIdentifier>(new UserIdentifier(key));
        } catch (error) {
            return Either.left(error);
        }
    }

    /**
     * Creates a new {@link UserIdentifier} from the passed in key.
     * @param key a user identifier value
     * @throws InvalidArgument on invalid key format
     */
    static from(key: string): UserIdentifier {
        return new UserIdentifier(key);
    }
}

export class ScheduledEventIdentifier extends EntityIdentifier<string> {
    private static PREFIX = "sce-";
    
    static generate(): ScheduledEventIdentifier {
        const id = UUID.randomWithPrefix(ScheduledEventIdentifier.PREFIX);
        return new ScheduledEventIdentifier(id);
    }

    protected assert(id: string): void {
        if (!id || ! (id.startsWith(ScheduledEventIdentifier.PREFIX)) ) {
            throw new InvalidArgument(`Invalid scheduled event id '${id}'`);
        }
    }

}

export class AclIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "acl-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(AclIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid acl id '${id}'`);
        }
    }

    static generate(): AclIdentifier {
        const id = UUID.randomWithPrefix(AclIdentifier.PREFIX);
        return new AclIdentifier(id);
    }

    static build(key: string): Either<Error, AclIdentifier> {
        try {
            return Either.right<Error, AclIdentifier>(new AclIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export class AccountIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "aid-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(AccountIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid account id '${id}'`);
        }
    }

    static generate(): AccountIdentifier {
        const id = UUID.randomWithPrefix(AccountIdentifier.PREFIX);
        return new AccountIdentifier(id);
    }

    static build(key: string): Either<Error, AccountIdentifier> {
        try {
            return Either.right<Error, AccountIdentifier>(new AccountIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export class DomainFilterIdentifier extends EntityIdentifier<string> {

    private static PREFIX = "df-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(DomainFilterIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid account id '${id}'`);
        }
    }

    static generate(): DomainFilterIdentifier {
        const id = UUID.randomWithPrefix(DomainFilterIdentifier.PREFIX);
        return new DomainFilterIdentifier(id);
    }

    static build(key: string): Either<Error, DomainFilterIdentifier> {
        try {
            return Either.right<Error, DomainFilterIdentifier>(new DomainFilterIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export class Login {
    private readonly login: string;

    constructor(value: string) {
        Login.assert(value);
        this.login = value;
    }

    static assert(candidate: string): void {
        if (!validator.isEmail(candidate)) {
            throw new InvalidArgument("Invalid email: " + candidate);
        }
    }

    value(): string {
        return this.login;
    }

    equals(other: Login): boolean {
        return this.login === other.value();
    }

    static build(value: string): Either<Error, Login> {
        try {
            return Either.right<Error, Login>(new Login(value));
        }
        catch (error) {
            return Either.left(error);
        }
    }

    /**
     * Creates a new {@link Login} from the passed in value.
     * @param value a login value
     * @throws InvalidArgument on invalid value format
     */
    static from(value: string): Login {
        return new Login(value);
    }
}



export class SessionIdentifier extends EntityIdentifier<string> {
    private static PREFIX = "ses-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(SessionIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid session id '${id}'`);
        }
    }

    static generate(): SessionIdentifier {
        const id = UUID.randomWithPrefix(SessionIdentifier.PREFIX);
        return new SessionIdentifier(id);
    }

    static build(key: string): Either<Error, SessionIdentifier> {
        try {
            return Either.right<Error, SessionIdentifier>(new SessionIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export class RoleIdentifier extends EntityIdentifier<string> {
    private static PREFIX = "rol-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(RoleIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid role id '${id}'`);
        }
    }

    static generate(): RoleIdentifier {
        const id = UUID.randomWithPrefix(RoleIdentifier.PREFIX);
        return new RoleIdentifier(id);
    }

    static build(key: string): Either<Error, RoleIdentifier> {
        try {
            return Either.right<Error, RoleIdentifier>(new RoleIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export class NotificationTemplateIdentifier extends EntityIdentifier<string> {
    private static PREFIX = "ntmpl-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(NotificationTemplateIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid notification template id '${id}'`);
        }
    }

    static generate(): NotificationTemplateIdentifier {
        const id = UUID.randomWithPrefix(NotificationTemplateIdentifier.PREFIX);
        return new NotificationTemplateIdentifier(id);
    }

    static build(key: string): Either<Error, NotificationTemplateIdentifier> {
        try {
            return Either.right<Error, NotificationTemplateIdentifier>(new NotificationTemplateIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export class AlertIdentifier extends EntityIdentifier<string> {
    private static PREFIX = "alrt-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(AlertIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid alert id '${id}'`);
        }
    }

    static generate(): AlertIdentifier {
        const id = UUID.randomWithPrefix(AlertIdentifier.PREFIX);
        return new AlertIdentifier(id);
    }

    static build(key: string): Either<Error, AlertIdentifier> {
        try {
            return Either.right<Error, AlertIdentifier>(new AlertIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}
