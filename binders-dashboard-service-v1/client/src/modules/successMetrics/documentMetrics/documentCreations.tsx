import * as React from "react";
import { MetricSum, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { IDocumentCreationsStatistics } from "@binders/client/lib/clients/trackingservice/v1/contract";
import LineChartWithRanges from "@binders/ui-kit/lib/elements/linechart/withRanges";
import colors from "@binders/ui-kit/lib/variables";
import { useDocumentCreationsStatistics } from "../hooks";

const buildMetrics = (documentCreations: IDocumentCreationsStatistics[]) => {
    return documentCreations.map(el => ({
        date: el.date,
        value: el.creations
    }));
}

export const DocumentCreationsGraph: React.FC<{ accountId: string }> = ({ accountId }) => {
    const { data = [], isLoading } = useDocumentCreationsStatistics(accountId);
    const ranges = React.useMemo(() => {
        const metrics = buildMetrics(data);
        return getRangeDefinitionsFromStats(metrics, MetricSum);
    },
    [ data ]);
    return isLoading ?
        <span>Loading...</span> :
        <LineChartWithRanges
            title={"Document Creations"}
            ranges={ranges}
            defaultRange="year"
            lineColor={colors.accentColor}
            renderAsBars
            fontSize={10}
            hatchLastBar={true}
        />;
};
