import * as React from "react";
import { SortOrder, sortByDate } from "@binders/client/lib/util/date";
import { UnresolvedCommentsActivity } from "./UnresolvedCommentActivity";
import { UserActivities } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import "./ActivitiesGroup.styl";

export const ActivitiesGroup: React.FC<{ groupName: string, activities: UserActivities }> = ({
    groupName,
    activities
}) => {
    const sortedActivities = React.useMemo(() =>
        sortByDate(activities, activity => activity.latestCommentDate, SortOrder.DESC)
    , [activities]);
    return (
        sortedActivities.length === 0 ?
            null :
            <div className="activities-group">
                <div className="activities-group-name">{groupName}</div>
                {sortedActivities.map((activity, idx) =>
                    <UnresolvedCommentsActivity key={`activity-${idx}`} activity={activity}/>
                )}
            </div>
    );
}