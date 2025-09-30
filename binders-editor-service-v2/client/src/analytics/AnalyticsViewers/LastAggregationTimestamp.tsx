import * as React from "react";
import { detectTimeZone, fmtDate, fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isToday } from "date-fns";
import { useLastUserActionsAggregationTime } from "../hooks";
import { useTranslation } from "react-i18next";

export const LastAggregationTimestamp: React.FC = () => {
    const { t } = useTranslation();
    const { data: lastAggregationTime } = useLastUserActionsAggregationTime();
    const lastAggregationTimestamp = React.useMemo(() => {
        if (!lastAggregationTime) {
            return null;
        }
        const formattedDate: string = isToday(lastAggregationTime) ?
            t(TK.General_Today) :
            fmtDateIso8601TZ(lastAggregationTime);
        const formattedTime = fmtDate(lastAggregationTime, "p", { timeZone: detectTimeZone() });
        return `${formattedDate} ${formattedTime}`;
    }, [lastAggregationTime, t]);

    return lastAggregationTimestamp ?
        <label className="filterForm-heading-timestamp">
            {`${t(TK.Analytics_LastUpdated)}: ${lastAggregationTimestamp}`}
        </label> :
        null;
}
