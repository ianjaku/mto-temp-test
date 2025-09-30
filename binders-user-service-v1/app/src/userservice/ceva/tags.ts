import { CevaUser, IUserTag, isCevaTestUser } from "@binders/client/lib/clients/userservice/v1/contract";
import { User } from "../models/user";

function getCevaTag(name: string, user: CevaUser, userId?: string): IUserTag {
    const prefix = isCevaTestUser(user) ? user.tagPrefix : "";
    return {
        id: userId,
        type: "string",
        name: `${prefix}${name}`,
        value: user[name],
        context: "ceva"
    }
}

export function getEmployeeIdTag(user: CevaUser, userId?: string): IUserTag {
    return getCevaTag("employeeId", user, userId);
}

export function getServiceTag(user: CevaUser, userId?: string): IUserTag {
    return getCevaTag("service", user, userId);
}

export function getOrganizationTag(user: CevaUser, userId?: string): IUserTag {
    return getCevaTag("organization", user, userId);
}

function getDepartmentTag(user: CevaUser, userId?: string): IUserTag {
    return getCevaTag("department", user, userId);
}

export type UserWithTags = User & { tags: IUserTag[] }

export function enrichWithTags(cevaUser: CevaUser, user: User):  UserWithTags {
    const uid = user.id.value();
    return {
        ...user,
        tags: [
            getEmployeeIdTag(cevaUser, uid),
            getServiceTag(cevaUser, uid),
            getOrganizationTag(cevaUser, uid),
            getDepartmentTag(cevaUser, uid)
        ]
    }
}