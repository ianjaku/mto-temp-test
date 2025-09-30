import { DEVICE_TARGET_USER_DOMAIN, USER_GROUP_IDENTIFIER_PREFIX } from "./constants";
import { User, Usergroup } from "./contract";

type UserInfo = Pick<User, "login" | "displayName" | "firstName" | "lastName">;

/**
 * Attempts to define a simple way to display a user's name. Replaces {@link buildUserName}.
 * It prefers the display name over first and last name since those cannot be modified by the user after signing up.
 * If none of the above are defined, it falls back to the login.
 */
export function getUserName(userInfo: Partial<UserInfo>): string {
    const { displayName = "", login = "", firstName = "", lastName = "" } = userInfo;
    if (displayName) {
        return displayName;
    } else if (firstName.trim() || lastName.trim()) {
        return `${firstName} ${lastName}`.trim();
    } else {
        return login;
    }
}

export interface BuildUserNameOptions {
    preferFirstName?: boolean;
    noFallbackToId?: boolean;
}

/** @deprecated See {@link getUserName} */
export function buildUserName(user: Partial<User>, options?: BuildUserNameOptions): string {
    const { id, login, displayName, firstName, lastName } = user;
    let name: string | undefined;
    if (options?.preferFirstName) {
        name = firstName || displayName;
    } else {
        name = firstName ?
            `${firstName}${lastName ? ` ${lastName}` : ""}` :
            displayName;
    }
    return name || login || (options?.noFallbackToId ? "" : id);
}

export function isUsergroupId(candidate: string): boolean {
    return candidate.startsWith(USER_GROUP_IDENTIFIER_PREFIX);
}

export function isUsergroup(candidate: { id?: string }): candidate is Usergroup {
    return candidate.id && isUsergroupId(candidate.id);
}

export function createDeviceUserEmail(
    targetLoginOrName: string,
    deviceUserLogin: string,
    domain: string
): string {
    const deviceUsername = deviceUserLogin.split("@")[0];
    const targetName = targetLoginOrName.split("@")[0].replace(/\s/g, "");
    const domainName = domain.toLowerCase().split(".manual.to")[0];
    const fullDomain = `${deviceUsername}.${domainName}.${DEVICE_TARGET_USER_DOMAIN}`;
    return `${targetName}@${normalizeDomain(fullDomain)}`;
}

// Follow https://en.wikipedia.org/wiki/Email_address#Domain rules
const normalizeDomain = (email: string): string => {
    return email.replace(/[^\w.-]+/g, "-");
}
