import * as React from "react";
import { MetricSum, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { IDateViewsPair } from "@binders/client/lib/clients/trackingservice/v1/contract";
import LineChartWithRanges from "@binders/ui-kit/lib/elements/linechart/withRanges";
import colors from "@binders/ui-kit/lib/variables";
import { useAccountViewsStatistics } from "../hooks";

export const AccountViews: React.FC<{ account: Account }> = ({ account }) => {
    const { data = [], isLoading } = useAccountViewsStatistics(account.id);
    const ranges = React.useMemo(() => {
        if (isLoading) {
            return [];
        }
        const metrics = Object.values<IDateViewsPair>(data).map(toMetric);
        return getRangeDefinitionsFromStats(metrics, MetricSum);
    }, [data, isLoading]);
    return isLoading ?
        <span>Loading...</span> :
        <LineChartWithRanges
            ranges={ranges}
            defaultRange="year"
            renderAsBars={true}
            title="Document Views"
            lineColor={colors.accentColor}
            hatchLastBar={true}
            fontSize={10}
        />
};

const toMetric = ({ date, views:  value = 0 }: IDateViewsPair) => ({ date, value });

export default AccountViews;