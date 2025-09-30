import * as React from "react";
import { startOfDay, startOfToday, startOfYesterday } from "date-fns";
import { ActivitiesGroup } from "./ActivitiesGroup";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserActivities } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useActivities } from "./hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./Activities.styl";

export const Activities: React.FC = () => {
    const { t } = useTranslation();
    const { data: activities, isLoading, isSuccess, isError } = useActivities();

    return (
        <div className="activities">
            <div className="activities-header">
                {t(TK.HomePage_DocumentsRequiringAttention)}
                {isSuccess && <div className="activities-count">{activities.length}</div>}
            </div>
            <div className="activities-body">
                {isSuccess && <ActivitiesList activities={activities} />}
                {isLoading && <span className="activities-body-message">{t(TK.HomePage_LoadingActivities)}</span>}
                {isError && <span className="activities-body-message">{t(TK.Exception_SomethingWrong)}</span>}
            </div>
        </div>
    );
}

const ActivitiesList: React.FC<{ activities: UserActivities }> = ({ activities }) => {
    const { t } = useTranslation();
    const today = startOfToday();
    const yesterday = startOfYesterday();

    const [todayGroup, yesterdayGroup, olderGroup] = React.useMemo(() => {
        const [todayGroup, yesterdayGroup, olderGroup] = [[], [], []] as UserActivities[];
        activities.forEach(activity => {
            const activityDay = startOfDay(activity.latestCommentDate);
            if (activityDay >= today) {
                todayGroup.push(activity);
            } else if (activityDay >= yesterday) {
                yesterdayGroup.push(activity);
            } else {
                olderGroup.push(activity);
            }
        });
        return [todayGroup, yesterdayGroup, olderGroup];
    }, [today, yesterday, activities]);

    return (
        activities.length === 0 ?
            <span className="activities-body-message">{t(TK.HomePage_NothingToDoMessage)}</span> :
            <>
                <ActivitiesGroup groupName={t(TK.General_Today)} activities={todayGroup} />
                <ActivitiesGroup groupName={t(TK.General_Yesterday)} activities={yesterdayGroup} />
                <ActivitiesGroup groupName={t(TK.General_Older)} activities={olderGroup} />
            </>
    );
}

