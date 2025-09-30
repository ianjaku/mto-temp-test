import { AssigneeType, PermissionName, ResourceType } from "./contract";
import {
    UserId,
    tcombValidate,
    validateUsergroupId 
} from "../../validation";
import { TranslationKeys } from "../../../i18n/translations";
import i18next from "../../../i18n";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

export function validateResourceType(candidate: unknown): string[] {
    if (typeof candidate !== "number") {
        return [i18next.t(TranslationKeys.General_NoNumberError, {candidate})];
    }
    if (ResourceType[candidate] === undefined) {
        return [i18next.t(TranslationKeys.General_InvalidNumberError, {candidate})];
    }
    return [];
}

export function validatePermissionName(candidate: unknown): string[] {
    if (typeof candidate !== "number") {
        return [i18next.t(TranslationKeys.Acl_WrongNumberPermissionError, {candidate})];
    }
    if (PermissionName[candidate] === undefined) {
        return [i18next.t(TranslationKeys.Acl_InvalidPermissionError, {candidate})];
    }
    return [];
}

export function validatePermissionNames(candidates: unknown[]): string[] {
    const result = candidates.some(el => validatePermissionName(el).length > 0)
    return result ? [i18next.t(TranslationKeys.Acl_InvalidPermissionInArrayError, {candidates})] : [];
}

export function validateAssigneeType(candidate: unknown): string[] {
    if (typeof candidate !== "number") {
        return [i18next.t(TranslationKeys.Acl_InvalidAssigneeNoNumberError, {candidate})];
    }
    if (AssigneeType[candidate] === undefined) {
        return [i18next.t(TranslationKeys.Acl_InvalidAssigneeError, {candidate})];
    }
    return [];
}

export function validateGroupIdsOrUserIds(candidates: unknown[]): string[] {
    const result = candidates.some(candidate => validateGroupIdOrUserId(candidate).length > 0);
    return result ? [i18next.t(TranslationKeys.User_InvalidUserGroupIdInArray, {candidates})] : [];
}

function validateGroupIdOrUserId(candidate): string[] {
    if (typeof candidate !== "string") {
        return [i18next.t(TranslationKeys.Acl_InvalidAssigneeType, {candidate})];
    }

    const userIdValidation = tcombValidate(candidate, UserId, i18next.t(TranslationKeys.User_InvalidUserId, {candidate}));
    const groupIdValidation = validateUsergroupId(candidate);

    const isValidUserId = (userIdValidation.length === 0 && groupIdValidation.length > 0);
    const isValidGroupId = (groupIdValidation.length === 0 && userIdValidation.length > 0);

    return (isValidGroupId || isValidUserId) ? [] : [ ...userIdValidation, ...groupIdValidation ];
}

export const ResourceGroupStruct = t.struct({
    name: t.maybe(t.String),
    type: t.enums.of([0, 1, 2]),
    ids: t.list(t.String)
}, "ResourceGroupStruct");

export function validateResourceGroup(candidate: unknown): string[] {
    return tcombValidate(candidate, ResourceGroupStruct);
}

export function validateResourceGroups(candidate: unknown): string[] {
    return tcombValidate(candidate, t.list(ResourceGroupStruct));
}
