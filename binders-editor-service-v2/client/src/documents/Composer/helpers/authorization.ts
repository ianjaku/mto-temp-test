import {
    IPermissionFlag,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { getAllLanguageCodes } from "@binders/client/lib/languages/helper";
import { isDialect } from "./language";
import { uniq } from "ramda";

export function buildTranslatorLanguageCodes(permissionFlags: IPermissionFlag[]): string[] {
    const editPermissionFlags = permissionFlags.filter(pf => pf.permissionName === PermissionName.EDIT);
    if (!((editPermissionFlags || []).length)) {
        return undefined;
    }
    const translatorLanguageCodes = uniq(editPermissionFlags.reduce((acc, pf) => [...acc, ...(pf.languageCodes || [])], []));
    return translatorLanguageCodes.length ?
        extendWithDialects(translatorLanguageCodes) :
        undefined;
}

function extendWithDialects(languageCodes: string[]): string[] {
    const allLanguageCodes = getAllLanguageCodes(true);
    const getDialects = (languageCode: string) => (
        isDialect(languageCode) ?
            [] :
            allLanguageCodes.filter(lc => lc.startsWith(`${languageCode}-`))
    );
    return languageCodes.reduce((reduced, languageCode) => {
        return [
            ...reduced,
            languageCode,
            ...getDialects(languageCode),
        ]
    }, []);
}