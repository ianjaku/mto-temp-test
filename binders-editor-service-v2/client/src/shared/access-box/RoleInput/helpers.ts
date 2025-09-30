import {
    PermissionName,
    Role,
    TRANSLATOR_PSEUDO_ID,
    TRANSLATOR_PSEUDO_NAME
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { IAccessDataAssignee } from "..";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UIRole } from ".";
import {
    buildRoleTranslationKey
} from "@binders/client/lib/clients/authorizationservice/v1/helpers";

export function buildUIRoles(
    accountRoles: Role[],
    includeTranslatorPseudoRole: boolean,
    _t: TFunction
): UIRole[] {
    return [
        ...accountRoles.map(role => ({ ...role, dbRoleName: role.name })),
        ...(includeTranslatorPseudoRole ?
            [{
                roleId: TRANSLATOR_PSEUDO_ID,
                name: TRANSLATOR_PSEUDO_NAME,
                dbRoleName: "Contributor",
                isRestrictedVariant: true,
                permissions: [PermissionName.EDIT, PermissionName.VIEW],
                isBuiltin: false,
                isDefault: false,
            }] :
            []),
    ];
}

export function convertToUiAssignee(accessDataAssignee: IAccessDataAssignee, t: TFunction): IAccessDataAssignee {
    const { aclRestrictionSet } = accessDataAssignee;
    const isTranslator = aclRestrictionSet && aclRestrictionSet.languageCodes;
    return {
        ...accessDataAssignee,
        ...(isTranslator ? { uiRoleName: t(TK.Acl_RoleTranslator) } : {}),
    }
}

export function buildNewDropdownRoles(uiRoles: Role[], t: TFunction): IDropdownElement[] {
    return uiRoles
        .filter(role => !role.isInvisible)
        .map(({ name }): IDropdownElement => ({
            id: name,
            label: t(TK[buildRoleTranslationKey(name)]),
        }));
}

export function maybeNormalizePseudoRole(role: UIRole, accountRoles: Role[]): UIRole {
    if (role.roleId === TRANSLATOR_PSEUDO_ID) {
        return {
            ...accountRoles.find(r => r.name === "Contributor"),
            restrictionSet: role.restrictionSet,
        }
    }
    return role;
}

export function validateUserInput(items: IAutocompleteItem[], role: UIRole, t: TFunction): string {
    if (items.length && !role) {
        return t(TK.User_SelectUserGroupRole)
    }
    if (role?.roleId === TRANSLATOR_PSEUDO_ID) {
        const langCodes = role?.restrictionSet?.languageCodes ?? [];
        if (langCodes.length === 0) {
            return t(TK.User_SelectTranslatorLanguage);
        }
    }
    return undefined;
}