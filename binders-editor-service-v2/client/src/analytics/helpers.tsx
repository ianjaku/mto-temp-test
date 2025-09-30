import * as React from "react";
import { ITableDataCell, ITableHeader } from "@binders/ui-kit/lib/elements/Table";
import AccountStore from "../accounts/store";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { IUserActionSummary } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { secondsToUserReadableFormat } from "@binders/client/lib/util/time";

export function toTableHeaders(
    t: TFunction,
    userTagNames: string[],
    hasUsergroupsColumn = false,
): ITableHeader[] {
    return [
        t(TK.User_User),
        t(TK.User_Login),
        ...(hasUsergroupsColumn ? [{ label: t(TK.User_Groups), type: "string", exportOnly: true }] : []),
        t(TK.User_Action),
        t(TK.User_ActionItem),
        { label: "URL", type: "string", exportOnly: true },
        { label: "DOCID", type: "string", exportOnly: true },
        t(TK.User_ActionTime),
        { label: t(TK.User_ActionDuration), type: "number" },
        ...(userTagNames || []).map(v => ({ label: v, type: "string", exportOnly: true })),
    ];
}

const OBFUSCATED_READ_TIMES_TRANSLATIONS: Record<IUserActionSummary["obfuscatedDuration"], string> = {
    "unknown": TK.General_Unsupported,
    "opened": TK.Analytics_ReadTimeOpened,
    "skimmed": TK.Analytics_ReadTimeSkimmed,
    "read": TK.Analytics_ReadTimeRead,
}

export function toTableData(
    t: TFunction,
    userActions: IUserActionSummary[],
    userTagNames: string[] = [],
    hasUsergroupsColumn = false,
): ITableDataCell[][] {
    const accountFeatures = AccountStore.getAccountFeatures();
    const isPublicContentEnabled = accountFeatures?.result?.includes(FEATURE_PUBLICCONTENT);
    return userActions.map(row => {
        const userName = (row.userDisplayName === "public" && !isPublicContentEnabled) ?
            t(TK.General_NotApplicable) :
            row.userDisplayName;

        const timestamp = row.timestamp && fmtDateIso8601TimeLocalizedTZ(row.timestamp);

        const duration = row.obfuscatedDuration ?
            t(OBFUSCATED_READ_TIMES_TRANSLATIONS[row.obfuscatedDuration]) :
            secondsToUserReadableFormat(row.duration, t);
        const rawRowDuration = row.obfuscatedDuration ?
            t(OBFUSCATED_READ_TIMES_TRANSLATIONS[row.obfuscatedDuration]) :
            row.duration;
        const userTagDataCells = userTagNames.reduce((reduced, userTagName) => {
            const val = row.userTags.find(tag => tag.name === userTagName)?.value;
            return reduced.concat({
                uiValue: val || "",
                value: val || "",
                exportValue: val || "",
                exportOnly: true
            });
        }, [] as ITableDataCell[]);

        const action = `${t(row.userActionTranslationKey)}${row.userActionExtraInfo || ""}`;

        return [
            userName,
            row.userEmail,
            ...(hasUsergroupsColumn ?
                [{
                    uiValue: row.userGroupNames.join(","),
                    value: row.userGroupNames.join(","),
                    exportValue: row.userGroupNames.join(","),
                    exportOnly: true
                }] :
                []),
            action,
            {
                uiValue: row.url &&
                    !([t(TK.DocManagement_HardDeletedItem), t(TK.DocManagement_DeletedItem)].includes(action)) &&
                    row.title !== "item deleted" ?
                    (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" > {row.title} </a>
                    ) :
                    row.title,
                value: row.title,
                exportValue: row.title,
            },
            { uiValue: row.url, value: row.url, exportValue: row.url, exportOnly: true },
            { uiValue: row.id, value: row.id, exportValue: row.id, exportOnly: true },
            { uiValue: timestamp, value: row.timestamp?.getTime(), exportValue: timestamp },
            { uiValue: duration, value: rawRowDuration, exportValue: rawRowDuration },
            ...userTagDataCells
        ];
    });
}

export function extractUserTagsColumns(userActions: IUserActionSummary[]): string[] {
    const uniqueTagNames = userActions.flatMap(ua => ua.userTags)
        .reduce((set, tag) => set.add(tag.name), new Set<string>());
    return Array.from(uniqueTagNames);
}
