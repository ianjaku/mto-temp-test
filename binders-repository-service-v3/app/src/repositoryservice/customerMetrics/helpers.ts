import { MergeMethod, Metric, MetricHandler, MetricMap, MetricServices, Mode } from "./contract";
import { ACTIVE_METRICS } from "./constants";

function formatYearDashMonth(year: number, month: number) {
    const monthZeroPrefix = month > 9 ? "" : "0";
    return year + "-" + monthZeroPrefix + month
}

function dateToYearDashMonth(date: Date) {
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    return formatYearDashMonth(year, month);
}

function statsDailyToMonthly(
    stats: { date: Date, count: number }[],
    mergeMethod: MergeMethod = "ADD"
) {
    return stats.reduce<{ [monthAndYear: string]: number }>(
        (result, current) => {
            const yearDashMonth = dateToYearDashMonth(new Date(current.date));
            const existingValue = result[yearDashMonth] ?? 0;
            result[yearDashMonth] = mergeNumbers(existingValue, current.count, mergeMethod);
            return result;
        },
        {}
    )
}

function mergeNumbers(nr1: number, nr2: number, mergeMethod: MergeMethod): number {
    if (mergeMethod === "ADD")
        return nr1 + nr2;
    if (mergeMethod === "HIGHEST")
        return nr1 > nr2 ? nr1 : nr2;

    throw new Error(`"${mergeMethod}" is not a valid merge method"`);
}

export const metricHandlers: Record<Metric, MetricHandler> = {
    MEMBER_COUNT: (accountId, { trackingService }) => (
        trackingService.userCountStatistics(accountId)
            .then(stats => statsDailyToMonthly(stats, "HIGHEST"))
    ),
    LOGINS: (accountId, { trackingService }) => (
        trackingService.loginStatistics(accountId)
            .then(stats =>
                statsDailyToMonthly(stats.map(stat => ({ date: stat.date, count: stat.logins })))
            )
    ),
    DOCUMENTS_CREATED: (accountId, { trackingService }) => (
        trackingService.documentCreationsStatistics(accountId)
            .then(stats =>
                statsDailyToMonthly(stats.map(stat => ({ date: stat.date, count: stat.creations })))
            )
    ),
    DOCUMENTS_READ: (accountId, { trackingService }) => (
        trackingService.accountViewsStatistics(accountId)
            .then(stats =>
                statsDailyToMonthly(
                    Object.values(stats).map(value => ({ date: value.date, count: value.views }))
                )
            )
    ),
    DOCUMENTS_READ_EXCL_AUTHORS: (accountId, { trackingService }) => (
        trackingService.accountViewsStatistics(accountId, true)
            .then(stats =>
                statsDailyToMonthly(
                    Object.values(stats).map(value => ({ date: value.date, count: value.views }))
                )
            )
    ),
    ITEMS_EDITED: (accountId, { trackingService }) => (
        trackingService.itemEditsStatistics(accountId)
            .then(stats => (
                statsDailyToMonthly(stats.map(stat => ({ date: stat.date, count: stat.edits })))
            ))
    )
}

export function monthsBetweenYears(fromYear: number, untilYear: number): string[] {
    const currentYear = (new Date()).getUTCFullYear();
    const currentMonth = (new Date()).getUTCMonth();
    const untilYearWithDefault = untilYear ?? currentYear
    const items: string[] = []
    for (let year = fromYear; year <= untilYearWithDefault; year++) {
        for (let month = 0; month < 12; month++) {
            if (year >= currentYear && month >= currentMonth) return items;
            items.push(formatYearDashMonth(year, month + 1));
        }
    }
    return items;
}

export async function getMetricMapForAccountId(
    accountId: string,
    yearDashMonths: string[],
    services: MetricServices,
): Promise<MetricMap> {
    return ACTIVE_METRICS.reduce(async (reducedPromise, metricName) => {
        const reduced = await reducedPromise;
        const metricValuesObj = await metricHandlers[metricName](accountId, services);
        const metricValuesArr = yearDashMonths.map(
            yearDashMonth => metricValuesObj[yearDashMonth],
        );
        reduced[metricName] = metricValuesArr;
        return reduced;
    }, Promise.resolve({} as MetricMap));
}

export function replaceUndefinedWithNoData(numbers: number[]): (number | "no data")[] {
    return numbers.map(n => [undefined, null].includes(n) ? "no data" : n);
}

export function buildHeaders(mode: Mode, months: string[]): string {
    return mode === "account" ?
        `customerId,crmCustomerId,customerName,customer accountId,accountName,metricName,${(months || []).join(",")}` :
        `customerId,crmCustomerId,customerName,metricName,${(months || []).join(",")}`;
}