import * as React from "react";
import {
    IDocumentCreationsStatistics,
    IDocumentDeletionsStatistics
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { MetricSum, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { isBefore, isSameDay, startOfDay } from "date-fns";
import { useDocumentCreationsStatistics, useDocumentDeletionsStatistics } from "../hooks";
import LineChartWithRanges from "@binders/ui-kit/lib/elements/linechart/withRanges";
import colors from "@binders/ui-kit/lib/variables";
import { sortByDate } from "@binders/client/lib/util/date";

const buildMetrics = (documentCreations: IDocumentCreationsStatistics[]) => {
    return documentCreations.map(el => ({
        date: el.date,
        value: el.creations
    }));
}

export const DocumentMergedOperationsGraph: React.FC<{ accountId: string }> = ({ accountId }) => {
    const { data: creationStatistics = [], isLoading: areCreationStatisticsLoading } = useDocumentCreationsStatistics(accountId);
    const { data: deletionStatistics = [], isLoading: areDeletionStatisticsLoading } = useDocumentDeletionsStatistics(accountId);
    const isLoading = areCreationStatisticsLoading || areDeletionStatisticsLoading;
    const ranges = React.useMemo(() => {
        if (isLoading) {
            return [];
        }
        const data = mergeCreationsAndDeletions(creationStatistics, deletionStatistics);
        const metrics = buildMetrics(data);
        return getRangeDefinitionsFromStats(metrics, MetricSum);
    }, [creationStatistics, deletionStatistics, isLoading]);
    return isLoading ?
        <span>Loading...</span> :
        <LineChartWithRanges
            title={"Netto Documents Added"}
            ranges={ranges}
            defaultRange="year"
            lineColor={colors.accentColor}
            renderAsBars
            fontSize={10}
            hatchLastBar={true}
        />
};

function mergeCreationsAndDeletions(
    creations: IDocumentCreationsStatistics[],
    deletions: IDocumentDeletionsStatistics[],
): IDocumentCreationsStatistics[] {
    if (!creations || !deletions) {
        return [];
    }
    const sortedCreationsStatistics = sortByDate(creations, stat => stat.date);
    const sortedDeletionsStatistics = sortByDate(deletions, stat => stat.date);
    const data: IDocumentCreationsStatistics[] = [];
    let creationDateIndex = 0;
    let deletionDateIndex = 0;
    while (sortedDeletionsStatistics[deletionDateIndex] !== undefined || sortedCreationsStatistics[creationDateIndex] !== undefined) {
        const deletion = sortedDeletionsStatistics[deletionDateIndex];
        const creation = sortedCreationsStatistics[creationDateIndex];
        const creationDateDay = startOfDay(creation.date ?? new Date());
        const deletionDateDay = startOfDay(deletion.date ?? new Date());
        if (!deletion || isBefore(creationDateDay, deletionDateDay)) {
            data.push(creation);
            creationDateIndex++;
            continue;
        }
        if (!creation || isBefore(deletionDateDay, creationDateDay)) {
            data.push({
                date: deletion.date,
                creations: -1 * deletion.deletions,
            });
            deletionDateIndex++;
            continue;
        }
        if (isSameDay(creationDateDay, deletionDateDay)) {
            data.push({
                date: creation.date,
                creations: creation.creations - deletion.deletions,
            });
            creationDateIndex++;
            deletionDateIndex++;
        }
    }
    return data;
}
