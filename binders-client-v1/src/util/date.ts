import * as Locales from "date-fns/locale";
import { formatDistanceToNow, formatDistanceToNowStrict, isValid, parseJSON } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import i18n from "../i18n";


/**
 * A sensible value for when we want to use the end of time in calculations.
 */
export const END_OF_TIME = new Date("9999-01-01");

/**
 * An approximation of the beginning of time for this project
 */
export const BEGINNING_OF_2017 = new Date("2017-01-01");

/**
 * Attempts to "guess" the timezone
 */
export const detectTimeZone = (): string|null => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const NOT_AVAILABLE_DATE = "N/A";

/**
 * @example
 * 2014-10-22
 */
const ISO_8601_DATE_FORMAT = "yyyy-MM-dd";

/**
 * @example
 * 2014-10-22 16:20
 * 2014-10-22 04:20 PM
 */
const ISO_8601_DATE_LOCALIZED_TIME_FORMAT = "yyyy-MM-dd p";

/**
 * @example
 * October 25th, 2014 at 10:46 AM
 * 25 października 2014 10:46
 * 25 oktober 2014 om 10:46
 */
export const LOCALIZED_SHORT_FULL_DATE_FORMAT = "PPPp";

/**
 * Accepted format options for {@linkcode fmtDate}.
 * * timeZone - Optional, defaults to UTC. Accepted values <code>Intl.supportedValuesOf('timeZone')</code>
 * * locale - Optional, defaults to <code>enUS</code>.
 */
export type FormatOptions = {
    timeZone?: string;
    locale?: string;
};

const DEFAULT_TIMEZONE = "UTC";
/**
 * <b>WARNING: For internal use only.</b><br>Use {@linkcode fmtDateIso8601}, {@linkcode fmtDateWritten}, {@linkcode fmtDateTimeWritten},
 * {@linkcode fmtDateTimeRelative}, or {@linkcode fmtDateIso8601TimeLocalized} for user facing date formatting
 *
 * A function to format a provided datetime based on the passed in options.
 * It optionally accepts time zone and locales.
 * @param date A {@linkcode Date} object
 * @param formatStr See {@link https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table|Date Field Symbol Table} specification
 * @param formatOptions See {@linkcode FormatOptions} for details
 */
export const fmtDate = (date: Date, formatStr: string, formatOptions: FormatOptions = {}): string => {
    const { timeZone = DEFAULT_TIMEZONE, locale } = formatOptions;
    const resolvedLocale = resolveLocale(locale);
    return formatInTimeZone(date, timeZone, formatStr, { locale: resolvedLocale });
}

const DEFAULT_LOCALE = Locales.enUS;
const resolveLocale = (maybeLocale: string|null): Locale => {
    const locale = maybeLocale ?? <string>i18n.language ?? "";
    if (locale === "en") {  // There is no 'en' in date-fns/locales
        return DEFAULT_LOCALE;
    }
    return Locales[locale.replace(/-_/, "")] ?? DEFAULT_LOCALE;
}

/**
 * A function to format current datetime based on the passed in options.
 * It optionally accepts time zone and locales.
 * @param formatStr See {@link https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table|Date Field Symbol Table} specification
 * @param formatOptions See {@linkcode FormatOptions} for details
 */
export const fmtNow = (formatStr: string, formatOptions: FormatOptions = {}): string =>
    fmtDate(new Date(), formatStr, formatOptions)

/**
 * Accepted format options for {@linkcode fmtDateTimeRelative}.
 * * locale - Optional, defaults to <code>en-US</code>.
 * * strict - Optional, do not use helpers like 'almost', 'over', 'less than' and the like.
 * * addSuffix - Optional, add "X ago"/"in X" in the locale language
 * * includeSeconds - Optional, adds seconds granularity to the formatted string
 */
export type FormatRelativeOptions = {
    locale?: string;
    strict?: boolean;
    addSuffix?: boolean;
    includeSeconds?: boolean;
};

