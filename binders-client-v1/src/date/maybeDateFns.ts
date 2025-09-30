import {
    compareAsc,
    differenceInDays,
    format,
    formatDistance,
    isAfter,
    isValid,
    parse,
    parseISO,
} from "date-fns";
import { Maybe } from "../monad";

export function maybeDate(date: Date | string | null): Maybe<Date> {
    if (typeof date === "string") {
        return maybeParseISO(date);
    }
    if (!date || !isValid(date)) {
        return Maybe.nothing();
    }
    return Maybe.just(date);
}

export function maybeDifferenceInDays(first: Maybe<Date>, last: Maybe<Date>): Maybe<number> {
    return Maybe.whenBoth(first, last, (f, l) => differenceInDays(f, l));
}

export type FormatOptions = {
    locale?: Locale;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    firstWeekContainsDate?: number;
    useAdditionalWeekYearTokens?: boolean;
    useAdditionalDayOfYearTokens?: boolean;
}
export function maybeFormat(date: Maybe<Date>, formatStr: string, options?: FormatOptions): Maybe<string> {
    return date.caseOf({
        just: d => Maybe.just(format(d, formatStr, options)),
        nothing: () => Maybe.nothing(),
    });
}

export type FormatDurationOptions = {
    includeSeconds?: boolean;
    addSuffix?: boolean;
    locale?: Locale;
}

export function maybeFormatDistance(
    start: Maybe<Date>,
    end: Maybe<Date>,
    options?: FormatDurationOptions): Maybe<string> {
    return Maybe.whenBoth(start, end, (s, e) => formatDistance(s, e, options));
}

export function maybeIsAfter(first: Maybe<Date>, second: Maybe<Date>): Maybe<boolean> {
    return Maybe.whenBoth(first, second, (f, s) => isAfter(f, s));
}

export function maybeMinDate(dates: Maybe<Date>[]): Maybe<Date> {
    if (!dates || !dates.length) {
        return Maybe.nothing();
    }
    const onlyJusts = Maybe.rejectNothings(dates);
    if (!onlyJusts.length) {
        return Maybe.nothing();
    }
    return Maybe.just(
        onlyJusts.reduce((res, item) => compareAsc(res, item) < 0 ? res : item)
    );
}

export type ParseISOOptions = {
    additionalDigits?: 0 | 1 | 2;
}

export function maybeParseISO(isoStr: string, options?: ParseISOOptions): Maybe<Date> {
    if (!isoStr) {
        return Maybe.nothing();
    }
    const date = parseISO(isoStr, options);
    return maybeDate(date);
}

export function maybeParseFormatted(date: string, format: string, reference?: Date): Maybe<Date> {
    if (!reference) {
        reference = new Date();
    }
    const parsed = parse(date, format, reference);
    if (isNaN(parsed.getTime())) {
        return Maybe.nothing();
    }
    return Maybe.just(parsed);
}