import {
    CustomNotification,
    Notification,
    NotificationKind,
    NotifierKind,
    RelativeDate,
} from  "./contract";
import { tcombValidate, validateWithString, validationOk } from "../../validation";
import { TranslationKeys } from "../../../i18n/translations";
import i18next from "../../../i18n";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

const NotificationStruct = t.struct({
    kind: t.String,
    accountId: t.String,
})

const isNotification = (event: Notification): event is Notification =>
    "accountId" in event && "kind" in event;

export const isCustomNotification = (
    event: Notification
): event is CustomNotification => (
    isNotification(event) && event.kind === NotificationKind.CUSTOM
);

export function validateNotification(candidate: unknown): string[] {
    return tcombValidate(candidate, NotificationStruct)
}

export function validateNotifierKind(candidate: unknown): string[] {
    return validateWithString(candidate, (str) => {
        if (Object.values(NotifierKind).includes(str)) {
            return validationOk;
        }
        return [i18next.t(TranslationKeys.Notification_InvalidKind)];
    })
}

export const isRelativeDate = (
    date: Date | RelativeDate
): date is RelativeDate => {
    return typeof date === "object" && "amount" in date && "granularity" in date;
};