/**
 * Formats a date as a relative time string, optionally in strict mode and with a locale-specific suffix.
 *
 * This function returns a string representing the time distance between the given date and the current time,
 * with options for strictness, locale-specific formatting, and suffix addition to indicate past or future.
 *
 * @param date The date to be formatted into a relative time string.
 * @param formatOptions Optional configuration for formatting, See {@linkcode FormatRelativeOptions} for details.
 * @returns The formatted relative time string.
 * @example "5 days ago" or "in 5 days"
 */
export const fmtDateTimeRelative = (date: Date, formatOptions?: FormatRelativeOptions): string => {
    const dateFnsOptions = {
        locale: resolveLocale(formatOptions?.locale),
        addSuffix: formatOptions?.addSuffix,
        includeSeconds: formatOptions?.includeSeconds,
    };
    return formatOptions?.strict ?
        formatDistanceToNowStrict(date, dateFnsOptions) :
        formatDistanceToNow(date, dateFnsOptions);
}

/**
 * Formats a date into an ISO 8601 date string (yyyy-MM-dd).
 *
 * This function converts a Date object into a string in ISO 8601 format, focusing on the date part only.
 *
 * @param date The date to format.
 * @param formatOptions Optional formatting options, not explicitly used in this example but can include locale or other formatting preferences.
 * @returns The date formatted in ISO 8601 date format.
 * @example 2023-03-04
 */
export const fmtDateIso8601 = (date: Date, formatOptions: FormatOptions = {}): string => {
    return fmtDate(date, ISO_8601_DATE_FORMAT, formatOptions);
}

/**
 * Formats a date into an ISO 8601 date string (yyyy-MM-dd) and adjusts it to user's timezone.
 *
 * This function converts a Date object into a string in ISO 8601 format, focusing on the date part only.
 *
 * @param date The date to format.
 * @returns The date formatted in ISO 8601 date format using detected timezone.
 * @example '2023-03-03T23:20Z' would be formatted to '2023-03-04' for GMT+2 timezone
 */
export const fmtDateIso8601TZ = (date: Date): string =>
    fmtDateIso8601(date, { timeZone: detectTimeZone() });

/**
 * Formats a date and time into an ISO 8601 string with localized time (yyyy-MM-dd p).
 *
 * This function provides a formatted string representing both the date and the time, according to ISO 8601 standards,
 * with adjustments for localization based on provided options.
 *
 * @param date The date and time to format.
 * @param formatOptions Optional formatting options to adjust the output, potentially including timezone or locale considerations.
 * @returns The date and time formatted in ISO 8601 format with localized time.
 * @example 2023-03-04 4:20 PM
 */
export const fmtDateIso8601TimeLocalized = (date: Date, formatOptions: FormatOptions = {}): string => {
    return fmtDate(date, ISO_8601_DATE_LOCALIZED_TIME_FORMAT, formatOptions);
}

/**
 * Formats a date and time into an ISO 8601 string with localized time (yyyy-MM-dd p) and tries to adjust to user timezone.
 *
 * This function provides a formatted string representing both the date and the time, according to ISO 8601 standards,
 * with adjustments for localization based on provided options and timezone based on detected timezone.
 *
 * @param date The date and time to format.
 * @returns The date and time formatted in ISO 8601 format with localized time and adjusted to user timezone.
 * @example '2023-03-04T14:20Z' will be formatted to '2023-03-04 4:20 PM' for GMT+2 timezone
 */
export const fmtDateIso8601TimeLocalizedTZ = (date: Date): string => {
    return fmtDate(date, ISO_8601_DATE_LOCALIZED_TIME_FORMAT, { timeZone: detectTimeZone() });
}

