/**
 * Generic error for not found resource (url, entity, etc.). <br/>
 * See {@link EntityNotFound} for a more specialized type of error.
 */
export class ResourceNotFound extends Error {
    constructor(message = "not found") {
        super();
        this.message = message;
        Object.setPrototypeOf(this, ResourceNotFound.prototype);  // ES5 >= requirement
    }
}

/**
 * Not found specific error, currently used to reflect that
 * the entity (user, binder, ACL, etc.) was not found. <br/>
 * See {@link ResourceNotFound} for a more generic type of not found error.
 */
export class EntityNotFound extends ResourceNotFound {
    static errorName = "EntityNotFound";

    constructor(message: string) {
        super(message);
        this.name = EntityNotFound.errorName;
        Object.setPrototypeOf(this, EntityNotFound.prototype);  // ES5 >= requirement
    }
}

export class Unauthorized extends Error {
    static NAME = "Unauthorized";

    public readonly publicMessage: string;

    constructor(message: string, publicMessage?: string) {
        super();
        this.message = message;
        this.name = Unauthorized.NAME;
        this.publicMessage = publicMessage;
        Object.setPrototypeOf(this, Unauthorized.prototype);  // ES5 >= requirement
    }
}

export class AccessGranted {
    static NAME = "AccessGranted";
}


export type IdentityProviderKind = "password" | "token" | "public-api" | "impersonation" | "azure-oid" | "saml-sso" | "VCPA" | "backend";

export interface AuthenticatedSession {
    userId: string;
    sessionId: string;
    accountIds?: string[];
    jwt?: string;
    userAgent?: string;
    identityProvider: IdentityProviderKind;
    isDeviceUser?: boolean;
    sessionStart?: Date;
    isBackend?: boolean;
    // If the session was created by a device, then the deviceUserId is the userId of the device
    deviceUserId?: string;
}

export interface IADGroupMapping {
    ADGroupId: string;
    groupId: string;
}

export enum DocumentType {
    DOCUMENT = 0,
    COLLECTION = 1
}

// MonthKey is formatted like YYYY-MM e.g. 2023-02
export type MonthKey = string;

export function buildMonthKey(year: number, month: number): MonthKey {
    const monthPart = month < 10 ? `0${month}` : `${month}`;
    return `${year}-${monthPart}`;
}

export function buildMonthKeyFromDate(date: Date): MonthKey {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return buildMonthKey(year, month);
}