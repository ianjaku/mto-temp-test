import { TFunction } from "../i18n";
import { TranslationKeys as TK } from "../i18n/translations";

export const ONE_SECOND = 1_000;
export const TEN_SECONDS = 10 * ONE_SECOND;
export const ONE_MINUTE = 60 * ONE_SECOND;
export const ONE_YEAR = 365 * 24 * 60 * ONE_MINUTE;
export const FIVE_MINUTES = 5 * ONE_MINUTE;
export const FIFTEEN_MINUTES = 15 * ONE_MINUTE;
export const TEN_YEARS = 10 * ONE_YEAR;

export function normalizeMinutesLabel(minutes: number, t: TFunction): string {
    if (minutes % 60 === 0) {
        return t(TK.General_HourX, { count: Math.floor(minutes / 60) });
    }
    return `${minutes} ${t(TK.General_Minute, { count: 2 })}`;
}

export const secondsToUserReadableFormat = (duration: number, t: TFunction): string => {
    if (duration > 0) {
        if (duration >= 60) {
            return `${Math.round(duration / 60)}${t(TK.General_MinuteAbbr)}`;
        } else {
            return `${Math.round(duration)}${t(TK.General_SecondAbbr)}`;
        }
    } else {
        return "";
    }
};
