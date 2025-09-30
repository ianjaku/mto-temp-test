import { BEGINNING_OF_2017, fmtDate, sortByDate } from "@binders/client/lib/util/date";
import { DataItemBuilder, ILineChartDataItem, IRangeDefinition } from "@binders/ui-kit/lib/elements/linechart/withRanges";
import { any, dropWhile } from "ramda";
import { differenceInDays, subDays } from "date-fns";

export interface RangeBuilders {
    week: DataItemBuilder;
    month: DataItemBuilder;
    year: DataItemBuilder;
    allTime: DataItemBuilder;
}

function getRangeDefinitions (rangesWithBuild: RangeBuilders): IRangeDefinition[] {
    return Object.entries(rangesWithBuild).map(([id, dataItemBuilder]) => ({
        id,
        label: id === "allTime" ? "All time" : `Last ${id}`,
        build: dataItemBuilder
    }));
}

const DAYS_SINCE_BEGINNING = differenceInDays(Date.now(), BEGINNING_OF_2017);

export interface Metric {
    date: Date,
    value: number
}

export type MetricCombinator = (toCombine: Metric[]) => Metric;
export const MetricMax: MetricCombinator = (toCombine: Metric[]): Metric => {
    if (toCombine.length === 0) {
        return undefined;
    }
    let { value: currentMax } = toCombine[0];
    const { date } = toCombine[0];
    for (let i = 1; i < toCombine.length; i++) {
        currentMax = Math.max(currentMax, toCombine[i].value);
    }
    return {
        date,
        value: currentMax
    }
}
export const MetricSum: MetricCombinator = (toCombine: Metric[]): Metric => {
    if (toCombine.length === 0) {
        return undefined;
    }
    const sum = toCombine.reduce((acc, el) => acc + el.value, 0);
    return {
        date: toCombine[0].date,
        value: sum
    };
}

const groupByMonth = (metrics: Metric[], combine: MetricCombinator) => {
    const grouped: {[bom: string]: Metric} = {};
    for (const metric of metrics) {
        const utcStartOfMonth = getUtcStartOfMonth(metric.date);
        const key = utcStartOfMonth.toString();
        if (key in grouped) {
            grouped[key] = combine([grouped[key], metric]);
        } else {
            grouped[key] = {
                date: utcStartOfMonth,
                value: metric.value
            };
        }
    }
    const metricsArray = Object.values(grouped);
    return sortByDate(metricsArray, m => m.date);
};

/**
 * Normally we'd want to use the date-fns/startOfMonth
 * However: In this case we're running the aggregation in the browser which means we're subject to the
 * user's timezone. This can mess up with the aggregation since date-fns/startOfMonth will round the date
 * using the user's timezone while we don't really want that since all the dates that we receive are UTC
 */
const getUtcStartOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

function getDaysBackCutoff(daysBack: number): number {
    if (daysBack != 365) {
        return daysBack;
    }
    const daysBackDate = subDays(Date.now(), daysBack);
    const beginningOfMonth = getUtcStartOfMonth(daysBackDate);
    return differenceInDays(Date.now(), beginningOfMonth);
}

export function getRangeDefinitionsFromStats(metrics: Metric[], combineMetrics: MetricCombinator): IRangeDefinition[] {
    metrics = metrics.map(m => ({ ...m, date: new Date(m.date) }));
    const builder = (daysBack: number): ILineChartDataItem[] => {
        const daysBackCutoff = getDaysBackCutoff(daysBack);
        let filteredData = metrics.slice(metrics.length - daysBackCutoff);
        if (daysBack === DAYS_SINCE_BEGINNING && any(metric => metric.value !== 0, filteredData)) {
            filteredData = dropWhile(metric => metric.value === 0, filteredData);
            daysBack = differenceInDays(Date.now(), filteredData[0].date);
        }

        if (daysBack === 365) {
            filteredData = groupByMonth(filteredData, combineMetrics);
        }
        else if (daysBack > 35) {
            const combinedSamples = [];
            const bucketSize = Math.ceil(daysBack / 35);
            for (let i = 0; i < filteredData.length; i += bucketSize) {
                const toCombine = []
                for (let j = 0; (j < bucketSize) && (i + j) < filteredData.length; j++) {
                    toCombine.push(filteredData[ i + j])
                }
                combinedSamples.push(combineMetrics(toCombine));
            }
            filteredData = combinedSamples;
        }

        const dateFormat = daysBack > 350 ? "MMM ''yy": "MMM do";
        return filteredData.map(metric => ({
            x: fmtDate(metric.date, dateFormat),
            y: metric.value,
            label: `${metric.value}`
        }));
    }
    const rangeBuilders: RangeBuilders = {
        week: () => builder(7),
        month: () => builder(30),
        year: () => builder(365),
        allTime: () => builder(DAYS_SINCE_BEGINNING)
    };
    return getRangeDefinitions(rangeBuilders);
}
