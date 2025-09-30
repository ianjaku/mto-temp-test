import * as React from "react";
import {  MetricSum, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { IDocumentDeletionsStatistics } from "@binders/client/lib/clients/trackingservice/v1/contract";
import LineChartWithRanges from "@binders/ui-kit/lib/elements/linechart/withRanges";
import colors from "@binders/ui-kit/lib/variables";
import { useDocumentDeletionsStatistics } from "../hooks";

const buildMetrics = (documentDeletions: IDocumentDeletionsStatistics[]) => {
    return documentDeletions.map(statistic => ({
        date: statistic.date,
        value: statistic.deletions
    }));
}

export const DocumentDeletionsGraph: React.FC<{ accountId: string }> = ({ accountId }) => {
    const { data = [], isLoading } = useDocumentDeletionsStatistics(accountId);
    const ranges = React.useMemo(() => {
        const metrics = buildMetrics(data);
        return getRangeDefinitionsFromStats(metrics, MetricSum);
    },
    [ data ]);
    return isLoading ?
        <span>Loading...</span> :
        <LineChartWithRanges
            title="Document Deletions"
            ranges={ranges}
            defaultRange="year"
            lineColor={colors.accentColor}
            renderAsBars
            fontSize={10}
            hatchLastBar={true}
        />;
}