/**
 * Formats a date into a long, written-out string format in the given locale.
 *
 * This function returns a date string formatted with the full month name, day, and year,
 * optionally in a specified locale. If no locale is provided, "en-US" is used as the default.
 *
 * @param date - The date to format.
 * @param [maybeLocale] - The locale to use for formatting the date string. Defaults to "en-US".
 * @returns A long, written-out date string formatted according to the specified or default locale.
 * @example March 4, 2023
 */
export const fmtDateWritten = (date: Date, maybeLocale?: string): string => {
    return date.toLocaleDateString(
        maybeLocale ?? "en-US",
        { year: "numeric", month: "long", day: "numeric" },
    );
}

/**
 * Formats a date and time into a long, written-out string format including the time, in the given locale.
 *
 * This function extends `fmtDateWritten` by also including the hour and minute in the formatted output.
 *
 * @param date The date and time to format.
 * @param maybeLocale The locale to use for formatting. Defaults to "en-US" if not provided.
 * @returns A detailed, written-out string of the date and time, formatted according to the specified or default locale.
 * @example March 4, 2023 at 4:20 PM
 */
export const fmtDateTimeWritten = (date: Date, maybeLocale?: string): string => {
    return date.toLocaleDateString(
        maybeLocale ?? "en-US",
        { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" },
    );
}

/**
 * Attempts to detect the time zone code from the provided date and time zone
 * While currently this function is defined for backwards compatibility reasons,
 * the recommendation is to find a different way to express timezones rather than codes.
 *
 * Note: Asia & Africa timezone code are not resolved correctly
 *
 * @param utcDate a date in UTC format
 * @param timeZone a valid time zone
 */
export const toTimeZoneCode = (utcDate: Date, timeZone: string): string =>
    fmtDate(utcDate, "z", { timeZone, locale: "nl" });


/**
 * Attempts to parse a date from a string, returns null otherwise
 * @param dateStr a date represented as a string
 */
export const parseDateFromString = (dateStr?: string | null): Date|null => {
    const date = parseJSON(dateStr);
    return isValid(date) ? date : null;
}

/**
 * Compares two dates in ascending order.
 * @param left - The left {@linkcode Date} to compare.
 * @param right - The right {@linkcode Date} to compare.
 * @returns A negative number if `left` is less than `right`, 0 if they are equal, or a positive number if `left` is greater than `right`.
 *          Null dates are treated as the beginning of the epoch.
 */
export const dateSorterAsc = (left: Date | null, right: Date | null): number => {
    return getTimeOrZero(left) - getTimeOrZero(right);
}

/**
 * Compares two dates in descending order.
 * @param left - The left {@linkcode Date} to compare.
 * @param right - The right {@linkcode Date} to compare.
 * @returns A negative number if `right` is less than `left`, 0 if they are equal, or a positive number if `right` is greater than `left`.
 *          Null dates are treated as the beginning of the epoch.
 */
export const dateSorterDesc = (left: Date | null, right: Date | null): number => {
    return dateSorterAsc(right, left);
}

export enum SortOrder {
    ASC = "ASC",
    DESC = "DESC",
}

/**
 * Sorts an array of elements based on a Date property extracted using the passed in function
 * Null values from the date extractor function are considered beginning of epoch
 * @param elements the array of elements to sort
 * @param dateExtractor the date property extractor
 * @param sortOrder sort order (optional). See {@link SortOrder} for options (default is {@link SortOrder.ASC})
 */
export const sortByDate = <T>(elements: T[], dateExtractor: (elem: T) => Date | null, sortOrder = SortOrder.ASC): T[] => {
    if (elements == null || dateExtractor == null) {
        throw new Error("Both elements & dateExtractor have to be defined");
    }
    const datesComparator = sortOrder === SortOrder.DESC ? dateSorterDesc : dateSorterAsc;
    return [...elements]
        .sort((left, right) => datesComparator(dateExtractor(left), dateExtractor(right)));
}

function getTimeOrZero(date: Date | null) {
    if (!date) return 0;
    return date.getTime();
}

