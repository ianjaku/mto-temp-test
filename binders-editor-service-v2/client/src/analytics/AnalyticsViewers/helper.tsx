import * as React from "react";
import {
    IDateViewsPair,
    ILanguageStatistics,
    IViewsStatistics
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { addMonths, isAfter, isBefore, subDays, subMonths } from "date-fns";
import { detectTimeZone, fmtDate } from "@binders/client/lib/util/date";
import ReadsPerLanguageStat from "@binders/ui-kit/lib/stats/readsperlanguage";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";

export const renderLanguageAnalytics = (analytics: ILanguageStatistics[]): React.JSX.Element => {
    const data = analytics.map(stat => ({
        languageName: stat.languageCode,
        reads: stat.amount,
        isMachineTranslation: stat.isMachineTranslation,
    }));
    return (
        <div className="analytics-container">
            <ReadsPerLanguageStat data={data} title={i18next.t(TK.Analytics_Language)} />
        </div>
    );
}

const filterDataFromDays = (days: 7 | 30, data: IDateViewsPair[]) => {
    const start = subDays(Date.now(), days);
    return data.filter(({ date }) => !isBefore(new Date(date), start));
}

const makeViewsLabel = (momentLbl: string, views: number) => {
    return `${momentLbl}:\n${i18next.t(TK.Analytics_ViewWithCount, { count: views })}`
}

const buildMonthlyViewsAnalytics = (data: IDateViewsPair[], months: 12) => {
    const monthlyAnalytics = [];
    while (months > 0) {
        const startDate = subMonths(Date.now(), months);
        const endDate = addMonths(startDate, 1);
        const analyticsInRange = data.filter(analytics => {
            const date = new Date(analytics.date);
            return !isBefore(date, startDate) && !isAfter(date, endDate);
        });
        const views = analyticsInRange.reduce((total, stats) => total + stats.views, 0);
        const labelDate = fmtDate(new Date(endDate), "MMM y", {
            locale: i18next.language || "en",
            timeZone: detectTimeZone()
        });
        monthlyAnalytics.push({
            x: labelDate,
            y: views,
            label: makeViewsLabel(labelDate, views),
        });
        months -= 1;
    }
    return monthlyAnalytics;
}

const buildDailyViewsAnalytics = (data: IDateViewsPair[], days: 7 | 30) => {
    const analyticsInRange = filterDataFromDays(days, data);

    return analyticsInRange.map(analytics => {
        const labelDate = fmtDate(new Date(analytics.date), "MMM d", {
            locale: i18next.language || "en",
            timeZone: detectTimeZone()
        });
        return {
            x: labelDate,
            y: analytics.views,
            label: makeViewsLabel(labelDate, analytics.views)
        }
    });
}

export const buildViewsAnalytics = (viewsAnalytics: IViewsStatistics, viewsPerMonthAnalytics: IViewsStatistics, documentId: string) => {
    const data = viewsAnalytics[documentId];
    const monthlyData = viewsPerMonthAnalytics[documentId];

    return data ?
        [
            {
                id: "last_week",
                label: i18next.t(TK.General_LastNDays, { n: 7 }),
                build: () => buildDailyViewsAnalytics(data, 7),
            },
            {
                id: "last_month",
                label: i18next.t(TK.General_LastNDays, { n: 30 }),
                build: () => buildDailyViewsAnalytics(data, 30),
            },
            ...(monthlyData ?
                [{
                    id: "last_year",
                    label: i18next.t(TK.General_LastNMonths, { n: 12 }),
                    build: () => buildMonthlyViewsAnalytics(monthlyData, 12),
                }] :
                [])
        ] :
        [];
}

